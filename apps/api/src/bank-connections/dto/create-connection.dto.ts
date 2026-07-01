import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum BankConnectionProviderDto {
  SIMPLEFIN = 'SIMPLEFIN',
  PLAID = 'PLAID',
}

export class CreateBankConnectionDto {
  @IsEnum(BankConnectionProviderDto)
  provider!: BankConnectionProviderDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  institutionName!: string;

  /**
   * The setup token or access token from the provider's linking flow.
   * For SimpleFIN: the setup token URL that gets exchanged for an access URL.
   * For Plaid: the public token from Plaid Link that gets exchanged for an access token.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  setupToken!: string;
}
