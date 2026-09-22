import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLocalDto {
  @IsString({ message: 'Nome deve ser um texto.' })
  @IsNotEmpty({ message: 'Nome do local é obrigatório.' })
  nome!: string;

  @IsString({ message: 'Endereço deve ser um texto.' })
  @IsNotEmpty({ message: 'Endereço é obrigatório.' })
  endereco!: string;

  @IsOptional()
  @IsString()
  linkLocal?: string;

  @IsOptional()
  @IsString()
  telefone?: string;
}
