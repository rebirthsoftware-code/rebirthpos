import 'server-only';

// Basit bellek içi hız sınırı (tek sunucu / sıcak serverless örneği için yeterli ön koruma).
// Asıl gönderi sınırı veritabanında, cihaz + IP özetine göre uygulanır.
const kovalar = new Map<string, number[]>();

export function hizSiniri(anahtar: string, adet: number, saniye: number): boolean {
  const simdi = Date.now();
  const liste = (kovalar.get(anahtar) ?? []).filter((t) => simdi - t < saniye * 1000);
  if (liste.length >= adet) {
    kovalar.set(anahtar, liste);
    return false;
  }
  liste.push(simdi);
  kovalar.set(anahtar, liste);
  if (kovalar.size > 5000) for (const [k, v] of kovalar) if (!v.some((t) => simdi - t < 3600_000)) kovalar.delete(k);
  return true;
}
