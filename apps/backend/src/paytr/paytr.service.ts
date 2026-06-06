import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  IPaytrAdapter,
  PaytrOdemeBaslatIstegi,
  PaytrSonucIstegi,
} from './paytr.types';

export const PAYTR_ADAPTER = Symbol('PAYTR_ADAPTER');

@Injectable()
export class PaytrService {
  constructor(@Inject(PAYTR_ADAPTER) private adapter: IPaytrAdapter) {}

  durum() {
    return this.adapter.durum().then((d) => ({ ...d, saglayici: this.adapter.saglayici() }));
  }

  async odemeBaslat(istek: PaytrOdemeBaslatIstegi) {
    if (!Number.isFinite(istek.tutar) || istek.tutar <= 0) {
      throw new BadRequestException('Geçersiz tutar');
    }
    const yanit = await this.adapter.odemeBaslat(istek);
    if (!yanit.basarili) {
      throw new BadRequestException(yanit.hata || 'Sanal POS ödeme oturumu başlatılamadı');
    }
    return yanit;
  }

  // sonucDogrula servis seviyesinde exception fırlatmaz — başarısız ödeme de
  // normal bir sonuçtur (müşteri iptal etti/banka reddetti). Çağıran karar verir.
  sonucDogrula(istek: PaytrSonucIstegi) {
    return this.adapter.sonucDogrula(istek);
  }
}
