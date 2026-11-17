import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GradesQueryDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  instituicao?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 50;
}

export class TurmaStudentsQueryDto {
  @IsOptional()
  @IsIn(['todos', 'matriculado', 'suspenso', 'cancelado'])
  statusMatricula?: 'todos' | 'matriculado' | 'suspenso' | 'cancelado' =
    'todos';

  @IsOptional()
  @IsIn(['todas', 'pendente', 'lancada'])
  statusNota?: 'todas' | 'pendente' | 'lancada' = 'todas';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 100;
}
