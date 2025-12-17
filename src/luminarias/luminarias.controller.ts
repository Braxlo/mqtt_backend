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
} from '@nestjs/common';
import { LuminariasService } from './luminarias.service';
import { CreateLuminariaDto } from './dto/create-luminaria.dto';
import { UpdateLuminariaDto } from './dto/update-luminaria.dto';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestionar luminarias
 */
@Controller('luminarias')
@UseGuards(JwtAuthGuard)
export class LuminariasController {
  constructor(private readonly luminariasService: LuminariasService) {}

  @Get()
  async findAll() {
    const luminarias = await this.luminariasService.findAll();
    return ResponseUtil.success(luminarias, 'Luminarias obtenidas exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const luminaria = await this.luminariasService.findOne(id);
    return ResponseUtil.success(luminaria, 'Luminaria obtenida exitosamente');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createLuminariaDto: CreateLuminariaDto) {
    const luminaria = await this.luminariasService.create(createLuminariaDto);
    return ResponseUtil.success(luminaria, 'Luminaria creada exitosamente');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateLuminariaDto: UpdateLuminariaDto) {
    const luminaria = await this.luminariasService.update(id, updateLuminariaDto);
    return ResponseUtil.success(luminaria, 'Luminaria actualizada exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.luminariasService.remove(id);
    return ResponseUtil.success(null, 'Luminaria eliminada exitosamente');
  }
}

