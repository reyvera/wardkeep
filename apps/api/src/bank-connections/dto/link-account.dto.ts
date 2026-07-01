import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LinkAccountDto {
  /**
   * The linked bank account ID (from LinkedBankAccount table).
   */
  @IsString()
  @IsNotEmpty()
  linkedBankAccountId!: string;

  /**
   * The local account ID to link to. If not provided, a new account is created.
   */
  @IsString()
  @IsOptional()
  accountId?: string;
}
