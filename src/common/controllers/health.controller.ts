import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { ResponseUtil } from '../utils/response.util';

/**
 * Controlador para endpoints de salud e información
 */
@Controller()
export class HealthController {
  @Get()
  @Public()
  health() {
    return ResponseUtil.success(
      {
        status: 'ok',
        service: 'Centinela Backend API',
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          mqtt: '/api/mqtt',
          barreras: '/api/barreras',
          luminarias: '/api/luminarias',
          letreros: '/api/letreros',
          escenarios: '/api/escenarios',
          users: '/api/users',
          puntosReferencia: '/api/puntos-referencia',
        },
      },
      'API funcionando correctamente',
    );
  }

  @Get('health')
  @Public()
  healthCheck() {
    return ResponseUtil.success(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      'Sistema operativo',
    );
  }
}

