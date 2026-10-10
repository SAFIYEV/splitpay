import { SplitMethod } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  photo?: string;

  @IsOptional()
  @IsEnum(SplitMethod)
  splitMethod?: SplitMethod;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  photo?: string;

  @IsOptional()
  @IsEnum(SplitMethod)
  splitMethod?: SplitMethod;
}

export class JoinGroupDto {
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
}
