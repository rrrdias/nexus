import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString({ message: 'opcaoId deve ser uma string.' })
  @IsNotEmpty({ message: 'opcaoId é obrigatório.' })
  opcaoId!: string;

  @IsString({ message: 'matricula deve ser uma string.' })
  @IsNotEmpty({ message: 'matricula é obrigatória.' })
  matricula!: string;

  @IsString({ message: 'periodo deve ser uma string.' })
  @IsNotEmpty({ message: 'periodo é obrigatório.' })
  periodo!: string;
}
