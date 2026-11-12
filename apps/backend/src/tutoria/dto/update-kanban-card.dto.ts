import { IsOptional, IsString } from 'class-validator';

export class UpdateKanbanCardDto {
  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  canalContatoUtilizado?: string;

  @IsOptional()
  @IsString()
  ultimoContatoEm?: string;

  @IsOptional()
  @IsString()
  dataResolucao?: string;
}
