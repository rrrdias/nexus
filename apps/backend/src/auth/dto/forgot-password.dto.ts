import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsNotEmpty({ message: 'Informe o e-mail ou nome de usuário cadastrado.' })
  @IsString()
  login: string;

  @IsOptional()
  @IsString()
  originUrl?: string;
}
