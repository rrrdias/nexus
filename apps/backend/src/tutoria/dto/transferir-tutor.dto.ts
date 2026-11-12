import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TransferirTutorDto {
  @IsNotEmpty({ message: 'ID do novo tutor responsável é obrigatório.' })
  @IsString()
  novoTutorId: string;

  @IsNotEmpty({ message: 'A nota de transição é obrigatória.' })
  @IsString()
  @MinLength(5, {
    message: 'A nota de transição deve conter no mínimo 5 caracteres.',
  })
  notaTransicao: string;
}
