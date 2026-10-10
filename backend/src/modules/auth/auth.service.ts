import {
  ConflictException,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto';
import { getAddressEncoder, getBase58Encoder, isAddress } from '@solana/kit';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  GoogleAuthDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  UpdateMeDto,
  WalletChallengeDto,
  WalletVerifyDto,
} from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const CHALLENGE_TTL_SECONDS = 300;
// DER SPKI prefix for a raw 32-byte ed25519 public key
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
      },
    });
    return this.withTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.withTokens(user);
  }

  async walletChallenge(dto: WalletChallengeDto) {
    if (!isAddress(dto.walletAddress)) {
      throw new UnauthorizedException('Invalid Solana wallet address');
    }
    const nonce = randomBytes(16).toString('hex');
    const message = [
      'SplitPay wallet authentication',
      `Wallet: ${dto.walletAddress}`,
      `Nonce: ${nonce}`,
      `Issued at: ${new Date().toISOString()}`,
    ].join('\n');
    await this.redis.set(
      this.challengeKey(dto.walletAddress),
      message,
      CHALLENGE_TTL_SECONDS,
    );
    return { message, expiresIn: CHALLENGE_TTL_SECONDS };
  }

  async walletVerify(dto: WalletVerifyDto) {
    if (!isAddress(dto.walletAddress)) {
      throw new UnauthorizedException('Invalid Solana wallet address');
    }
    const message = await this.redis.get(
      this.challengeKey(dto.walletAddress),
    );
    if (!message) {
      throw new UnauthorizedException('Challenge expired or not found');
    }
    const valid = this.verifyEd25519(
      dto.walletAddress,
      dto.signature,
      message,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid signature');
    }
    await this.redis.del(this.challengeKey(dto.walletAddress));

    let user = await this.prisma.user.findUnique({
      where: { walletAddress: dto.walletAddress },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          walletAddress: dto.walletAddress,
          displayName: `${dto.walletAddress.slice(0, 4)}...${dto.walletAddress.slice(-4)}`,
          verified: true,
        },
      });
    }
    return this.withTokens(user);
  }

  // TODO: verify the Google idToken against https://oauth2.googleapis.com/tokeninfo
  // (or google-auth-library) using GOOGLE_CLIENT_ID, then find-or-create the user
  // by googleId / email. Stubbed until Google OAuth credentials are provisioned.
  google(_dto: GoogleAuthDto): never {
    if (!this.config.get<string>('google.clientId')) {
      throw new NotImplementedException(
        'Google OAuth is not configured (GOOGLE_CLIENT_ID missing)',
      );
    }
    throw new NotImplementedException('Google OAuth not implemented yet');
  }

  async refresh(dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.withTokens(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    if (dto.walletAddress) {
      if (!isAddress(dto.walletAddress)) {
        throw new UnauthorizedException('Invalid Solana wallet address');
      }
      const taken = await this.prisma.user.findUnique({
        where: { walletAddress: dto.walletAddress },
      });
      if (taken && taken.id !== userId) {
        throw new ConflictException('Wallet address already in use');
      }
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        avatar: dto.avatar,
        walletAddress: dto.walletAddress,
      },
    });
    return this.sanitize(user);
  }

  private withTokens(user: User) {
    return { user: this.sanitize(user), ...this.issueTokens(user) };
  }

  private issueTokens(user: User) {
    const base = { sub: user.id, email: user.email ?? undefined };
    const accessToken = this.jwt.sign(
      { ...base, type: 'access' } satisfies JwtPayload,
      { expiresIn: this.config.get('jwt.expiresIn') as never },
    );
    const refreshToken = this.jwt.sign(
      { ...base, type: 'refresh' } satisfies JwtPayload,
      { expiresIn: this.config.get('jwt.refreshExpiresIn') as never },
    );
    return { accessToken, refreshToken };
  }

  sanitize(user: User) {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }

  private challengeKey(walletAddress: string) {
    return `wallet-challenge:${walletAddress}`;
  }

  private verifyEd25519(
    walletAddress: string,
    signatureBase58: string,
    message: string,
  ): boolean {
    try {
      const publicKeyBytes = getAddressEncoder().encode(
        walletAddress as Parameters<ReturnType<typeof getAddressEncoder>['encode']>[0],
      );
      const signatureBytes = getBase58Encoder().encode(signatureBase58);
      if (publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
        return false;
      }
      const key = createPublicKey({
        key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
        format: 'der',
        type: 'spki',
      });
      return cryptoVerify(
        null,
        Buffer.from(message, 'utf8'),
        key,
        Buffer.from(signatureBytes),
      );
    } catch {
      return false;
    }
  }
}
