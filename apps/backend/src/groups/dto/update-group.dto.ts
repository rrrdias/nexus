import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateGroupDto {
  @IsString({ message: 'Nome do grupo deve ser um texto.' })
  @IsNotEmpty({ message: 'Nome do grupo é obrigatório.' })
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleIds?: string[];
}
