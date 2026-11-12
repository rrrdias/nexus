import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class EngagementFilterDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  disciplinaId?: string;

  @IsOptional()
  @IsString()
  disciplinaCodigo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['critico', 'atencao', 'procrastinacao', 'autonomo'])
  grupoRisco?: 'critico' | 'atencao' | 'procrastinacao' | 'autonomo';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  faixaTempo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['todos', 'mais_7_dias', 'mais_14_dias', 'mais_30_dias', 'sem_acesso'])
  recenciaAcesso?:
    | 'todos'
    | 'mais_7_dias'
    | 'mais_14_dias'
    | 'mais_30_dias'
    | 'sem_acesso';

  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 15;
}
