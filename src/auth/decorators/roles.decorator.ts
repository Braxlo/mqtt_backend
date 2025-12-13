import { SetMetadata } from '@nestjs/common';

/**
 * Decorator para especificar roles requeridos en un endpoint
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

