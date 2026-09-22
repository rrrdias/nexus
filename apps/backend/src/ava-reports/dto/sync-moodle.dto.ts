import { IsIn, IsOptional, IsString } from 'class-validator';

export class SyncMoodleDto {
  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsIn(['grades', 'progress'], { message: 'type deve ser "grades" ou "progress".' })
  type?: 'grades' | 'progress';
}
