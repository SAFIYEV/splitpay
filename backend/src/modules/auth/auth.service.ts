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
import {
  createPublicKey,
  randomBytes,
  randomUUID,
  verify as cryptoVerify,
} from 'node:crypto';
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

  /**
   * Rotates the refresh grant: the presented token must be the latest stored
   * grant for the user; it is revoked and a fresh pair is issued. A replayed
   * (already-rotated or logged-out) token is simply rejected.
   */
  async refresh(dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>('jwt.secret'),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid token type');
    }
    const grant = await this.redis.get(
      this.refreshGrantKey(payload.sub, payload.jti),
    );
    if (!grant) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    await this.redis.del(this.refreshGrantKey(payload.sub, payload.jti));
    return this.withTokens(user);
  }

  /** Revokes the presented refresh grant. Idempotent by design. */
  async logout(dto: RefreshDto) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.config.get<string>('jwt.secret'),
        algorithms: ['HS256'],
      });
      if (payload.type === 'refresh' && payload.jti) {
        await this.redis.del(this.refreshGrantKey(payload.sub, payload.jti));
      }
    } catch {
      // Unknown/invalid tokens are already unusable — logout stays quiet.
    }
    return { loggedOut: true };
  }

  /**
   * Links a wallet to the current account, but only after the user proved
   * ownership via the challenge + signature flow (same as wallet login).
   * Setting an arbitrary address without a signature is not possible.
   */
  async linkWallet(userId: string, dto: WalletVerifyDto) {
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

    const taken = await this.prisma.user.findUnique({
      where: { walletAddress: dto.walletAddress },
    });
    if (taken && taken.id !== userId) {
      throw new ConflictException('Wallet address already in use');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: dto.walletAddress },
    });
    return this.sanitize(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        avatar: dto.avatar,
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
    const jti = randomUUID();
    const refreshToken = this.jwt.sign(
      { ...base, type: 'refresh', jti } satisfies JwtPayload,
      { expiresIn: this.config.get('jwt.refreshExpiresIn') as never },
    );
    void this.redis.set(
      this.refreshGrantKey(user.id, jti),
      '1',
      this.config.get<number>('jwt.refreshTtlSeconds'),
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

  private refreshGrantKey(userId: string, jti: string) {
    return `refresh-grant:${userId}:${jti}`;
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
