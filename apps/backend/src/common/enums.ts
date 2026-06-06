// SQLite enum desteklemediği için Prisma'da String tuttuk.
// Bu sabitler tüm kod tabanında tip güvenliği için kullanılır.
// Postgres'e geçtiğimizde Prisma enum'a dönüştürebiliriz.

export const Rol = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FIRMA_ADMIN: 'FIRMA_ADMIN',
  SUBE_MUDURU: 'SUBE_MUDURU',
  KASIYER: 'KASIYER',
  GARSON: 'GARSON',
  MUTFAK: 'MUTFAK',
  KURYE: 'KURYE',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

export const MasaDurum = {
  BOS: 'BOS',
  DOLU: 'DOLU',
  REZERVE: 'REZERVE',
  ODEME_BEKLIYOR: 'ODEME_BEKLIYOR',
} as const;
export type MasaDurum = (typeof MasaDurum)[keyof typeof MasaDurum];

export const AdisyonDurum = {
  ACIK: 'ACIK',
  ODEME_BEKLIYOR: 'ODEME_BEKLIYOR',
  KAPALI: 'KAPALI',
  IPTAL: 'IPTAL',
} as const;
export type AdisyonDurum = (typeof AdisyonDurum)[keyof typeof AdisyonDurum];

export const SiparisDurum = {
  ALINDI: 'ALINDI',
  HAZIRLANIYOR: 'HAZIRLANIYOR',
  HAZIR: 'HAZIR',
  TESLIM_EDILDI: 'TESLIM_EDILDI',
  IPTAL: 'IPTAL',
} as const;
export type SiparisDurum = (typeof SiparisDurum)[keyof typeof SiparisDurum];

export const OdemeTipi = {
  NAKIT: 'NAKIT',
  KREDI_KARTI: 'KREDI_KARTI',
  // SANAL_POS: QR menüden PayTR sanal pos ile alınan online kart ödemesi.
  SANAL_POS: 'SANAL_POS',
  YEMEKSEPETI: 'YEMEKSEPETI',
  TICKET: 'TICKET',
} as const;
export type OdemeTipi = (typeof OdemeTipi)[keyof typeof OdemeTipi];

// Yönetici rolleri — finansal/yapısal değişiklik yapabilenler.
// KASIYER/GARSON/MUTFAK/KURYE bu listede yok; gündelik POS akışları dışında
// işlem yapamazlar (ürün ekleme, iskonto, ödeme iptali, adisyon iptali vb).
export const YONETICI_ROLLER = [
  Rol.SUPER_ADMIN,
  Rol.FIRMA_ADMIN,
  Rol.SUBE_MUDURU,
] as const;
