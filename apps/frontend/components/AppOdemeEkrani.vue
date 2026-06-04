<script setup lang="ts">
import { paraFormat, saatFormat } from '~/utils/format';

type OdemeTip = 'NAKIT' | 'KREDI_KARTI';
type OdemeMod = 'TAM' | 'URUN_SEC' | 'ESIT_BOL' | 'KARMA';
type AktifAlan = 'tutar' | 'verilen' | 'bahsis' | null;

interface Kalem {
  id: string;
  adet: number;
  birimFiyat: string | number;
  toplam: string | number;
  iptal: boolean;
  odenenAdet?: number;
  urun: { id: string; ad: string };
}

interface Siparis {
  kalemler: Kalem[];
}

interface Adisyon {
  id: string;
  numara: string;
  araToplam: string | number;
  iskontoTutar: string | number;
  toplamTutar: string | number;
  acilis: string;
  masa?: { ad: string } | null;
  siparisler: Siparis[];
  odemeler: { tutar: string | number; iptal: boolean }[];
}

const props = defineProps<{
  acik: boolean;
  adisyon: Adisyon | null;
}>();

const emit = defineEmits<{
  kapat: [];
  tamamlandi: [];
  // Kısmi ödeme alındı, ekran kapanmadan parent adisyon'u yenilemeli.
  yenile: [];
}>();

const toast = useToastStore();
const musteri = useMusteriEkran();

const mod = ref<OdemeMod>('TAM');
const tip = ref<OdemeTip>('NAKIT');
const tutar = ref(0);
const verilen = ref(0);
const bahsis = ref(0);
const kisiSayisi = ref(2);
// kalemId → bu ödemede seçilen adet sayısı. Önceden Set<string> idi (tüm kalem
// veya hiç) — split-bill için per-adet seçime geçirildi: 3 pizzanın 1'i seçilebilir.
const secilenKalemler = ref<Map<string, number>>(new Map());
const karmaParcalar = ref<Array<{ tip: OdemeTip; tutar: number }>>([]);
const karmaAktifIndex = ref<number | null>(null);
const islemde = ref(false);
const aktifAlan = ref<AktifAlan>('tutar');
const oturumId = ref('');

function yeniKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const tumKalemler = computed<Kalem[]>(() => {
  if (!props.adisyon) return [];
  return props.adisyon.siparisler.flatMap((s) => s.kalemler.filter((k) => !k.iptal));
});

// Henüz ödenmemiş adet kalan kalemler — fully paid olanlar listede gösterilmez.
const kalanKalemler = computed<Kalem[]>(() =>
  tumKalemler.value.filter((k) => k.adet - (k.odenenAdet || 0) > 0),
);

function kalemKalanAdet(k: Kalem): number {
  return k.adet - (k.odenenAdet || 0);
}

const odenmis = computed(() =>
  (props.adisyon?.odemeler || []).filter((o) => !o.iptal).reduce((a, o) => a + Number(o.tutar), 0),
);

const kalan = computed(() =>
  Math.max(0, Number(props.adisyon?.toplamTutar || 0) - odenmis.value),
);

const secilenToplam = computed(() => {
  let t = 0;
  for (const k of tumKalemler.value) {
    const sec = secilenKalemler.value.get(k.id) || 0;
    if (sec > 0) t += Number(k.birimFiyat) * sec;
  }
  return t;
});

// Toplam seçili birim sayısı — "2 / 5 birim seçili" gibi göstermek için
const secilenAdetToplam = computed(() => {
  let n = 0;
  for (const v of secilenKalemler.value.values()) n += v;
  return n;
});

// Tüm kalemlerin ödenmemiş toplam adet sayısı
const kalanAdetToplam = computed(() =>
  kalanKalemler.value.reduce((a, k) => a + kalemKalanAdet(k), 0),
);

const paraUstu = computed(() => Math.max(0, verilen.value - tutar.value));
const karmaToplam = computed(() => karmaParcalar.value.reduce((a, p) => a + Number(p.tutar || 0), 0));
const karmaFark = computed(() => Number((kalan.value - karmaToplam.value).toFixed(2)));

const odemeTipleri: { tip: OdemeTip; ad: string; ikon: string; renk: string }[] = [
  { tip: 'NAKIT', ad: 'Nakit', ikon: 'fa-money-bill-wave', renk: 'emerald' },
  { tip: 'KREDI_KARTI', ad: 'Kredi Kartı', ikon: 'fa-credit-card', renk: 'blue' },
];

const hizliTutarlar = [50, 100, 200, 500, 1000];

watch(
  () => props.acik,
  (a) => {
    if (a && props.adisyon) {
      mod.value = 'TAM';
      tip.value = 'NAKIT';
      tutar.value = Number(kalan.value.toFixed(2));
      verilen.value = Number(kalan.value.toFixed(2));
      bahsis.value = 0;
      kisiSayisi.value = 2;
      secilenKalemler.value = new Map();
      karmaParcalar.value = [
        { tip: 'NAKIT', tutar: Number((kalan.value / 2).toFixed(2)) },
        { tip: 'KREDI_KARTI', tutar: Number((kalan.value / 2).toFixed(2)) },
      ];
      karmaAktifIndex.value = null;
      oturumId.value = yeniKey();
      aktifAlan.value = 'tutar';
      fisDurumu.value = 'beklemede';
      fis.value = null;
      fisHata.value = '';
      oturumKartSlipleri.value = [];
      // Müşteri ekranı: adisyon bilgilerini ve ödeme durumunu yayımla.
      // Modal kapanınca temizlenir — kasiyer adisyon detayda gezerken
      // müşteri ekranı logo/hoş geldiniz ekranında kalır.
      musteri.aktifAdisyonYaz(props.adisyon.id);
      musteri.odemeDurumuYaz({
        toplam: tutar.value,
        alinan: verilen.value,
        paraUstu: 0,
        tip: tip.value,
        mod: mod.value,
        masaAd: props.adisyon.masa?.ad ?? null,
        adisyonNo: props.adisyon.numara,
      });
    } else if (!a) {
      musteri.odemeDurumuTemizle();
      musteri.aktifAdisyonTemizle();
      musteri.kartIslemiTemizle();
    }
    if (import.meta.client) {
      document.body.style.overflow = a ? 'hidden' : '';
    }
  },
);

// Tutar/alınan değiştikçe müşteri ekranını güncelle
watch([tutar, verilen, bahsis, tip, mod, karmaToplam], () => {
  if (!props.acik || !props.adisyon) return;
  const toplamGosterilecek = mod.value === 'KARMA' ? karmaToplam.value : tutar.value;
  musteri.odemeDurumuYaz({
    toplam: toplamGosterilecek,
    alinan: verilen.value,
    paraUstu: paraUstu.value,
    tip: tip.value,
    mod: mod.value,
    masaAd: props.adisyon.masa?.ad ?? null,
    adisyonNo: props.adisyon.numara,
  });
});

// Müşteri ekranı yeni açılırsa "şu anki state'i yeniden yaz" ister.
// Modal acık ve adisyon yüklüyse, broadcast'leri yeniden yapıyoruz.
let yenilemeAbone: (() => void) | null = null;
onMounted(() => {
  yenilemeAbone = musteri.yenilemeIsteklerineCevapla(() => {
    if (!props.acik || !props.adisyon) return;
    musteri.aktifAdisyonYaz(props.adisyon.id);
    const toplamGosterilecek = mod.value === 'KARMA' ? karmaToplam.value : tutar.value;
    musteri.odemeDurumuYaz({
      toplam: toplamGosterilecek,
      alinan: verilen.value,
      paraUstu: paraUstu.value,
      tip: tip.value,
      mod: mod.value,
      masaAd: props.adisyon.masa?.ad ?? null,
      adisyonNo: props.adisyon.numara,
    });
  });
});

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = '';
  musteri.odemeDurumuTemizle();
  musteri.aktifAdisyonTemizle();
  musteri.kartIslemiTemizle();
  yenilemeAbone?.();
});

watch(mod, (m) => {
  if (m === 'TAM') tutar.value = Number(kalan.value.toFixed(2));
  else if (m === 'ESIT_BOL') tutar.value = Number((kalan.value / Math.max(1, kisiSayisi.value)).toFixed(2));
  else if (m === 'URUN_SEC') tutar.value = Number(secilenToplam.value.toFixed(2));
  if (tip.value === 'NAKIT') verilen.value = tutar.value;
  aktifAlan.value = m === 'KARMA' ? null : 'tutar';
});

watch(kisiSayisi, () => {
  if (mod.value === 'ESIT_BOL') {
    tutar.value = Number((kalan.value / Math.max(1, kisiSayisi.value)).toFixed(2));
    if (tip.value === 'NAKIT') verilen.value = tutar.value;
  }
});

watch(tutar, (yeni) => {
  if (tip.value === 'NAKIT' && verilen.value < yeni) verilen.value = yeni;
});

function kalemAdetDegistir(k: Kalem, delta: number) {
  const kalanAdet = kalemKalanAdet(k);
  const mevcut = secilenKalemler.value.get(k.id) || 0;
  const yeni = Math.max(0, Math.min(kalanAdet, mevcut + delta));
  if (yeni === 0) secilenKalemler.value.delete(k.id);
  else secilenKalemler.value.set(k.id, yeni);
  // Map mutasyonu reaktif tetiklemek için yeni referans
  secilenKalemler.value = new Map(secilenKalemler.value);
  if (mod.value === 'URUN_SEC') {
    tutar.value = Number(secilenToplam.value.toFixed(2));
    if (tip.value === 'NAKIT') verilen.value = tutar.value;
  }
}

function tumKalemleriSec() {
  if (secilenAdetToplam.value === kalanAdetToplam.value) {
    secilenKalemler.value = new Map();
  } else {
    const m = new Map<string, number>();
    for (const k of kalanKalemler.value) m.set(k.id, kalemKalanAdet(k));
    secilenKalemler.value = m;
  }
  tutar.value = Number(secilenToplam.value.toFixed(2));
  if (tip.value === 'NAKIT') verilen.value = tutar.value;
}

function yuvarla(adim: 1 | 5 | 10) {
  tutar.value = Math.ceil(tutar.value / adim) * adim;
  if (tip.value === 'NAKIT' && verilen.value < tutar.value) verilen.value = tutar.value;
}

function bahsisYuzde(yuzde: number) {
  bahsis.value = Number(((Number(props.adisyon?.toplamTutar || 0) * yuzde) / 100).toFixed(2));
}

function karmaSonaEkle() {
  if (!karmaParcalar.value.length) return;
  const son = karmaParcalar.value[karmaParcalar.value.length - 1];
  son.tutar = Number((Number(son.tutar) + karmaFark.value).toFixed(2));
}

// ── Sayısal klavye (kalıcı) ──
function alanGuncelle(d: number) {
  if (mod.value === 'KARMA' && karmaAktifIndex.value !== null) {
    const idx = karmaAktifIndex.value;
    if (karmaParcalar.value[idx]) karmaParcalar.value[idx].tutar = d;
    return;
  }
  if (aktifAlan.value === 'verilen') verilen.value = d;
  else if (aktifAlan.value === 'bahsis') bahsis.value = d;
  else if (aktifAlan.value === 'tutar') {
    tutar.value = d;
    if (tip.value === 'NAKIT' && verilen.value < d) verilen.value = d;
  }
}
function alanDeger(): number {
  if (mod.value === 'KARMA' && karmaAktifIndex.value !== null) {
    const idx = karmaAktifIndex.value;
    return Number(karmaParcalar.value[idx]?.tutar ?? 0);
  }
  if (aktifAlan.value === 'verilen') return verilen.value || 0;
  if (aktifAlan.value === 'bahsis') return bahsis.value || 0;
  return tutar.value || 0;
}
function tusBas(t: string) {
  const mevcut = alanDeger();
  const str = mevcut.toString();
  if (t === '←') {
    const yeni = str.length > 1 ? str.slice(0, -1) : '0';
    alanGuncelle(Number(yeni));
    return;
  }
  if (t === 'C') {
    alanGuncelle(0);
    return;
  }
  if (t === '.') {
    if (!str.includes('.')) alanGuncelle(Number(str + '.'));
    return;
  }
  if (str === '0') alanGuncelle(Number(t));
  else alanGuncelle(Number(str + t));
}

function alanSec(alan: AktifAlan) {
  aktifAlan.value = alan;
  karmaAktifIndex.value = null;
}
function karmaSec(i: number) {
  karmaAktifIndex.value = i;
  aktifAlan.value = null;
}

interface FisBilgisi {
  fisNo: string;
  fisTarihi: string | Date | null;
  marka: string;
  kdvDokumu?: Array<{ oran: number; matrah: number; kdv: number }>;
  toplamTutar?: number;
  zatenKesildi?: boolean;
  odemeTip?: string;
  // Bu fişe bağlı kart slip bilgisi (varsa)
  kartMeta?: KartYaniti | null;
}

interface KartYaniti {
  basarili: boolean;
  slipNo?: string;
  rrn?: string;
  banka?: string;
  sonRakam?: string;
  onayKod?: string;
  terminalMarka?: string;
  hata?: string;
}

const fisDurumu = ref<'beklemede' | 'uretiliyor' | 'basarili' | 'hata'>('beklemede');
const fisHata = ref<string>('');
const fis = ref<FisBilgisi | null>(null);
// Bu işlem oturumunda kesilen tüm fişler (her ödeme = 1 fiş)
const fisListesi = ref<FisBilgisi[]>([]);
// Tam ödeme miydi snapshot — Tamam butonunda modal'ı kapatıp yönlendireceğiz
const fisOverlayKapaniyor = ref(false);

// Kart işlem state
const kartDurumu = ref<'beklemede' | 'cekiliyor' | 'basarili' | 'red'>('beklemede');
const kartTutar = ref(0);
const kartYanit = ref<KartYaniti | null>(null);
const kartHata = ref<string>('');

// Bu ödeme oturumunda alınan başarılı kart slipleri — final fiş overlay'inde
// "Banka Slip" bölümünde gösterilir (hibrit yazarkasa-POS gibi tek kağıt).
const oturumKartSlipleri = ref<Array<KartYaniti & { tutar: number }>>([]);

/**
 * Atomik kart ödemesi: backend validate → POS çek → Odeme kaydı tek istekte.
 * POS başarılı ama DB başarısız olursa backend otomatik iade çağırır,
 * mali tutarsızlık doğmaz. Eski iki-aşamalı akış (poskart/cek + odemeler)
 * artık kullanılmıyor — POS çekilip sonra reddedilme bug'ı bu yüzden çıktı.
 */
async function kartlaOdeAtomik(
  tutar: number,
  referans: string,
  idempotencyKey: string,
  bahsis = 0,
  odenenKalemler?: Array<{ kalemId: string; adet: number }>,
): Promise<{ odeme: { id: string }; kartMeta: KartYaniti }> {
  kartTutar.value = tutar;
  kartDurumu.value = 'cekiliyor';
  kartHata.value = '';
  kartYanit.value = null;
  musteri.kartIslemiYaz({ durum: 'cekiliyor', tutar });
  try {
    const sonuc = await apiFetch<{ odeme: { id: string }; kartMeta: KartYaniti }>(
      '/odemeler/kartla-ode',
      {
        method: 'POST',
        body: {
          adisyonId: props.adisyon!.id,
          tutar,
          bahsis,
          referans,
          idempotencyKey,
          ...(odenenKalemler?.length ? { odenenKalemler } : {}),
        },
      },
    );
    kartYanit.value = sonuc.kartMeta;
    kartDurumu.value = 'basarili';
    musteri.kartIslemiYaz({
      durum: 'basarili',
      tutar,
      slipNo: sonuc.kartMeta.slipNo,
      banka: sonuc.kartMeta.banka,
      sonRakam: sonuc.kartMeta.sonRakam,
    });
    oturumKartSlipleri.value.push({ ...sonuc.kartMeta, tutar });
    await new Promise((r) => setTimeout(r, 600));
    return sonuc;
  } catch (e: any) {
    kartDurumu.value = 'red';
    kartHata.value = e?.data?.message || 'Kart işlemi reddedildi';
    musteri.kartIslemiYaz({ durum: 'red', tutar, hata: kartHata.value });
    throw e;
  }
}

function kartOverlayKapat() {
  kartDurumu.value = 'beklemede';
  kartYanit.value = null;
  kartHata.value = '';
  musteri.kartIslemiTemizle();
}

/**
 * Tek bir ödeme için ÖKC fişi kes — yeni akış (ödeme bazlı).
 * Restoran split-bill senaryosu için her ödeme kendi mali fişine sahip:
 * 27000₺ adisyonda 26820 KART + 180 NAKİT → 2 ayrı fiş, her birinin KDV'si
 * orantısal.
 */
async function odemeFisiKes(odemeId: string, kartMeta?: KartYaniti | null): Promise<FisBilgisi | null> {
  try {
    const sonuc = await apiFetch<FisBilgisi>(`/okc/odeme-fis/${odemeId}`, {
      method: 'POST',
    });
    // Kart slip'ini fişe iliştir (UI'da birleşik göstermek için)
    if (kartMeta) sonuc.kartMeta = kartMeta;
    return sonuc;
  } catch (e: any) {
    toast.hata(`Fiş kesilemedi: ${e?.data?.message || 'bilinmiyor'}`);
    return null;
  }
}

// Bu ödemede kapatılacak miktar (mod bazlı)
const odenecekMiktar = computed(() => {
  if (mod.value === 'KARMA') {
    return karmaParcalar.value
      .filter((p) => p.tutar > 0)
      .reduce((a, p) => a + Number(p.tutar), 0);
  }
  return Number(tutar.value || 0);
});

// Bu ödeme adisyonu tamamen kapatacak mı?
const tamOdeme = computed(() => odenecekMiktar.value >= kalan.value - 0.005);

// Bu ödemeden sonra kalacak bakiye
const kalacakBakiye = computed(() =>
  Math.max(0, Number((kalan.value - odenecekMiktar.value).toFixed(2))),
);

/**
 * Kısmi ödeme sonrası modal state'ini yeni kalan üzerinden sıfırlar.
 * Modal açık kalır; kullanıcı bir sonraki parçayı hemen alabilir.
 */
function modalIcindekiSifirla() {
  if (!props.adisyon) return;
  mod.value = 'TAM';
  tutar.value = Number(kalan.value.toFixed(2));
  verilen.value = Number(kalan.value.toFixed(2));
  bahsis.value = 0;
  kisiSayisi.value = 2;
  secilenKalemler.value = new Map();
  karmaParcalar.value = [
    { tip: 'NAKIT', tutar: Number((kalan.value / 2).toFixed(2)) },
    { tip: 'KREDI_KARTI', tutar: Number((kalan.value / 2).toFixed(2)) },
  ];
  karmaAktifIndex.value = null;
  oturumId.value = yeniKey();
  aktifAlan.value = 'tutar';
}

async function tamamla() {
  if (!props.adisyon || islemde.value) return;
  if (!tamamlanabilir.value) return;
  islemde.value = true;

  const tamOdemeSnapshot = tamOdeme.value;
  const kalanSonra = kalacakBakiye.value;
  const adisyonNo = props.adisyon.numara;

  // Bu işlem oturumunda kesilen fişler — overlay'da liste olarak gösterilecek
  const olusanFisler: FisBilgisi[] = [];

  try {
    if (mod.value === 'KARMA') {
      const aktif = karmaParcalar.value.filter((p) => p.tutar > 0);
      if (!aktif.length) {
        toast.uyari('En az bir parça gir');
        return;
      }
      for (let i = 0; i < aktif.length; i++) {
        const p = aktif[i];
        let odemeId: string;
        let kartMeta: KartYaniti | null = null;
        if (p.tip === 'KREDI_KARTI') {
          // Atomik: POS + Odeme tek istekte; reddedilirse para çekilmez
          const sonuc = await kartlaOdeAtomik(
            Number(p.tutar),
            `${adisyonNo}-${i + 1}`,
            `${oturumId.value}-${i}`,
          );
          kartOverlayKapat();
          odemeId = sonuc.odeme.id;
          kartMeta = sonuc.kartMeta;
        } else {
          const odeme = await apiFetch<{ id: string }>('/odemeler', {
            method: 'POST',
            body: {
              adisyonId: props.adisyon.id,
              tip: p.tip,
              tutar: Number(p.tutar),
              idempotencyKey: `${oturumId.value}-${i}`,
            },
          });
          odemeId = odeme.id;
        }
        // Bu ödeme için kendi mali fişini kes (KDV orantısal)
        const fisYanit = await odemeFisiKes(odemeId, kartMeta);
        if (fisYanit) olusanFisler.push(fisYanit);
      }
    } else {
      // Tek tip ödeme. URUN_SEC ise hangi kalemlerin kaç adedi ödendiğini ilet.
      const odenenKalemler =
        mod.value === 'URUN_SEC'
          ? Array.from(secilenKalemler.value.entries())
              .filter(([, adet]) => adet > 0)
              .map(([kalemId, adet]) => ({ kalemId, adet }))
          : undefined;
      let odemeId: string;
      let kartMeta: KartYaniti | null = null;
      if (tip.value === 'KREDI_KARTI') {
        const sonuc = await kartlaOdeAtomik(
          Number(tutar.value),
          adisyonNo,
          oturumId.value,
          Number(bahsis.value) || 0,
          odenenKalemler,
        );
        kartOverlayKapat();
        odemeId = sonuc.odeme.id;
        kartMeta = sonuc.kartMeta;
      } else {
        const odeme = await apiFetch<{ id: string }>('/odemeler', {
          method: 'POST',
          body: {
            adisyonId: props.adisyon.id,
            tip: tip.value,
            tutar: Number(tutar.value),
            bahsis: Number(bahsis.value) || 0,
            idempotencyKey: oturumId.value,
            ...(odenenKalemler?.length ? { odenenKalemler } : {}),
          },
        });
        odemeId = odeme.id;
      }
      const fisYanit = await odemeFisiKes(odemeId, kartMeta);
      if (fisYanit) olusanFisler.push(fisYanit);
    }

    // Fiş(ler) hazır → overlay göster
    if (olusanFisler.length) {
      fisListesi.value = olusanFisler;
      fis.value = olusanFisler[olusanFisler.length - 1]; // overlay başlıkta son fiş
      fisDurumu.value = 'basarili';
      fisOverlayKapaniyor.value = tamOdemeSnapshot;
    }

    if (tamOdemeSnapshot) {
      toast.basari(`Tahsilat tamamlandı · ${olusanFisler.length} fiş`, '✓');
      musteri.tesekkurGoster(6);
      emit('yenile');
      // Overlay açık kalır; Tamam → emit('kapat') → modal kapanır
    } else {
      toast.basari(
        `Kısmi ödeme alındı · Fiş kesildi · Kalan ${paraFormat(kalanSonra)}`,
        '✓',
      );
      emit('yenile');
      // Tamam'da modalIcindekiSifirla çağrılır (fisOverlayKapaniyor=false)
    }
  } catch (e: any) {
    if (kartDurumu.value !== 'red') {
      toast.hata(e?.data?.message || 'Ödeme alınamadı');
    }
  } finally {
    islemde.value = false;
  }
}

/**
 * Fiş overlay'inin "Tamam" butonu — tam ödemede modal kapat, kısmi ödemede
 * modal'da kal, bir sonraki parça için sıfırla.
 */
async function fisOverlayTamam() {
  fisDurumu.value = 'beklemede';
  fis.value = null;
  fisListesi.value = [];
  if (fisOverlayKapaniyor.value) {
    fisOverlayKapaniyor.value = false;
    emit('kapat');
  } else {
    // Kısmi ödeme → modal devam, state sıfırla
    await new Promise((r) => setTimeout(r, 200));
    modalIcindekiSifirla();
  }
}

// Kalan bakiyeyi aşan ödemeler kasten engellenir: aksi halde POS terminale
// fazla tutar gider, banka çeker, backend reddeder, mali tutarsızlık doğar.
// 0.005 tolerans Decimal yuvarlama farklarını yutmak için.
const tutarFazla = computed(() => {
  if (mod.value === 'KARMA') return karmaToplam.value > kalan.value + 0.005;
  return tutar.value > kalan.value + 0.005;
});

const tamamlanabilir = computed(() => {
  if (tutarFazla.value) return false;
  if (mod.value === 'KARMA') return karmaToplam.value > 0;
  return tutar.value > 0;
});

const odenecekTutarLabel = computed(() => {
  if (mod.value === 'KARMA') return paraFormat(karmaToplam.value);
  return paraFormat(tutar.value);
});

const modlar: { kod: OdemeMod; ad: string; ikon: string; aciklama: string }[] = [
  { kod: 'TAM', ad: 'Tam Tutar', ikon: 'fa-coins', aciklama: 'Kalanın tamamı' },
  { kod: 'URUN_SEC', ad: 'Ürün Seç', ikon: 'fa-list-check', aciklama: 'Belirli kalemler' },
  { kod: 'ESIT_BOL', ad: 'Eşit Böl', ikon: 'fa-divide', aciklama: 'Kişi başı' },
  { kod: 'KARMA', ad: 'Karma', ikon: 'fa-layer-group', aciklama: 'Çoklu yöntem' },
];

// Klavye layout: 7-8-9 / 4-5-6 / 1-2-3 / 00-0-.
const klavyeTuslari = ['7','8','9','4','5','6','1','2','3','00','0','.'];

const aktifAlanEtiket = computed(() => {
  if (mod.value === 'KARMA' && karmaAktifIndex.value !== null) {
    return `Parça ${karmaAktifIndex.value + 1}`;
  }
  if (aktifAlan.value === 'verilen') return 'Alınan';
  if (aktifAlan.value === 'bahsis') return 'Bahşiş';
  return 'Tutar';
});

const aktifAlanDeger = computed(() => alanDeger());

// Hızlı tutar ekleme (numpad altı) — aktif alana ekler
function hizliEkle(t: number) {
  alanGuncelle(t);
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300"
      leave-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="acik && adisyon"
        class="fixed inset-0 z-[55] bg-ink-50 flex flex-col"
        style="background-image: radial-gradient(circle at 10% 40%, rgba(200,154,42,0.12) 0%, transparent 35%), radial-gradient(circle at 90% 70%, rgba(230,196,82,0.08) 0%, transparent 30%), linear-gradient(180deg, #fbfbfc 0%, #f3f3f6 100%)"
      >
        <!-- ÜST ÇUBUK -->
        <header class="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-pearl-10 bg-ink-100/70 backdrop-blur-xl shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <button
              @click="emit('kapat')"
              class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl glass-card hover:bg-glass-hover transition flex items-center justify-center text-pearl-70 shrink-0 no-tap-highlight"
              title="Kapat (Esc)"
            >
              <i class="fas fa-times text-lg" />
            </button>
            <div class="min-w-0">
              <div class="text-[10px] sm:text-[11px] text-pearl-50 uppercase tracking-extra-wide font-semibold">Ödeme</div>
              <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                <h1 class="text-base sm:text-xl font-medium gold-text truncate">
                  <i class="fas fa-table mr-1.5 text-gold-primary/60" v-if="adisyon.masa" />
                  {{ adisyon.masa?.ad || 'Masasız' }}
                </h1>
                <span class="hidden sm:inline text-xs text-pearl-50 truncate tabular">{{ adisyon.numara }} · {{ saatFormat(adisyon.acilis) }}</span>
              </div>
            </div>
          </div>

          <!-- Kalan büyük -->
          <div class="flex items-center gap-3 sm:gap-5 shrink-0">
            <div class="hidden md:flex flex-col items-end">
              <div class="text-[10px] text-pearl-50 uppercase tracking-extra-wide font-semibold">Toplam</div>
              <div class="text-sm text-pearl-70 tabular">{{ paraFormat(adisyon.toplamTutar) }}</div>
            </div>
            <div class="hidden md:flex flex-col items-end">
              <div class="text-[10px] text-pearl-50 uppercase tracking-extra-wide font-semibold">Ödenen</div>
              <div class="text-sm text-emerald-300 tabular">{{ paraFormat(odenmis) }}</div>
            </div>
            <div class="hidden md:block w-px h-10 bg-pearl-10" />
            <div class="text-right">
              <div class="text-[9px] sm:text-[10px] text-pearl-50 uppercase tracking-extra-wide font-semibold leading-none">Kalan</div>
              <div class="text-2xl sm:text-3xl font-light gold-text-shimmer tabular leading-tight">{{ paraFormat(kalan) }}</div>
            </div>
          </div>
        </header>

        <!-- İÇERİK: 3 sütun (mod + numpad + özet) -->
        <div class="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_360px_320px] xl:grid-cols-[1fr_400px_360px]">
          <!-- SOL: Mod ayarları + içerik -->
          <section class="overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 pb-[calc(env(safe-area-inset-bottom)+22rem)] lg:pb-8">
            <!-- Mod sekmeleri -->
            <div class="grid grid-cols-4 gap-2 sm:gap-3 mb-6">
              <button
                v-for="m in modlar"
                :key="m.kod"
                @click="mod = m.kod"
                :class="[
                  'group p-3 sm:p-4 lg:p-5 rounded-2xl text-center sm:text-left transition-all border-2 relative overflow-hidden no-tap-highlight',
                  mod === m.kod
                    ? 'bg-gold-primary/10 border-gold-primary/50 shadow-[0_10px_30px_-12px_rgba(212,175,55,0.45)]'
                    : 'border-pearl-10 hover:border-gold-primary/30 hover:bg-pearl-5',
                ]"
              >
                <span
                  v-if="mod === m.kod"
                  class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent"
                />
                <i :class="['fas', m.ikon, 'text-xl sm:text-2xl mb-1.5 sm:mb-3 block transition-transform group-hover:scale-110', mod === m.kod ? 'text-gold-primary' : 'text-pearl-50']" />
                <div :class="['font-semibold text-xs sm:text-sm', mod === m.kod ? 'text-gold-primary' : 'text-pearl-70']">{{ m.ad }}</div>
                <div class="hidden sm:block text-[10px] sm:text-[11px] text-pearl-50 mt-0.5 truncate">{{ m.aciklama }}</div>
              </button>
            </div>

            <!-- TAM TUTAR -->
            <div v-if="mod === 'TAM'" class="space-y-5">
              <!-- Tutar kartı -->
              <button
                @click="alanSec('tutar')"
                :class="[
                  'w-full rounded-3xl transition-all p-5 sm:p-6 relative overflow-hidden border-2 text-left no-tap-highlight',
                  aktifAlan === 'tutar'
                    ? 'border-gold-primary/60 bg-gold-primary/5 shadow-[0_0_40px_-12px_rgba(212,175,55,0.5)]'
                    : 'border-pearl-10 hover:border-pearl-30'
                ]"
              >
                <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-primary/40 to-transparent" />
                <div class="text-[10px] sm:text-xs text-pearl-50 uppercase tracking-extra-wide font-semibold mb-2 flex items-center gap-2">
                  <span v-if="aktifAlan === 'tutar'" class="status-dot-gold" />
                  Ödenecek Tutar
                </div>
                <div class="text-4xl sm:text-5xl lg:text-6xl font-extralight gold-text-shimmer tabular leading-none">
                  {{ paraFormat(tutar) }}
                </div>
              </button>

              <!-- Yuvarla / kalanı al -->
              <div class="grid grid-cols-4 gap-2">
                <button @click="yuvarla(1)" class="glass-card py-2.5 text-xs hover:bg-glass-hover transition no-tap-highlight">
                  <i class="fas fa-arrow-up text-gold-primary mr-1" />₺1
                </button>
                <button @click="yuvarla(5)" class="glass-card py-2.5 text-xs hover:bg-glass-hover transition no-tap-highlight">
                  <i class="fas fa-arrow-up text-gold-primary mr-1" />₺5
                </button>
                <button @click="yuvarla(10)" class="glass-card py-2.5 text-xs hover:bg-glass-hover transition no-tap-highlight">
                  <i class="fas fa-arrow-up text-gold-primary mr-1" />₺10
                </button>
                <button @click="tutar = kalan; verilen = kalan; alanSec('tutar')" class="glass-card py-2.5 text-xs hover:bg-glass-hover transition text-gold-primary no-tap-highlight">
                  <i class="fas fa-rotate-left mr-1" />Kalanı
                </button>
              </div>

              <!-- Nakit kartı (alınan + para üstü) -->
              <div v-if="tip === 'NAKIT'" class="space-y-3">
                <button
                  @click="alanSec('verilen')"
                  :class="[
                    'w-full rounded-2xl transition-all p-4 sm:p-5 border-2 text-left no-tap-highlight relative overflow-hidden',
                    aktifAlan === 'verilen'
                      ? 'border-emerald-500/50 bg-emerald-500/8 shadow-[0_0_30px_-12px_rgba(52,211,153,0.5)]'
                      : 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
                  ]"
                >
                  <div class="text-[10px] text-pearl-60 uppercase tracking-extra-wide font-semibold flex items-center gap-2 mb-1">
                    <span v-if="aktifAlan === 'verilen'" class="status-dot-emerald" />
                    Müşteriden Alınan
                  </div>
                  <div class="text-2xl sm:text-3xl font-light text-pearl tabular">{{ paraFormat(verilen) }}</div>
                </button>

                <div class="grid grid-cols-5 gap-1.5">
                  <button
                    v-for="t in hizliTutarlar"
                    :key="t"
                    @click="verilen = t"
                    class="glass-card py-2 text-[11px] sm:text-xs hover:bg-glass-hover transition tabular no-tap-highlight"
                  >₺{{ t }}</button>
                </div>

                <div
                  v-if="paraUstu > 0"
                  class="rounded-2xl border-2 border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-5 text-center relative overflow-hidden"
                >
                  <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                  <div class="text-[10px] text-emerald-300/80 uppercase tracking-extra-wide font-semibold mb-1">Para Üstü</div>
                  <div class="text-3xl sm:text-4xl font-light text-emerald-300 tabular">{{ paraFormat(paraUstu) }}</div>
                </div>
              </div>

              <!-- Bahşiş -->
              <div class="glass-card p-4 sm:p-5">
                <button
                  @click="alanSec('bahsis')"
                  class="w-full flex items-center justify-between mb-3 no-tap-highlight"
                >
                  <span class="text-sm font-medium text-pearl-70 flex items-center gap-2">
                    <i class="fas fa-hand-holding-heart text-gold-primary" />Bahşiş
                  </span>
                  <span :class="['text-base font-semibold tabular', aktifAlan === 'bahsis' ? 'gold-text-shimmer' : 'gold-text']">{{ paraFormat(bahsis) }}</span>
                </button>
                <div class="grid grid-cols-4 gap-2">
                  <button @click="bahsisYuzde(5)" class="glass-card py-2 text-xs hover:bg-glass-hover transition no-tap-highlight">+%5</button>
                  <button @click="bahsisYuzde(10)" class="glass-card py-2 text-xs hover:bg-glass-hover transition no-tap-highlight">+%10</button>
                  <button @click="bahsisYuzde(15)" class="glass-card py-2 text-xs hover:bg-glass-hover transition no-tap-highlight">+%15</button>
                  <button @click="bahsis = 0" class="glass-card py-2 text-xs hover:bg-glass-hover transition no-tap-highlight">Sıfırla</button>
                </div>
              </div>
            </div>

            <!-- ÜRÜN SEÇ — split bill: her kalem için adet bazlı seçim -->
            <div v-else-if="mod === 'URUN_SEC'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-pearl-70">Ödenecek Kalemler</div>
                  <div class="text-xs text-pearl-50 tabular">{{ secilenAdetToplam }} / {{ kalanAdetToplam }} adet seçili</div>
                </div>
                <button
                  v-if="kalanKalemler.length"
                  @click="tumKalemleriSec"
                  class="text-sm text-gold-primary hover:underline font-medium"
                >
                  {{ secilenAdetToplam === kalanAdetToplam ? 'Hiçbiri' : 'Tümünü Seç' }}
                </button>
              </div>

              <div v-if="!kalanKalemler.length" class="glass-card p-6 text-center text-pearl-60 text-sm">
                Tüm kalemler ödendi.
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="k in kalanKalemler"
                  :key="k.id"
                  class="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl border-2 transition"
                  :class="
                    (secilenKalemler.get(k.id) || 0) > 0
                      ? 'bg-gold-primary/10 border-gold-primary/40'
                      : 'border-pearl-10'
                  "
                >
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm sm:text-base truncate">{{ k.urun.ad }}</div>
                    <div class="text-[10px] sm:text-xs text-pearl-50 tabular">
                      {{ paraFormat(k.birimFiyat) }}/adet
                      <span v-if="(k.odenenAdet || 0) > 0" class="ml-2 text-pearl-40">· {{ k.odenenAdet }}/{{ k.adet }} ödendi</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      @click="kalemAdetDegistir(k, -1)"
                      :disabled="(secilenKalemler.get(k.id) || 0) <= 0"
                      class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-card hover:bg-glass-hover transition text-gold-primary text-lg active:scale-95 no-tap-highlight disabled:opacity-30 disabled:cursor-not-allowed"
                    >−</button>
                    <div class="w-10 sm:w-12 text-center font-bold text-base sm:text-lg tabular">
                      {{ secilenKalemler.get(k.id) || 0 }}
                      <span class="text-pearl-50 text-xs font-normal">/{{ kalemKalanAdet(k) }}</span>
                    </div>
                    <button
                      @click="kalemAdetDegistir(k, +1)"
                      :disabled="(secilenKalemler.get(k.id) || 0) >= kalemKalanAdet(k)"
                      class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-card hover:bg-glass-hover transition text-gold-primary text-lg active:scale-95 no-tap-highlight disabled:opacity-30 disabled:cursor-not-allowed"
                    >+</button>
                  </div>
                  <div class="font-bold text-sm sm:text-base gold-text shrink-0 tabular w-20 sm:w-24 text-right">
                    {{ paraFormat(Number(k.birimFiyat) * (secilenKalemler.get(k.id) || 0)) }}
                  </div>
                </div>
              </div>

              <div v-if="secilenAdetToplam > 0" class="glass-card p-4 sm:p-5 flex items-center justify-between border-gold-primary/30 bg-gold-primary/5">
                <span class="text-sm text-pearl-70">Seçim Toplamı</span>
                <span class="text-xl sm:text-2xl font-bold gold-text-shimmer tabular">{{ paraFormat(secilenToplam) }}</span>
              </div>
            </div>

            <!-- EŞİT BÖL -->
            <div v-else-if="mod === 'ESIT_BOL'" class="space-y-5">
              <div class="text-center py-4 sm:py-6">
                <div class="text-[10px] sm:text-xs text-pearl-50 uppercase tracking-extra-wide mb-3 sm:mb-4 font-semibold">Kişi Sayısı</div>
                <div class="flex items-center justify-center gap-3 sm:gap-4">
                  <button
                    @click="kisiSayisi = Math.max(2, kisiSayisi - 1)"
                    class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl glass-card hover:bg-glass-hover transition text-gold-primary text-2xl active:scale-95 no-tap-highlight"
                  >−</button>
                  <div class="text-5xl sm:text-6xl font-light gold-text-shimmer w-28 sm:w-32 tabular">
                    {{ kisiSayisi }}
                  </div>
                  <button
                    @click="kisiSayisi++"
                    class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl glass-card hover:bg-glass-hover transition text-gold-primary text-2xl active:scale-95 no-tap-highlight"
                  >+</button>
                </div>
              </div>

              <div class="glass-card p-5 sm:p-6 text-center border-gold-primary/30 bg-gold-primary/5 relative overflow-hidden">
                <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright/60 to-transparent" />
                <div class="text-[10px] sm:text-xs text-pearl-50 uppercase tracking-extra-wide mb-2 font-semibold">Kişi Başı</div>
                <div class="text-3xl sm:text-4xl font-light gold-text-shimmer tabular">{{ paraFormat(kalan / Math.max(1, kisiSayisi)) }}</div>
              </div>

              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="n in [2, 3, 4, 5, 6]"
                  :key="n"
                  @click="kisiSayisi = n"
                  :class="[
                    'glass-card py-2.5 sm:py-3 text-sm hover:bg-glass-hover transition no-tap-highlight',
                    kisiSayisi === n && 'border-gold-primary/40 text-gold-primary bg-gold-primary/5'
                  ]"
                >
                  {{ n }}
                </button>
              </div>
            </div>

            <!-- KARMA -->
            <div v-else-if="mod === 'KARMA'" class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-pearl-70">Ödeme Parçaları</div>
                  <div class="text-xs text-pearl-50">Birden fazla yöntemle ödeme</div>
                </div>
                <button
                  @click="karmaParcalar.push({ tip: 'KREDI_KARTI', tutar: 0 })"
                  class="text-sm text-gold-primary hover:underline font-medium"
                >
                  <i class="fas fa-plus mr-1" />Parça Ekle
                </button>
              </div>

              <div class="space-y-2.5 sm:space-y-3">
                <div
                  v-for="(p, i) in karmaParcalar"
                  :key="i"
                  :class="[
                    'glass-card p-3 sm:p-4 grid grid-cols-[auto_1fr_auto_auto] gap-2 sm:gap-3 items-center transition border-2',
                    karmaAktifIndex === i ? 'border-gold-primary/50 bg-gold-primary/5' : 'border-pearl-10'
                  ]"
                >
                  <div class="w-9 h-9 rounded-xl bg-gold-primary/15 text-gold-primary flex items-center justify-center font-bold shrink-0 text-sm tabular">
                    {{ i + 1 }}
                  </div>
                  <select v-model="p.tip" class="input-base !py-2 text-sm">
                    <option v-for="o in odemeTipleri" :key="o.tip" :value="o.tip">{{ o.ad }}</option>
                  </select>
                  <button
                    @click="karmaSec(i)"
                    :class="[
                      'min-w-[7rem] sm:min-w-[8rem] px-3 py-2 rounded-xl text-right text-base sm:text-lg font-semibold tabular border-2 transition no-tap-highlight',
                      karmaAktifIndex === i
                        ? 'border-gold-primary/60 bg-gold-primary/10 text-gold-primary'
                        : 'border-pearl-20 bg-pearl-5 hover:border-pearl-30'
                    ]"
                  >
                    {{ paraFormat(p.tutar) }}
                  </button>
                  <button
                    @click="karmaParcalar.splice(i, 1)"
                    :disabled="karmaParcalar.length <= 1"
                    class="text-pearl-50 hover:text-red-300 disabled:opacity-30 transition w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-500/5 no-tap-highlight"
                  >
                    <i class="fas fa-trash" />
                  </button>
                </div>
              </div>

              <div
                :class="[
                  'glass-card p-4 flex items-center justify-between',
                  Math.abs(karmaFark) < 0.01 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
                ]"
              >
                <div class="min-w-0">
                  <div class="text-[10px] text-pearl-60 uppercase tracking-extra-wide font-semibold">Girilen / Hedef</div>
                  <div :class="['font-bold text-base sm:text-lg tabular truncate', Math.abs(karmaFark) < 0.01 ? 'text-emerald-300' : 'text-amber-300']">
                    {{ paraFormat(karmaToplam) }} / {{ paraFormat(kalan) }}
                  </div>
                </div>
                <div v-if="Math.abs(karmaFark) >= 0.01" class="text-right shrink-0 ml-2">
                  <div class="text-[10px] text-amber-300 mb-1 tabular">Fark: {{ paraFormat(Math.abs(karmaFark)) }}</div>
                  <button @click="karmaSonaEkle" class="text-xs text-gold-primary hover:underline whitespace-nowrap font-medium">
                    Son parçaya ekle →
                  </button>
                </div>
                <div v-else class="text-emerald-300 text-sm font-semibold shrink-0 ml-2 flex items-center gap-1.5">
                  <i class="fas fa-check-circle" />Tam
                </div>
              </div>
            </div>
          </section>

          <!-- ORTA: KALICI NUMPAD (büyük dokunmatik) -->
          <aside
            class="hidden lg:flex flex-col border-l border-pearl-10 bg-ink-100/60 backdrop-blur-xl p-5 xl:p-6 overflow-y-auto"
          >
            <!-- Aktif alan göstergesi -->
            <div class="mb-4 rounded-2xl border-2 border-gold-primary/30 bg-gold-primary/5 p-4 relative overflow-hidden">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright/60 to-transparent" />
              <div class="text-[10px] text-pearl-50 uppercase tracking-extra-wide font-semibold flex items-center gap-2 mb-1">
                <span class="status-dot-gold" />
                Aktif Giriş: {{ aktifAlanEtiket }}
              </div>
              <div class="text-3xl xl:text-4xl font-light gold-text-shimmer tabular leading-tight">
                {{ paraFormat(aktifAlanDeger) }}
              </div>
            </div>

            <!-- Klavye 3×4 -->
            <div class="grid grid-cols-3 gap-2 sm:gap-2.5 mb-3">
              <button
                v-for="t in klavyeTuslari"
                :key="t"
                @click="tusBas(t)"
                class="aspect-[5/4] xl:aspect-[6/5] rounded-2xl bg-gradient-to-b from-pearl-10 to-pearl-5 border border-pearl-10 text-pearl text-2xl xl:text-3xl font-medium hover:from-gold-primary/15 hover:to-gold-primary/5 hover:border-gold-primary/40 hover:text-gold-primary active:scale-[0.96] transition-all tabular relative overflow-hidden no-tap-highlight"
              >
                <span class="relative z-10">{{ t }}</span>
              </button>
            </div>

            <!-- Backspace + Temizle -->
            <div class="grid grid-cols-2 gap-2 sm:gap-2.5 mb-3">
              <button
                @click="tusBas('←')"
                class="py-3 xl:py-4 rounded-2xl bg-gradient-to-b from-pearl-10 to-pearl-5 border border-pearl-10 text-pearl-70 hover:from-amber-500/15 hover:to-amber-500/5 hover:text-amber-300 hover:border-amber-500/30 active:scale-[0.96] transition-all no-tap-highlight"
              >
                <i class="fas fa-delete-left text-xl" />
              </button>
              <button
                @click="tusBas('C')"
                class="py-3 xl:py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/15 active:scale-[0.96] transition-all text-sm font-medium no-tap-highlight"
              >
                <i class="fas fa-eraser mr-1.5" />Temizle
              </button>
            </div>

            <!-- Hızlı tutar (numpad altı) -->
            <div class="mt-auto pt-4">
              <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-2 font-semibold">Hızlı Tutar</div>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="t in hizliTutarlar"
                  :key="t"
                  @click="hizliEkle(t)"
                  class="py-2 rounded-lg bg-pearl-5 border border-pearl-10 hover:bg-gold-primary/10 hover:border-gold-primary/30 hover:text-gold-primary transition text-xs tabular no-tap-highlight"
                >₺{{ t }}</button>
              </div>
            </div>
          </aside>

          <!-- SAĞ: Özet + Ödeme Tipi + Tamamla (desktop) -->
          <aside class="hidden lg:flex flex-col border-l border-pearl-10 bg-ink-100/40 backdrop-blur-xl">
            <div class="flex-1 overflow-y-auto p-5 xl:p-6 space-y-5">
              <!-- Ödeme Tipi -->
              <div v-if="mod !== 'KARMA'">
                <div class="text-[10px] text-pearl-50 uppercase tracking-extra-wide mb-3 font-semibold">Ödeme Tipi</div>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="o in odemeTipleri"
                    :key="o.tip"
                    @click="tip = o.tip; if (o.tip === 'NAKIT') verilen = tutar"
                    :class="[
                      'p-3 rounded-xl border-2 transition text-center no-tap-highlight',
                      tip === o.tip
                        ? `bg-${o.renk}-500/15 border-${o.renk}-500/50 text-${o.renk}-300`
                        : 'border-pearl-10 text-pearl-60 hover:border-pearl-30',
                    ]"
                  >
                    <i :class="['fas', o.ikon, 'text-xl block mb-1.5']" />
                    <div class="text-[11px] font-medium">{{ o.ad }}</div>
                  </button>
                </div>
              </div>

              <!-- Özet -->
              <div class="space-y-2 text-sm">
                <div class="flex justify-between text-pearl-60">
                  <span>Ara Toplam</span>
                  <span class="tabular">{{ paraFormat(adisyon.araToplam) }}</span>
                </div>
                <div v-if="Number(adisyon.iskontoTutar) > 0" class="flex justify-between text-amber-300">
                  <span>İskonto</span>
                  <span class="tabular">− {{ paraFormat(adisyon.iskontoTutar) }}</span>
                </div>
                <div v-if="bahsis > 0" class="flex justify-between text-emerald-300">
                  <span>Bahşiş</span>
                  <span class="tabular">+ {{ paraFormat(bahsis) }}</span>
                </div>
                <div v-if="odenmis > 0" class="flex justify-between text-emerald-300">
                  <span>Önceden Ödenen</span>
                  <span class="tabular">− {{ paraFormat(odenmis) }}</span>
                </div>
                <div class="flex justify-between pt-3 border-t border-pearl-10">
                  <span class="text-pearl-70 font-medium">Kalan Bakiye</span>
                  <span class="font-bold gold-text tabular">{{ paraFormat(kalan) }}</span>
                </div>
              </div>
            </div>

            <div class="p-5 xl:p-6 border-t border-pearl-10 bg-ink-100/60 space-y-3">
              <!-- Kalan bakiyeyi aşma uyarısı — buton bu durumda disable -->
              <div
                v-if="tutarFazla"
                class="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 flex items-center gap-2.5 text-xs"
              >
                <i class="fas fa-triangle-exclamation text-red-300" />
                <div class="flex-1 min-w-0">
                  <div class="text-red-300 font-semibold">Tutar kalan bakiyeyi aşıyor</div>
                  <div class="text-pearl-60 tabular">
                    Kalan: <span class="text-red-300 font-medium">{{ paraFormat(kalan) }}</span>
                  </div>
                </div>
              </div>

              <!-- Kısmi ödeme bilgilendirme şeridi -->
              <div
                v-if="tamamlanabilir && !tamOdeme"
                class="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2.5 text-xs"
              >
                <i class="fas fa-circle-info text-amber-300" />
                <div class="flex-1 min-w-0">
                  <div class="text-amber-300 font-semibold">Kısmi ödeme</div>
                  <div class="text-pearl-60 tabular">
                    Bu ödemeden sonra kalan: <span class="text-amber-300 font-medium">{{ paraFormat(kalacakBakiye) }}</span>
                  </div>
                </div>
              </div>

              <button
                @click="tamamla"
                :disabled="islemde || !tamamlanabilir"
                class="w-full btn-gold !py-5 !text-lg"
              >
                <span v-if="islemde">
                  <i class="fas fa-spinner fa-spin mr-2" />İşleniyor…
                </span>
                <span v-else class="flex items-center justify-center gap-2">
                  <i :class="['fas', tamOdeme ? 'fa-check' : 'fa-coins']" />
                  <span>{{ tamOdeme ? 'Tamamla & Fiş Kes' : 'Kısmi Öde' }}</span>
                  <span class="opacity-75 tabular">· {{ odenecekTutarLabel }}</span>
                </span>
              </button>
            </div>
          </aside>
        </div>

        <!-- MOBİL/TABLET ALT PANEL — numpad + ödeme tipi + tamamla -->
        <aside class="lg:hidden bg-ink-200/95 backdrop-blur-xl border-t border-pearl-10 shadow-soft-up fixed bottom-0 left-0 right-0 z-40">
          <div class="px-3 sm:px-4 py-3 space-y-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <!-- Aktif alan değeri (kompakt) -->
            <div class="flex items-center justify-between gap-2">
              <div class="text-[10px] text-pearl-50 uppercase tracking-extra-wide font-semibold flex items-center gap-1.5">
                <span class="status-dot-gold" />
                {{ aktifAlanEtiket }}
              </div>
              <div class="text-lg font-light gold-text-shimmer tabular">{{ paraFormat(aktifAlanDeger) }}</div>
            </div>

            <!-- Klavye 3×4 (mobil kompakt) -->
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="t in klavyeTuslari"
                :key="t"
                @click="tusBas(t)"
                class="py-3 rounded-xl bg-gradient-to-b from-pearl-10 to-pearl-5 border border-pearl-10 text-pearl text-lg font-medium hover:bg-pearl-10 active:scale-95 transition tabular no-tap-highlight"
              >{{ t }}</button>
              <button
                @click="tusBas('←')"
                class="py-3 rounded-xl bg-pearl-5 border border-pearl-10 text-pearl-70 active:scale-95 transition no-tap-highlight"
              ><i class="fas fa-delete-left" /></button>
              <button
                @click="tusBas('C')"
                class="py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 active:scale-95 transition text-xs font-medium no-tap-highlight"
              ><i class="fas fa-eraser mr-1" />Temizle</button>
              <button
                @click="tamamla"
                :disabled="islemde || !tamamlanabilir"
                class="btn-gold !py-3 !text-sm !rounded-xl"
              >
                <span v-if="islemde"><i class="fas fa-spinner fa-spin" /></span>
                <span v-else>
                  <i :class="['fas mr-1', tamOdeme ? 'fa-check' : 'fa-coins']" />
                  {{ tamOdeme ? 'Tamamla' : 'Kısmi Öde' }}
                </span>
              </button>
            </div>

            <!-- Mobil: tutar fazla uyarısı -->
            <div
              v-if="tutarFazla"
              class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 flex items-center gap-2 text-[11px]"
            >
              <i class="fas fa-triangle-exclamation text-red-300 shrink-0" />
              <div class="flex-1 min-w-0">
                <span class="text-red-300 font-semibold">Tutar kalanı aşıyor.</span>
                <span class="text-pearl-60 tabular ml-1">Kalan: {{ paraFormat(kalan) }}</span>
              </div>
            </div>

            <!-- Mobil: kısmi ödeme uyarısı (numpad altı) -->
            <div
              v-if="tamamlanabilir && !tamOdeme"
              class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-center gap-2 text-[11px]"
            >
              <i class="fas fa-circle-info text-amber-300 shrink-0" />
              <div class="flex-1 text-pearl-70 tabular">
                Kısmi ödeme · sonra kalan: <span class="text-amber-300 font-medium">{{ paraFormat(kalacakBakiye) }}</span>
              </div>
            </div>

            <!-- Ödeme tipi (mobil) -->
            <div v-if="mod !== 'KARMA'" class="grid grid-cols-2 gap-1.5">
              <button
                v-for="o in odemeTipleri"
                :key="o.tip"
                @click="tip = o.tip; if (o.tip === 'NAKIT') verilen = tutar"
                :class="[
                  'p-2 rounded-xl border-2 transition text-center no-tap-highlight',
                  tip === o.tip
                    ? `bg-${o.renk}-500/15 border-${o.renk}-500/50 text-${o.renk}-300`
                    : 'border-pearl-10 text-pearl-60',
                ]"
              >
                <i :class="['fas', o.ikon, 'text-base block mb-0.5']" />
                <div class="text-[10px] font-medium leading-tight">{{ o.ad }}</div>
              </button>
            </div>
          </div>
        </aside>

        <!-- KART İŞLEM OVERLAY (POS terminali) -->
        <Transition
          enter-active-class="transition duration-300 ease-luxe"
          leave-active-class="transition duration-200"
          enter-from-class="opacity-0"
          leave-to-class="opacity-0"
        >
          <div
            v-if="kartDurumu !== 'beklemede'"
            class="absolute inset-0 z-[68] bg-pearl-60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div class="glass-card max-w-md w-full p-8 text-center relative overflow-hidden">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent" />

              <!-- ÇEKİLİYOR -->
              <div v-if="kartDurumu === 'cekiliyor'">
                <div class="relative w-32 h-32 mx-auto mb-6">
                  <!-- POS cihazı görseli -->
                  <div class="absolute inset-0 rounded-3xl bg-gradient-to-br from-ink-300 to-ink-200 border border-gold-primary/30 flex items-center justify-center">
                    <i class="fas fa-credit-card text-5xl text-gold-primary" />
                  </div>
                  <!-- Kart yaklaşma animasyonu -->
                  <div class="absolute -top-3 -right-3 w-12 h-8 rounded-md bg-gradient-to-br from-pearl-30 to-pearl-10 border border-pearl-40 animate-float shadow-lg" />
                  <!-- Pulse ring -->
                  <div class="absolute inset-0 rounded-3xl border-2 border-gold-primary/40 animate-ping" />
                  <div class="absolute -inset-2 rounded-[1.75rem] border border-gold-primary/20 animate-pulse-gold" />
                </div>

                <div class="text-[11px] uppercase tracking-extra-wide text-gold-bright font-semibold mb-2">
                  POS Terminal İşliyor
                </div>
                <h3 class="text-xl font-light text-pearl mb-2">Kartı POS cihazına yaklaştırın</h3>
                <div class="text-3xl font-extralight gold-text-shimmer tabular mb-6">
                  {{ paraFormat(kartTutar) }}
                </div>

                <div class="flex items-center justify-center gap-2 text-xs text-pearl-50">
                  <i class="fas fa-spinner fa-spin text-gold-primary/60" />
                  <span>Banka onayı bekleniyor…</span>
                </div>
              </div>

              <!-- BAŞARILI -->
              <div v-else-if="kartDurumu === 'basarili' && kartYanit">
                <div class="relative w-20 h-20 mx-auto mb-5">
                  <div class="absolute inset-0 rounded-full bg-emerald-500/15 border-2 border-emerald-400 flex items-center justify-center">
                    <i class="fas fa-check text-3xl text-emerald-300" />
                  </div>
                  <div class="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
                </div>
                <div class="text-[10px] uppercase tracking-extra-wide text-emerald-300/80 font-semibold mb-2">
                  Onaylandı
                </div>
                <div class="text-2xl font-light gold-text mb-4 tabular">{{ paraFormat(kartTutar) }}</div>
                <div class="text-xs text-pearl-60 space-y-1 mb-4">
                  <div v-if="kartYanit.banka" class="flex justify-between gap-3 pb-1 border-b border-pearl-10">
                    <span class="text-pearl-50">Banka</span>
                    <span class="text-pearl-80 font-medium">{{ kartYanit.banka }}</span>
                  </div>
                  <div v-if="kartYanit.sonRakam" class="flex justify-between gap-3 pb-1 border-b border-pearl-10">
                    <span class="text-pearl-50">Kart</span>
                    <span class="text-pearl-80 font-mono tabular">•••• {{ kartYanit.sonRakam }}</span>
                  </div>
                  <div v-if="kartYanit.slipNo" class="flex justify-between gap-3 pb-1 border-b border-pearl-10">
                    <span class="text-pearl-50">Slip No</span>
                    <span class="text-gold-primary font-mono tabular">{{ kartYanit.slipNo }}</span>
                  </div>
                </div>
              </div>

              <!-- RED -->
              <div v-else-if="kartDurumu === 'red'">
                <div class="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-400 flex items-center justify-center mx-auto mb-5">
                  <i class="fas fa-times text-3xl text-red-300" />
                </div>
                <div class="text-[10px] uppercase tracking-extra-wide text-red-300/80 font-semibold mb-2">
                  İşlem Reddedildi
                </div>
                <h3 class="text-xl font-light text-pearl mb-2">Kart Kabul Edilmedi</h3>
                <div class="text-2xl font-light gold-text tabular mb-3">{{ paraFormat(kartTutar) }}</div>
                <p class="text-sm text-pearl-60 mb-5">{{ kartHata || 'POS terminali işlemi reddetti.' }}</p>
                <div class="flex gap-3">
                  <button
                    @click="kartOverlayKapat(); tamamla()"
                    class="btn-gold flex-1"
                  >
                    <i class="fas fa-rotate-right mr-2" />Tekrar Dene
                  </button>
                  <button @click="kartOverlayKapat" class="btn-ghost flex-1">
                    İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- ÖKC FİŞ DURUM OVERLAY -->
        <div
          v-if="fisDurumu !== 'beklemede'"
          class="absolute inset-0 z-[70] bg-pearl-60 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div class="glass-card max-w-md w-full p-6 sm:p-8 text-center">
            <div v-if="fisDurumu === 'uretiliyor'">
              <div class="w-16 h-16 rounded-full border-4 border-gold-primary border-t-transparent animate-spin mx-auto mb-6" />
              <h3 class="text-lg sm:text-xl font-bold text-pearl mb-2">Fiş üretiliyor</h3>
              <p class="text-sm text-pearl-60">ÖKC cihazına satış bilgisi gönderiliyor…</p>
            </div>

            <div v-else-if="fisDurumu === 'basarili' && fisListesi.length">
              <div class="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mx-auto mb-5">
                <i class="fas fa-check text-2xl text-emerald-600" />
              </div>
              <h3 class="text-lg sm:text-xl font-bold text-pearl mb-1">
                {{ fisListesi.length > 1 ? `${fisListesi.length} Fiş Kesildi` : 'Fiş Kesildi' }}
              </h3>
              <p class="text-xs text-pearl-60 mb-5">
                Her ödeme kendi mali fişini aldı · KDV oransal dağıtıldı
              </p>

              <!-- Her fiş için ayrı kart — kayar liste -->
              <div class="space-y-4 max-h-[55vh] overflow-y-auto -mx-2 px-2 mb-5">
                <div
                  v-for="(f, fi) in fisListesi"
                  :key="fi"
                  class="text-left bg-white border-2 border-gold-primary/30 rounded-2xl p-4 shadow-md"
                >
                  <!-- Fiş başlık: tip rozeti + tutar -->
                  <div class="flex items-center justify-between mb-3 pb-3 border-b border-pearl-10">
                    <span
                      :class="[
                        'badge !text-[10px]',
                        f.odemeTip === 'NAKIT' ? 'badge-success' : f.odemeTip === 'KREDI_KARTI' ? 'badge-info' : 'badge-gold'
                      ]"
                    >
                      <i :class="['fas mr-1', f.odemeTip === 'NAKIT' ? 'fa-money-bill-wave' : 'fa-credit-card']" />
                      {{ f.odemeTip === 'NAKIT' ? 'Nakit' : f.odemeTip === 'KREDI_KARTI' ? 'Kredi Kartı' : f.odemeTip }}
                    </span>
                    <div class="text-xl font-bold gold-text tabular">{{ paraFormat(f.toplamTutar || 0) }}</div>
                  </div>

                  <!-- Fiş no -->
                  <div class="text-center mb-3">
                    <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Mali Fiş No</div>
                    <div class="text-lg font-mono text-gold-dark tracking-wider break-all">{{ f.fisNo }}</div>
                    <div class="text-[10px] text-pearl-50 mt-0.5">
                      {{ f.marka }} · {{ f.fisTarihi ? new Date(f.fisTarihi).toLocaleString('tr-TR') : '' }}
                    </div>
                  </div>

                  <!-- KDV Dökümü (orantısal) -->
                  <div v-if="f.kdvDokumu?.length" class="bg-pearl-5 rounded-xl p-2.5 mb-3 text-xs">
                    <div class="text-[10px] text-pearl-50 uppercase tracking-extra-wide mb-1.5 font-semibold">KDV Dökümü (Orantısal)</div>
                    <div
                      v-for="d in f.kdvDokumu"
                      :key="d.oran"
                      class="grid grid-cols-[auto_1fr_auto_1fr] gap-2 py-1 border-b border-pearl-10/40 last:border-0"
                    >
                      <span class="text-pearl-70">%{{ d.oran }}</span>
                      <span class="font-mono text-pearl text-right tabular">{{ paraFormat(d.matrah) }}</span>
                      <span class="text-pearl-70">KDV</span>
                      <span class="font-mono text-gold-dark text-right tabular">{{ paraFormat(d.kdv) }}</span>
                    </div>
                  </div>

                  <!-- Banka slip (sadece kart ödemesinde) -->
                  <div
                    v-if="f.kartMeta && f.kartMeta.slipNo"
                    class="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs"
                  >
                    <div class="text-[10px] text-blue-700 uppercase tracking-extra-wide mb-1.5 font-semibold flex items-center gap-1.5">
                      <i class="fas fa-credit-card" />Banka Slip
                    </div>
                    <div class="space-y-0.5">
                      <div class="flex justify-between">
                        <span class="text-blue-700 font-semibold">{{ f.kartMeta.banka || 'Banka' }}</span>
                        <span class="font-mono tabular text-pearl">{{ paraFormat(f.toplamTutar || 0) }}</span>
                      </div>
                      <div class="flex justify-between text-pearl-70">
                        <span>Kart No</span>
                        <span class="font-mono tabular">•••• •••• •••• {{ f.kartMeta.sonRakam || '••••' }}</span>
                      </div>
                      <div class="flex justify-between text-pearl-70">
                        <span>Slip No</span>
                        <span class="font-mono tabular text-blue-700">{{ f.kartMeta.slipNo }}</span>
                      </div>
                      <div v-if="f.kartMeta.onayKod" class="flex justify-between text-pearl-70">
                        <span>Onay</span>
                        <span class="font-mono tabular">{{ f.kartMeta.onayKod }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button @click="fisOverlayTamam" class="btn-gold">
                <i class="fas fa-check mr-2" />{{ fisOverlayKapaniyor ? 'Tamam · Kapat' : 'Tamam · Sonraki Ödeme' }}
              </button>
            </div>

            <div v-else-if="fisDurumu === 'hata'">
              <div class="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto mb-6">
                <i class="fas fa-exclamation-triangle text-2xl text-red-600" />
              </div>
              <h3 class="text-lg sm:text-xl font-bold text-pearl mb-2">Fiş üretilemedi</h3>
              <p class="text-sm text-pearl-60 mb-1">{{ fisHata }}</p>
              <p class="text-xs text-pearl-50 mb-5 sm:mb-6">
                Tahsilat alındı. Fişi sonradan tekrar deneyebilirsiniz.
              </p>
              <button
                @click="fisDurumu = 'beklemede'; emit('kapat');"
                class="btn-ghost"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
