import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class WalletChallengeDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}

export class WalletVerifyDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  /** base58-encoded ed25519 signature of the challenge message */
  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  avatar?: string;

  // NOTE: walletAddress is deliberately absent — a wallet can only be linked
  // by proving ownership via the challenge + signature flow
  // (POST /auth/wallet/challenge, then POST /auth/wallet/link).
}
