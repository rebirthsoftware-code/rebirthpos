import { SetMetadata } from '@nestjs/common';
import { Rol } from '../enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roller: Rol[]) => SetMetadata(ROLES_KEY, roller);
