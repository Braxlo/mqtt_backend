import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class BarreraOrderItem {
  @IsString()
  id: string;

  @IsNumber()
  orden: number;
}

export class UpdateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BarreraOrderItem)
  barreras: BarreraOrderItem[];
}

