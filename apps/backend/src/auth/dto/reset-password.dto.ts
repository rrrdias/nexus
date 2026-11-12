import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Token de recuperação inválido ou ausente.' })
  @IsString()
  token: string;

  @IsNotEmpty({ message: 'Informe a nova senha.' })
  @IsString()
  @MinLength(6, { message: 'A nova senha deve ter no mínimo 6 caracteres.' })
  newPassword: string;
}
