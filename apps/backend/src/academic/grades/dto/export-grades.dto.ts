import { IsIn, IsOptional, IsString } from 'class-validator';

export class ExportGradesDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  turmaId?: string;

  @IsOptional()
  @IsIn(['todos', 'matriculado', 'suspenso', 'cancelado'])
  statusMatricula?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
