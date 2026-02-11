import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LuminariasMapaService } from './luminarias-mapa.service';
import { CreateLuminariaMapaDto } from './dto/create-luminaria-mapa.dto';
import { UpdateLuminariaMapaDto } from './dto/update-luminaria-mapa.dto';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestionar posiciones de luminarias en el mapa
 */
@Controller('luminarias-mapa')
@UseGuards(JwtAuthGuard)
export class LuminariasMapaController {
  constructor(private readonly luminariasMapaService: LuminariasMapaService) {}

  @Get()
  async findAll() {
    const posiciones = await this.luminariasMapaService.findAll();
    return ResponseUtil.success(posiciones, 'Posiciones obtenidas exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const posicion = await this.luminariasMapaService.findOne(id);
    return ResponseUtil.success(posicion, 'Posición obtenida exitosamente');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateLuminariaMapaDto) {
    const posicion = await this.luminariasMapaService.createOrUpdate(createDto);
    return ResponseUtil.success(posicion, 'Posición creada/actualizada exitosamente');
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateLuminariaMapaDto,
  ) {
    const posicion = await this.luminariasMapaService.update(id, updateDto);
    return ResponseUtil.success(posicion, 'Posición actualizada exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.luminariasMapaService.remove(id);
    return ResponseUtil.success(null, 'Posición eliminada exitosamente');
  }
}
