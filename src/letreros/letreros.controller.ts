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
import { LetrerosService } from './letreros.service';
import { CreateLetreroDto } from './dto/create-letrero.dto';
import { UpdateLetreroDto } from './dto/update-letrero.dto';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador para gestionar letreros
 */
@Controller('letreros')
@UseGuards(JwtAuthGuard)
export class LetrerosController {
  constructor(private readonly letrerosService: LetrerosService) {}

  @Get()
  async findAll() {
    const letreros = await this.letrerosService.findAll();
    return ResponseUtil.success(letreros, 'Letreros obtenidos exitosamente');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const letrero = await this.letrerosService.findOne(id);
    return ResponseUtil.success(letrero, 'Letrero obtenido exitosamente');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createLetreroDto: CreateLetreroDto) {
    const letrero = await this.letrerosService.create(createLetreroDto);
    return ResponseUtil.success(letrero, 'Letrero creado exitosamente');
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateLetreroDto: UpdateLetreroDto) {
    const letrero = await this.letrerosService.update(id, updateLetreroDto);
    return ResponseUtil.success(letrero, 'Letrero actualizado exitosamente');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.letrerosService.remove(id);
    return ResponseUtil.success(null, 'Letrero eliminado exitosamente');
  }
}
