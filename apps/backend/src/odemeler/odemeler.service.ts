import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KartlaOdeDto, OdemeOlusturDto } from './dto/odeme.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { subeYetkiKontrolu } from '../common/tenant';
import { AdisyonDurum, MasaDurum } from '../common/enums';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';
import { PosKartService } from '../pos-kart/pos-kart.service';

@Injectable()
export class OdemelerService {
  private readonly logger = new Logger(OdemelerService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private denetim: DenetimService,
    private posKart: PosKartService,
  ) {}

  /**
   * Atomik kart ödemesi: önce kalanı validate eder, sonra POS terminale gönderir,
   * sonra Odeme kaydı oluşturur. POS başarılı olduktan sonra DB başarısız olursa
   * otomatik iade çağrısı yapılır — "POS çekti ama sistemde kayıt yok" tutarsızlığı
   * önlenir. Eski akış (kartCek → /odemeler) bu sorunu yaşıyordu.
   */
  async kartlaOde(dto: KartlaOdeDto, user: CurrentUserData) {
    if (dto.idempotencyKey) {
      const mevcut = await this.prisma.odeme.findUnique({
        where: {
          adisyonId_idempotencyKey: {
            adisyonId: dto.adisyonId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (mevcut) {
        return {
          odeme: mevcut,
          kartMeta: mevcut.kartMeta ? JSON.parse(mevcut.kartMeta) : null,
        };
      }
    }

    // Pre-validate: POS'a basmadan önce kalanı kontrol et — fazla tahsilat olmasın
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: dto.adisyonId },
      include: { odemeler: true },
    });
    if (!adisyon) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, adisyon.subeId);
    if (adisyon.durum === AdisyonDurum.KAPALI || adisyon.durum === AdisyonDurum.IPTAL) {
      throw new BadRequestException('Kapanmış adisyona ödeme eklenemez');
    }
    const odenmis = adisyon.odemeler
      .filter((o) => !o.iptal)
      .reduce((acc, o) => acc.add(o.tutar), new Prisma.Decimal(0));
    const kalan = new Prisma.Decimal(adisyon.toplamTutar).sub(odenmis);
    if (new Prisma.Decimal(dto.tutar).gt(kalan.add(0.01))) {
      throw new BadRequestException(
        `Ödenecek tutar kalan bakiyeyi aşıyor (kalan: ${kalan.toFixed(2)})`,
      );
    }

    // POS terminale gönder. Hata olursa cek() BadRequest fırlatır — DB'ye dokunmadık.
    const posYanit = await this.posKart.cek({
      tutar: dto.tutar,
      referans: dto.referans || adisyon.numara,
    });

    // POS başarılı — Odeme.create. Burası hata verirse para çekildi ama kayıt yok:
    // otomatik POS iade çağırıp tutarsızlığı engelle.
    try {
      const odeme = await this.olustur(
        {
          adisyonId: dto.adisyonId,
          tip: 'KREDI_KARTI',
          tutar: dto.tutar,
          bahsis: dto.bahsis,
          idempotencyKey: dto.idempotencyKey,
          kartMeta: {
            slipNo: posYanit.slipNo,
            rrn: posYanit.rrn,
            banka: posYanit.banka,
            sonRakam: posYanit.sonRakam,
            onayKod: posYanit.onayKod,
            terminalMarka: posYanit.terminalMarka,
          },
          odenenKalemler: dto.odenenKalemler,
        },
        user,
      );
      return { odeme, kartMeta: posYanit };
    } catch (dbErr) {
      if (posYanit.slipNo) {
        try {
          await this.posKart.iade({
            orijinalSlipNo: posYanit.slipNo,
            tutar: dto.tutar,
          });
          this.logger.warn(
            `POS otomatik iade: DB hatası sonrası iade başarılı. slipNo=${posYanit.slipNo}, tutar=${dto.tutar}, adisyon=${dto.adisyonId}`,
          );
        } catch (iadeErr) {
          this.logger.error(
            `KRİTİK: POS çekildi ama Odeme.create + otomatik iade ikisi de başarısız. Manuel müdahale gerek. slipNo=${posYanit.slipNo}, tutar=${dto.tutar}, adisyon=${dto.adisyonId}`,
            iadeErr,
          );
        }
      }
      throw dbErr;
    }
  }

  /**
   * Ödeme oluştur. Akış tek bir transaction içinde döner — ödeme yazıldıktan
   * sonra adisyon/masa güncellemesi yarıda kalmaz. Idempotency: aynı
   * (adisyonId, idempotencyKey) ile gelen ikinci istek mevcut ödemeyi döner;
   * tahsilat ve fiş çift basılmaz.
   */
  async olustur(dto: OdemeOlusturDto, user: CurrentUserData) {
    // Hızlı yol: aynı key ile daha önce yaratılmış ödeme varsa onu dön
    if (dto.idempotencyKey) {
      const mevcut = await this.prisma.odeme.findUnique({
        where: {
          adisyonId_idempotencyKey: {
            adisyonId: dto.adisyonId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (mevcut) return mevcut;
    }

    const sonuc = await this.prisma.$transaction(async (tx) => {
      const adisyon = await tx.adisyon.findUnique({
        where: { id: dto.adisyonId },
        include: { odemeler: true },
      });
      if (!adisyon) throw new NotFoundException('Adisyon bulunamadı');
      subeYetkiKontrolu(user, adisyon.subeId);
      if (adisyon.durum === AdisyonDurum.KAPALI || adisyon.durum === AdisyonDurum.IPTAL) {
        throw new BadRequestException('Kapanmış adisyona ödeme eklenemez');
      }

      // Kalan tutar hesabı transaction içinde yeniden okunan odemeler üzerinden —
      // iki paralel ödeme aynı bakiyeyi sıfıra düşüremez.
      const odenmis = adisyon.odemeler
        .filter((o) => !o.iptal)
        .reduce((acc, o) => acc.add(o.tutar), new Prisma.Decimal(0));
      const kalan = new Prisma.Decimal(adisyon.toplamTutar).sub(odenmis);
      if (new Prisma.Decimal(dto.tutar).gt(kalan.add(0.01))) {
        throw new BadRequestException(
          `Ödenecek tutar kalan bakiyeyi aşıyor (kalan: ${kalan.toFixed(2)})`,
        );
      }

      // URUN_SEC kalem ödemesi: split-bill için spesifik kalem adetlerini bağla.
      // Kalem-bazlı doğrulama (sahiplik, kalan adet, fiyat toplamı) burada,
      // adet artırma odeme.create başarılı olduktan sonra.
      let kalemUpdates: Array<{ id: string; yeniOdenenAdet: number }> = [];
      if (dto.odenenKalemler?.length) {
        const kalemIds = dto.odenenKalemler.map((k) => k.kalemId);
        const kalemler = await tx.siparisKalem.findMany({
          where: { id: { in: kalemIds } },
          include: { siparis: { select: { adisyonId: true } } },
        });
        if (kalemler.length !== kalemIds.length) {
          throw new BadRequestException('Bir veya birden çok kalem bulunamadı');
        }
        let kalemToplam = new Prisma.Decimal(0);
        for (const ok of dto.odenenKalemler) {
          const k = kalemler.find((x) => x.id === ok.kalemId)!;
          if (k.siparis.adisyonId !== dto.adisyonId) {
            throw new BadRequestException(`Kalem bu adisyona ait değil: ${ok.kalemId}`);
          }
          if (k.iptal) {
            throw new BadRequestException(`İptal edilmiş kaleme ödeme yapılamaz: ${ok.kalemId}`);
          }
          const yeniOdenen = k.odenenAdet + ok.adet;
          if (yeniOdenen > k.adet) {
            throw new BadRequestException(
              `Kalemin kalan adedi yetersiz (kalan: ${k.adet - k.odenenAdet}, istenen: ${ok.adet})`,
            );
          }
          kalemToplam = kalemToplam.add(k.birimFiyat.mul(ok.adet));
          kalemUpdates.push({ id: k.id, yeniOdenenAdet: yeniOdenen });
        }
        // Kalem tutarı dto.tutar ile eşleşmeli (1 kuruş tolerans yuvarlama için).
        if (kalemToplam.sub(new Prisma.Decimal(dto.tutar)).abs().gt(0.01)) {
          throw new BadRequestException(
            `Seçili kalem tutarı (${kalemToplam.toFixed(2)}) ödeme tutarıyla (${dto.tutar.toFixed(2)}) uyuşmuyor`,
          );
        }
      }

      let odeme;
      let yeniKayit = true;
      try {
        odeme = await tx.odeme.create({
          data: {
            subeId: adisyon.subeId,
            adisyonId: adisyon.id,
            kullaniciId: user.kullaniciId,
            tip: dto.tip,
            tutar: new Prisma.Decimal(dto.tutar),
            bahsis: new Prisma.Decimal(dto.bahsis || 0),
            idempotencyKey: dto.idempotencyKey,
            kartMeta: dto.kartMeta ? JSON.stringify(dto.kartMeta) : null,
            // Iptal'de adet'leri geri çekmek için snapshot
            odenenKalemler: dto.odenenKalemler?.length
              ? JSON.stringify(dto.odenenKalemler)
              : null,
          },
        });
        // Kalem odenenAdet'lerini şimdi artır (odeme.create başarılı olduktan sonra)
        for (const u of kalemUpdates) {
          await tx.siparisKalem.update({
            where: { id: u.id },
            data: { odenenAdet: u.yeniOdenenAdet },
          });
        }
      } catch (e) {
        yeniKayit = false;
        // İki istek aynı anda hızlı yolu geçtiyse unique constraint burada yakalanır
        if (
          dto.idempotencyKey &&
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          const mevcut = await tx.odeme.findUnique({
            where: {
              adisyonId_idempotencyKey: {
                adisyonId: dto.adisyonId,
                idempotencyKey: dto.idempotencyKey,
              },
            },
          });
          if (mevcut) {
            return { odeme: mevcut, yeniDurum: adisyon.durum, masaYeniDurum: null as string | null, odenenToplam: odenmis.toNumber() };
          }
        }
        throw e;
      }

      const yeniOdenmis = odenmis.add(dto.tutar);
      let yeniDurum: string = AdisyonDurum.ODEME_BEKLIYOR;
      let masaYeniDurum: string | null = null;
      if (yeniOdenmis.gte(adisyon.toplamTutar.sub(0.01))) {
        await tx.adisyon.update({
          where: { id: adisyon.id },
          data: { durum: AdisyonDurum.KAPALI, kapanis: new Date() },
        });
        yeniDurum = AdisyonDurum.KAPALI;
        if (adisyon.masaId) {
          await tx.masa.update({
            where: { id: adisyon.masaId },
            data: { durum: MasaDurum.BOS },
          });
          masaYeniDurum = MasaDurum.BOS;
        }
      } else {
        await tx.adisyon.update({
          where: { id: adisyon.id },
          data: { durum: AdisyonDurum.ODEME_BEKLIYOR },
        });
      }

      // Audit: yalnız gerçek yeni ödemede; idempotent retry'da tekrar atma.
      if (yeniKayit) {
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.ODEME_OLUSTUR,
          entityTipi: 'Odeme',
          entityId: odeme.id,
          subeId: adisyon.subeId,
          ozet: `${Number(odeme.tutar).toFixed(2)}₺ ${odeme.tip} · adisyon ${adisyon.numara}`,
          sonraki: {
            adisyonId: adisyon.id,
            tip: odeme.tip,
            tutar: Number(odeme.tutar),
            bahsis: Number(odeme.bahsis),
            yeniAdisyonDurum: yeniDurum,
          },
        });
      }

      return { odeme, yeniDurum, masaYeniDurum, odenenToplam: yeniOdenmis.toNumber(), masaId: adisyon.masaId, subeId: adisyon.subeId };
    });

    // Yan etkiler transaction dışında — emit hatası tahsilatı bozmasın
    const { odeme, yeniDurum, masaYeniDurum, odenenToplam } = sonuc;
    const subeId = (sonuc as any).subeId ?? odeme.subeId;
    const masaId = (sonuc as any).masaId;

    this.realtime.odemeAlindi(subeId, {
      odemeId: odeme.id,
      adisyonId: odeme.adisyonId,
      tutar: Number(odeme.tutar),
      tip: odeme.tip,
    });
    this.realtime.adisyonGuncellendi(subeId, {
      adisyonId: odeme.adisyonId,
      durum: yeniDurum,
      odenenToplam,
    });
    if (masaYeniDurum && masaId) {
      this.realtime.masaDurumDegisti(subeId, { masaId, durum: masaYeniDurum });
    }

    return odeme;
  }

  /**
   * Ödeme iptali: kapanmış adisyonu tekrar açar, masayı doluya geri çevirir.
   * Tüm yazma işlemleri tek transaction'da.
   */
  async iptal(id: string, user: CurrentUserData) {
    const mevcut = await this.prisma.odeme.findUnique({
      where: { id },
      include: { adisyon: true },
    });
    if (!mevcut) throw new NotFoundException('Ödeme bulunamadı');
    subeYetkiKontrolu(user, mevcut.subeId);

    const sonuc = await this.prisma.$transaction(async (tx) => {
      const odeme = await tx.odeme.update({ where: { id }, data: { iptal: true } });
      // URUN_SEC kalem ödemesi iptal edilirse, ilgili kalem.odenenAdet'leri geri çek
      if (mevcut.odenenKalemler) {
        try {
          const snapshot = JSON.parse(mevcut.odenenKalemler) as Array<{ kalemId: string; adet: number }>;
          for (const ok of snapshot) {
            await tx.siparisKalem.update({
              where: { id: ok.kalemId },
              data: { odenenAdet: { decrement: ok.adet } },
            });
          }
        } catch (e) {
          this.logger.warn(`Ödeme iptal: odenenKalemler parse hatası odemeId=${id}`, e as any);
        }
      }
      let adisyonYenidenAcildi = false;
      let masaYeniDurum: string | null = null;
      if (mevcut.adisyon.durum === AdisyonDurum.KAPALI) {
        await tx.adisyon.update({
          where: { id: mevcut.adisyonId },
          data: { durum: AdisyonDurum.ODEME_BEKLIYOR, kapanis: null },
        });
        adisyonYenidenAcildi = true;
        if (mevcut.adisyon.masaId) {
          await tx.masa.update({
            where: { id: mevcut.adisyon.masaId },
            data: { durum: MasaDurum.DOLU },
          });
          masaYeniDurum = MasaDurum.DOLU;
        }
      }

      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.ODEME_IPTAL,
        entityTipi: 'Odeme',
        entityId: id,
        subeId: mevcut.subeId,
        ozet: `${Number(mevcut.tutar).toFixed(2)}₺ ${mevcut.tip} ödeme iptal edildi`,
        onceki: {
          tip: mevcut.tip,
          tutar: Number(mevcut.tutar),
          adisyonId: mevcut.adisyonId,
          adisyonDurum: mevcut.adisyon.durum,
        },
        sonraki: { iptal: true, adisyonYenidenAcildi },
      });

      return { odeme, adisyonYenidenAcildi, masaYeniDurum };
    });

    // Realtime: ödeme iptali tablo/adisyon görünümünü etkiler
    if (sonuc.adisyonYenidenAcildi) {
      this.realtime.adisyonGuncellendi(mevcut.subeId, {
        adisyonId: mevcut.adisyonId,
        durum: AdisyonDurum.ODEME_BEKLIYOR,
      });
      if (sonuc.masaYeniDurum && mevcut.adisyon.masaId) {
        this.realtime.masaDurumDegisti(mevcut.subeId, {
          masaId: mevcut.adisyon.masaId,
          durum: sonuc.masaYeniDurum,
        });
      }
    }
    return sonuc.odeme;
  }
}
