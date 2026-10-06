export function goreliZaman(iso: string, simdi = Date.now()): string {
  const fark = (simdi - new Date(iso).getTime()) / 1000;
  if (fark < 60) return 'az önce';
  if (fark < 3600) return `${Math.floor(fark / 60)} dk önce`;
  if (fark < 86400) return `${Math.floor(fark / 3600)} saat önce`;
  if (fark < 604800) return `${Math.floor(fark / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
