import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SyncGradesMirrorDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsBoolean()
  correlateAfter?: boolean = true;

  @IsOptional()
  @IsBoolean()
  async?: boolean = false;
}

export class SyncAvaCorrelateDto {
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsString()
  turmaId?: string;

  @IsOptional()
  @IsBoolean()
  async?: boolean = false;
}
