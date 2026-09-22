import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString({ message: 'Nome deve ser um texto.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  name!: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'E-mail é obrigatório.' })
  email!: string;

  @IsString({ message: 'Senha deve ser um texto.' })
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password!: string;

  @IsOptional()
  @IsString()
  userid?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 'on' || value === 1)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleIds?: string[];
}
