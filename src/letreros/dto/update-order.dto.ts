import { IsArray, ValidateNested, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class LetreroOrdenDto {
  @IsString()
  id: string;

  @IsInt()
  orden: number;
}

export class UpdateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LetreroOrdenDto)
  letreros: LetreroOrdenDto[];
}

