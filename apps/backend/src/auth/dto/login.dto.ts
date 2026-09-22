import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString({ message: 'E-mail ou login deve ser uma string.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Login deve ser uma string.' })
  login?: string;

  @IsString({ message: 'Senha deve ser uma string.' })
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MinLength(1, { message: 'Senha não pode ser vazia.' })
  password!: string;
}
