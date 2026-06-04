import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Rol } from '../common/enums';

interface SocketData {
  kullaniciId: string;
  rol: Rol;
  subeIds: string[];
}

/**
 * Şube bazlı yayın yapan WebSocket Gateway'i.
 * Bağlantı: handshake.auth.token zorunlu → JWT doğrulanmazsa disconnect.
 * Join: kullanıcının erişimi olan şubelere izin verilir; aksi halde reddedilir.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: false },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('RealtimeGateway');

  constructor(private jwt: JwtService, private config: ConfigService) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token ||
        (socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');
      if (!token) {
        this.logger.warn(`Token yok, bağlantı reddedildi: ${socket.id}`);
        socket.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        rol: Rol;
        subeIds: string[];
      }>(token, { secret: this.config.get<string>('JWT_SECRET') });
      (socket.data as SocketData) = {
        kullaniciId: payload.sub,
        rol: payload.rol,
        subeIds: payload.subeIds || [],
      };
      this.logger.log(`Bağlandı: ${socket.id} (kullanici=${payload.sub} rol=${payload.rol})`);
    } catch (e) {
      this.logger.warn(`Geçersiz token, bağlantı reddedildi: ${socket.id}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Ayrıldı: ${socket.id}`);
  }

  @SubscribeMessage('join')
  onJoin(@MessageBody() data: { subeId: string }, @ConnectedSocket() socket: Socket) {
    if (!data?.subeId) return { ok: false, hata: 'subeId gerekli' };
    const sd = socket.data as SocketData | undefined;
    if (!sd) {
      socket.disconnect(true);
      return { ok: false, hata: 'auth' };
    }
    // SUPER_ADMIN/FIRMA_ADMIN tüm şubelere katılabilir; diğerleri kendi listesiyle sınırlı.
    const yetkili =
      sd.rol === Rol.SUPER_ADMIN ||
      sd.rol === Rol.FIRMA_ADMIN ||
      sd.subeIds.includes(data.subeId);
    if (!yetkili) {
      this.logger.warn(`Yetkisiz join denemesi: ${sd.kullaniciId} → sube ${data.subeId}`);
      return { ok: false, hata: 'Bu şubeye erişim yetkiniz yok' };
    }
    const oda = `sube:${data.subeId}`;
    for (const r of socket.rooms) {
      if (r.startsWith('sube:')) socket.leave(r);
    }
    socket.join(oda);
    return { ok: true, oda };
  }

  // ─── Yayın yardımcıları ───

  yayinla(subeId: string, olay: string, veri: any) {
    if (!this.server) {
      this.logger.warn(`Socket server hazır değil — ${olay} atlandı`);
      return;
    }
    this.server.to(`sube:${subeId}`).emit(olay, veri);
  }

  yeniSiparis(subeId: string, siparis: any) {
    this.yayinla(subeId, 'siparis:yeni', siparis);
  }

  siparisGuncellendi(subeId: string, siparis: any) {
    this.yayinla(subeId, 'siparis:guncel', siparis);
  }

  adisyonGuncellendi(subeId: string, adisyon: any) {
    this.yayinla(subeId, 'adisyon:guncel', adisyon);
  }

  masaDurumDegisti(subeId: string, masa: any) {
    this.yayinla(subeId, 'masa:guncel', masa);
  }

  odemeAlindi(subeId: string, odeme: any) {
    this.yayinla(subeId, 'odeme:yeni', odeme);
  }
}
