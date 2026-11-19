import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emptyStringToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class UpdateUserDto {
  @Transform(trimString)
  @IsString({ message: 'Nome deve ser um texto.' })
  @IsNotEmpty({ message: 'Nome é obrigatório.' })
  name!: string;

  @Transform(trimString)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @IsNotEmpty({ message: 'E-mail é obrigatório.' })
  email!: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @MinLength(6, {
    message: 'A senha deve ter pelo menos 6 caracteres se fornecida.',
  })
  password?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  userid?: string;

  @IsOptional()
  @Transform(
    ({ value }) =>
      value === true || value === 'true' || value === 'on' || value === 1,
  )
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
