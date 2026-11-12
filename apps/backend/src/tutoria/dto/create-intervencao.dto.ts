import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import type { TutoriaTipoEvento, TutoriaCanalContato } from '../../db/schema';

export const TUTORIA_TIPOS_EVENTO: TutoriaTipoEvento[] = [
  'abertura',
  'mudanca_status',
  'contato_enviado',
  'intervencao_manual',
  'passagem_bastao',
  'finalizacao',
  'reabertura',
];

export const TUTORIA_CANAIS_CONTATO: TutoriaCanalContato[] = [
  'whatsapp',
  'email',
  'telefone',
  'ava',
  'outro',
];

export class CreateIntervencaoDto {
  @IsOptional()
  @IsString()
  atendimentoId?: string;

  @IsNotEmpty({ message: 'Matrícula é obrigatória.' })
  @IsString()
  matricula: string;

  @IsOptional()
  @IsString()
  periodo?: string;

  @IsNotEmpty({ message: 'tipoEvento é obrigatório.' })
  @IsIn(TUTORIA_TIPOS_EVENTO, {
    message: `tipoEvento deve ser um dos seguintes valores: ${TUTORIA_TIPOS_EVENTO.join(', ')}`,
  })
  tipoEvento: TutoriaTipoEvento;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsIn(TUTORIA_CANAIS_CONTATO, {
    message: `canalContato deve ser um dos seguintes valores: ${TUTORIA_CANAIS_CONTATO.join(', ')}`,
  })
  canalContato?: TutoriaCanalContato;

  @IsNotEmpty({
    message: 'Observações são obrigatórias para registrar intervenção.',
  })
  @IsString()
  observacoes: string;

  @IsOptional()
  @IsString()
  statusKanban?: string;

  @IsOptional()
  metadata?: any;
}
