import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AddGrupoAlunosDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  matriculas!: string[];

  @IsOptional()
  @IsString()
  institution?: string = 'ead';

  @IsOptional()
  @IsString()
  observacoes?: string;
}
