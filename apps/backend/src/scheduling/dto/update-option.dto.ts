import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class UpdateOptionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'vagas deve ser um número inteiro.' })
  @Min(0, { message: 'vagas deve ser maior ou igual a zero.' })
  vagas?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  @IsBoolean()
  status?: boolean;
}
