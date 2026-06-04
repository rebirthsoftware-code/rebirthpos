import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Rol } from '../common/enums';

export interface JwtPayload {
  sub: string;
  rol: Rol;
  subeIds: string[];
}

/**
 * Refresh token DB'de plaintext değil SHA-256 hash olarak saklanır.
 * - DB sızıntısında token'lar doğrudan kullanılamaz.
 * - Hash deterministik → refresh sırasında tek sorguyla bulunur.
 * - JWT imzası ek katman: secret rotation tüm token'ları invalidate eder.
 */
function tokenHashle(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(eposta: string, sifre: string) {
    const kullanici = await this.prisma.kullanici.findUnique({
      where: { eposta },
      include: { subeler: true },
    });

    if (!kullanici || !kullanici.aktif) {
      throw new UnauthorizedException('Geçersiz e-posta veya şifre');
    }

    const dogru = await bcrypt.compare(sifre, kullanici.sifreHash);
    if (!dogru) {
      throw new UnauthorizedException('Geçersiz e-posta veya şifre');
    }

    await this.prisma.kullanici.update({
      where: { id: kullanici.id },
      data: { sonGiris: new Date() },
    });

    const subeIds = kullanici.subeler.map((s) => s.subeId);
    return this.tokenUret(kullanici.id, kullanici.rol as Rol, subeIds, {
      adSoyad: kullanici.adSoyad,
      eposta: kullanici.eposta,
      rol: kullanici.rol as Rol,
    });
  }

  async refresh(refreshToken: string) {
    // 1) JWT imzasını doğrula — secret değişmişse fail eder (global secret rotation)
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token geçersiz');
    }

    // 2) DB'de hash ile ara — eski kayıt (rotation sonrası iptal edilmiş) ya da
    // saldırgan tarafından yeniden kullanılan token reddedilir.
    const hash = tokenHashle(refreshToken);
    const kayit = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { kullanici: { include: { subeler: true } } },
    });

    if (!kayit || kayit.iptal || kayit.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token geçersiz');
    }
    if (kayit.kullaniciId !== payload.sub) {
      throw new UnauthorizedException('Refresh token sahibi uyuşmuyor');
    }

    // 3) Rotation: bu token'ı tüket, yeni çift üret
    await this.prisma.refreshToken.update({
      where: { id: kayit.id },
      data: { iptal: true },
    });

    const subeIds = kayit.kullanici.subeler.map((s) => s.subeId);
    return this.tokenUret(kayit.kullanici.id, kayit.kullanici.rol as Rol, subeIds, {
      adSoyad: kayit.kullanici.adSoyad,
      eposta: kayit.kullanici.eposta,
      rol: kayit.kullanici.rol as Rol,
    });
  }

  private async tokenUret(
    kullaniciId: string,
    rol: Rol,
    subeIds: string[],
    user: { adSoyad: string; eposta: string; rol: Rol },
  ) {
    const payload: JwtPayload = { sub: kullaniciId, rol, subeIds };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    // jti her seferinde farklı — aynı saniyede iki refresh aynı token üretmesin.
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { kullaniciId, tokenHash: tokenHashle(refreshToken), expiresAt },
    });

    return { accessToken, refreshToken, user };
  }
}
