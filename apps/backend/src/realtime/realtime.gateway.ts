import { Injectable } from '@nestjs/common';

/**
 * Eskiden Socket.IO WebSocket gateway'iydi. Vercel serverless'ta kalıcı
 * WebSocket bağlantısı tutulamadığı için canlı yayın kaldırıldı; frontend
 * artık polling (periyodik yeniden çekme) ile güncelleniyor.
 *
 * Bu sınıf, servislerdeki çağrılar (yeniSiparis, adisyonGuncellendi, ...)
 * bozulmasın diye no-op olarak duruyor. İleride istenirse SSE / web-push ile
 * gerçek bildirime dönüştürülebilir — imza aynı kalır.
 */
@Injectable()
export class RealtimeGateway {
  yayinla(_subeId: string, _olay: string, _veri: any) {}
  yeniSiparis(_subeId: string, _siparis: any) {}
  siparisGuncellendi(_subeId: string, _siparis: any) {}
  adisyonGuncellendi(_subeId: string, _adisyon: any) {}
  masaDurumDegisti(_subeId: string, _masa: any) {}
  odemeAlindi(_subeId: string, _odeme: any) {}
}
