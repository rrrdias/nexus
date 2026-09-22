import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOptionDto {
  @IsString({ message: 'localId deve ser uma string.' })
  @IsNotEmpty({ message: 'localId é obrigatório.' })
  localId!: string;

  @IsString({ message: 'data deve ser uma string (YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'data é obrigatória.' })
  data!: string;

  @IsString({ message: 'horaInicio deve ser no formato HH:MM.' })
  @IsNotEmpty({ message: 'horaInicio é obrigatória.' })
  horaInicio!: string;

  @IsString({ message: 'horaFim deve ser no formato HH:MM.' })
  @IsNotEmpty({ message: 'horaFim é obrigatória.' })
  horaFim!: string;

  @Type(() => Number)
  @IsInt({ message: 'vagas deve ser um número inteiro.' })
  @Min(0, { message: 'vagas deve ser maior ou igual a zero.' })
  vagas!: number;
}
