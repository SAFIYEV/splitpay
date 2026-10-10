import { SettlementStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSettlementDto {
  @IsString()
  @IsNotEmpty()
  toUserId: string;

  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  notes?: string;
}

export class UpdateSettlementStatusDto {
  @IsEnum(SettlementStatus)
  status: SettlementStatus;
}

export class ConfirmSettlementDto {
  /** base58-encoded Solana transaction signature */
  @IsString()
  @IsNotEmpty()
  signature: string;
}
