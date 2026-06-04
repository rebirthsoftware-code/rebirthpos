import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Rol } from '../enums';

export interface CurrentUserData {
  kullaniciId: string;
  rol: Rol;
  subeIds: string[];
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
