import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateKanbanCardDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsNotEmpty()
  @IsString()
  matricula: string;

  @IsOptional()
  @IsString()
  alunoNome?: string;

  @IsOptional()
  @IsString()
  alunoEmail?: string;

  @IsOptional()
  @IsString()
  disciplinaCodigo?: string;

  @IsOptional()
  @IsString()
  disciplinaNome?: string;

  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  canalContatoUtilizado?: string;
}
