import { ForbiddenException } from '@nestjs/common';
import { CurrentUserData } from './decorators/current-user.decorator';
import { Rol } from './enums';

/**
 * Verilen kullanıcının erişebileceği sube_id listesini döner.
 * - SUPER_ADMIN / FIRMA_ADMIN: tüm şubeler (boş liste = filtre yok)
 * - Diğer roller: JWT'deki subeIds listesiyle sınırlı
 */
export function erisilebilirSubeler(user: CurrentUserData): {
  hepsi: boolean;
  ids: string[];
} {
  if (user.rol === Rol.SUPER_ADMIN || user.rol === Rol.FIRMA_ADMIN) {
    return { hepsi: true, ids: [] };
  }
  return { hepsi: false, ids: user.subeIds };
}

/**
 * Tek bir şubeye erişim yetkisi kontrolü. Yoksa 403.
 */
export function subeYetkiKontrolu(user: CurrentUserData, subeId: string): void {
  const erisim = erisilebilirSubeler(user);
  if (erisim.hepsi) return;
  if (!erisim.ids.includes(subeId)) {
    throw new ForbiddenException('Bu şubeye erişim yetkiniz yok');
  }
}

/**
 * Prisma WHERE'a eklenecek sube_id filtresini üretir.
 */
export function subeWhereFilter(user: CurrentUserData): { subeId?: { in: string[] } } {
  const erisim = erisilebilirSubeler(user);
  if (erisim.hepsi) return {};
  return { subeId: { in: erisim.ids } };
}
