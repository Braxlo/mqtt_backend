import { PartialType } from '@nestjs/mapped-types';
import { CreateLuminariaMapaDto } from './create-luminaria-mapa.dto';

export class UpdateLuminariaMapaDto extends PartialType(CreateLuminariaMapaDto) {}
