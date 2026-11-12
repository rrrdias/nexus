import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class SendTutoriaEmailDto {
  @IsNotEmpty({ message: 'Matrícula do discente é obrigatória.' })
  @IsString()
  matricula: string;

  @IsNotEmpty({ message: 'E-mail do discente é obrigatório.' })
  @IsEmail({}, { message: 'Formato de e-mail inválido.' })
  alunoEmail: string;

  @IsOptional()
  @IsString()
  alunoNome?: string;

  @IsOptional()
  @IsString()
  disciplinaNome?: string;

  @IsNotEmpty({ message: 'Mensagem pedagógica é obrigatória.' })
  @IsString()
  mensagem: string;

  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  cardId?: string;
}
