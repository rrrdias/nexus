import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateLocalDto {
  @IsOptional()
  @IsString({ message: 'Nome deve ser um texto.' })
  nome?: string;

  @IsOptional()
  @IsString({ message: 'Endereço deve ser um texto.' })
  endereco?: string;

  @IsOptional()
  @IsString()
  linkLocal?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  @IsBoolean()
  status?: boolean;
}
