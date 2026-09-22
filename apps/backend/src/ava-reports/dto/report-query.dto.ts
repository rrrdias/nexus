import { IsInt, IsOptional, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number = 15;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any> = {};
}

export class ExportReportDto {
  @IsOptional()
  @IsObject()
  filters?: Record<string, any> = {};
}
