import 'server-only';
import QRCode from 'qrcode';
import { headers } from 'next/headers';

/** İsteğin geldiği adrese göre sitenin kök URL'si (QR kodları için) */
export async function siteUrl(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3100';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function qrSvg(metin: string, koyu = '#1f3a2b', acik = '#fbf6ec'): Promise<string> {
  return QRCode.toString(metin, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: koyu, light: acik } });
}
