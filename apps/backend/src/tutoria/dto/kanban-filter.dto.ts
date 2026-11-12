import { IsOptional, IsString } from 'class-validator';

export class KanbanFilterDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  disciplinaCodigo?: string;

  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  @IsString()
  grupoRisco?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
