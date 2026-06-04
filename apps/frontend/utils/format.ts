export function paraFormat(deger: number | string | null | undefined, sembol = '₺'): string {
  const n = Number(deger || 0);
  return `${sembol}${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function gecenSure(tarih: Date | string): string {
  const fark = Math.floor((Date.now() - new Date(tarih).getTime()) / 1000);
  if (fark < 60) return `${fark}s`;
  if (fark < 3600) return `${Math.floor(fark / 60)}dk`;
  if (fark < 86400) return `${Math.floor(fark / 3600)}sa ${Math.floor((fark % 3600) / 60)}dk`;
  return `${Math.floor(fark / 86400)}g`;
}

export function saatFormat(tarih: Date | string): string {
  return new Date(tarih).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
