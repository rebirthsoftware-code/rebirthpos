import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { IPosKartAdapter, PosKartCekIstegi, PosKartIadeIstegi } from './pos-kart.types';

export const POS_KART_ADAPTER = Symbol('POS_KART_ADAPTER');

@Injectable()
export class PosKartService {
  constructor(@Inject(POS_KART_ADAPTER) private adapter: IPosKartAdapter) {}

  durum() {
    return this.adapter.durum().then((d) => ({ ...d, marka: this.adapter.marka() }));
  }

  async cek(istek: PosKartCekIstegi) {
    if (!Number.isFinite(istek.tutar) || istek.tutar <= 0) {
      throw new BadRequestException('Geçersiz tutar');
    }
    const yanit = await this.adapter.cek(istek);
    if (!yanit.basarili) {
      // 400 dön ki frontend hata akışına girsin (overlay'da retry/iptal)
      throw new BadRequestException(yanit.hata || 'POS terminali işlemi reddetti');
    }
    return yanit;
  }

  async iade(istek: PosKartIadeIstegi) {
    const yanit = await this.adapter.iade(istek);
    if (!yanit.basarili) {
      throw new BadRequestException(yanit.hata || 'İade reddedildi');
    }
    return yanit;
  }
}
