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

  /**
   * Optional explicit payer. When set, the current user must be one of the
   * two parties (recording a repayment you received from another member).
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fromUserId?: string;

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
