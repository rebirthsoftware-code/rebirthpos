import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Prisma hatalarını anlamlı HTTP yanıtlarına çevirir. Aksi halde Nest tüm
 * Prisma hatalarını jenerik "Internal server error" (500) olarak döner ve
 * asıl sebep (eksik kolon, tablo yok, unique ihlali...) gizli kalır.
 *
 * Özellikle migration kullanılmayan (db push) kurulumda şema kayması teşhisi
 * için kritik: P2021 (tablo yok) / P2022 (kolon yok) mesajı kullanıcıya/loga yansır.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientUnknownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Prisma');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let mesaj = 'Veritabanı hatası';
    let kod: string | undefined;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      kod = exception.code;
      const meta = exception.meta || {};
      switch (exception.code) {
        case 'P2002': // unique ihlali
          status = HttpStatus.CONFLICT;
          mesaj = `Bu kayıt zaten var (benzersiz alan: ${(meta as any).target || '—'})`;
          break;
        case 'P2025': // bulunamadı
          status = HttpStatus.NOT_FOUND;
          mesaj = (meta as any).cause || 'Kayıt bulunamadı';
          break;
        case 'P2003': // foreign key
          status = HttpStatus.BAD_REQUEST;
          mesaj = `İlişkili kayıt geçersiz (alan: ${(meta as any).field_name || '—'})`;
          break;
        case 'P2021': // tablo yok (şema kayması)
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          mesaj = `Veritabanı tablosu yok: ${(meta as any).table || '—'} — şema güncellenmeli (prisma db push)`;
          break;
        case 'P2022': // kolon yok (şema kayması)
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          mesaj = `Veritabanı kolonu yok: ${(meta as any).column || '—'} — şema güncellenmeli (prisma db push)`;
          break;
        default:
          mesaj = `Veritabanı hatası (${exception.code})`;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      mesaj = 'Geçersiz veri (Prisma doğrulama)';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      mesaj = 'Veritabanına bağlanılamadı';
    } else if (exception instanceof HttpException) {
      // güvenlik için: zaten HTTP ise dokunma
      return res.status(exception.getStatus()).json(exception.getResponse());
    }

    // Tam hatayı loga yaz (Vercel fonksiyon logu) — teşhis için.
    this.logger.error(
      `${kod || 'PRISMA'} → ${mesaj}`,
      exception instanceof Error ? exception.message : String(exception),
    );

    res.status(status).json({ statusCode: status, message: mesaj, kod });
  }
}
