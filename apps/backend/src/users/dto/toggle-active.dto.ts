import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ToggleUserActiveDto {
  @Transform(({ value }) => value === true || value === 'true' || value === 1)
  @IsBoolean({ message: 'isActive deve ser um booleano.' })
  isActive!: boolean;
}
