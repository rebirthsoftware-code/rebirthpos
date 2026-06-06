#!/usr/bin/env node
// Rebirth POS — Test verisi seed'i (canlı API üzerinden).
// DB'ye doğrudan değil, admin ile giriş yapıp REST API'den ekler → prod/preview
// fark etmeksizin çalışır. İsim bazlı idempotent: var olanı tekrar oluşturmaz.
//
// Kullanım:
//   node scripts/seed-test-data.mjs
//   BASE=https://rebirthpos.vercel.app/api EPOSTA=admin@rebirth.com SIFRE=admin123 node scripts/seed-test-data.mjs

const BASE = process.env.BASE || 'https://rebirthpos.vercel.app/api';
const EPOSTA = process.env.EPOSTA || 'admin@rebirth.com';
const SIFRE = process.env.SIFRE || 'admin123';

let TOKEN = '';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const metin = await res.text();
  let veri;
  try { veri = metin ? JSON.parse(metin) : null; } catch { veri = metin; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof veri === 'string' ? veri : JSON.stringify(veri)}`);
  }
  return veri;
}

// ── Test verisi tanımları ──
const KATLAR = [
  { ad: 'Zemin Kat', sira: 0 },
  { ad: '1. Kat', sira: 1 },
  { ad: 'Teras', sira: 2 },
  { ad: 'Bahçe', sira: 3 },
];

const KATEGORILER = [
  { ad: 'Çorbalar & Başlangıç', renk: '#f59e0b', ikon: 'fa-bowl-food', sira: 0 },
  { ad: 'Ana Yemekler', renk: '#ef4444', ikon: 'fa-drumstick-bite', sira: 1 },
  { ad: 'Pizzalar', renk: '#f97316', ikon: 'fa-pizza-slice', sira: 2 },
  { ad: 'Burgerler', renk: '#eab308', ikon: 'fa-burger', sira: 3 },
  { ad: 'Makarnalar', renk: '#a855f7', ikon: 'fa-wheat-awn', sira: 4 },
  { ad: 'Salatalar', renk: '#22c55e', ikon: 'fa-leaf', sira: 5 },
  { ad: 'İçecekler', renk: '#3b82f6', ikon: 'fa-glass-water', sira: 6 },
  { ad: 'Sıcak İçecekler', renk: '#b45309', ikon: 'fa-mug-hot', sira: 7 },
  { ad: 'Tatlılar', renk: '#ec4899', ikon: 'fa-ice-cream', sira: 8 },
];

// kategori adı → ürünler [ad, fiyat, aciklama?]
const URUNLER = {
  'Çorbalar & Başlangıç': [
    ['Mercimek Çorbası', 45, 'Geleneksel kırmızı mercimek'],
    ['Ezogelin Çorbası', 50],
    ['Domates Çorbası', 50],
    ['Sigara Böreği (6 adet)', 65, 'Peynirli, çıtır'],
    ['Humus', 70],
    ['Sıcak Başlangıç Tabağı', 120],
  ],
  'Ana Yemekler': [
    ['Izgara Köfte', 180, 'Yanında pilav ve közlenmiş biber'],
    ['Tavuk Şiş', 165],
    ['Adana Kebap', 220],
    ['Urfa Kebap', 220],
    ['Karışık Izgara', 320, '2 kişilik'],
    ['Tavuk Pirzola', 175],
    ['Kuzu Pirzola', 360],
  ],
  'Pizzalar': [
    ['Margarita', 150],
    ['Karışık Pizza', 190],
    ['Sucuklu Pizza', 175],
    ['Ton Balıklı Pizza', 195],
    ['Vejetaryen Pizza', 170],
  ],
  'Burgerler': [
    ['Klasik Burger', 160],
    ['Cheeseburger', 175],
    ['Double Burger', 220],
    ['Tavuk Burger', 150],
    ['Acılı Burger', 185],
  ],
  'Makarnalar': [
    ['Penne Arabiata', 140],
    ['Spaghetti Bolonez', 160],
    ['Fettuccine Alfredo', 165],
    ['Soslu Mantı', 145],
  ],
  'Salatalar': [
    ['Mevsim Salata', 90],
    ['Sezar Salata', 130],
    ['Akdeniz Salata', 110],
    ['Ton Balıklı Salata', 140],
  ],
  'İçecekler': [
    ['Kola', 40],
    ['Ayran', 25],
    ['Su', 15],
    ['Soda', 30],
    ['Limonata', 50],
    ['Meyve Suyu', 45],
    ['Şalgam', 35],
  ],
  'Sıcak İçecekler': [
    ['Çay', 20],
    ['Türk Kahvesi', 45],
    ['Espresso', 50],
    ['Latte', 65],
    ['Cappuccino', 65],
    ['Sıcak Çikolata', 60],
  ],
  'Tatlılar': [
    ['Künefe', 110],
    ['Sütlaç', 70],
    ['Baklava (4 dilim)', 130],
    ['Profiterol', 85],
    ['Cheesecake', 95],
    ['Dondurma (3 top)', 75],
  ],
};

// kat adı → masa ön eki ve adet/kapasite
const MASA_PLANI = [
  { kat: 'Zemin Kat', onek: 'Z', adet: 10, kapasite: 4 },
  { kat: '1. Kat', onek: 'K', adet: 8, kapasite: 4 },
  { kat: 'Teras', onek: 'T', adet: 6, kapasite: 6 },
  { kat: 'Bahçe', onek: 'B', adet: 6, kapasite: 2 },
];

async function main() {
  console.log(`🔐 Giriş: ${EPOSTA} @ ${BASE}`);
  const login = await api('POST', '/auth/login', { eposta: EPOSTA, sifre: SIFRE });
  TOKEN = login.accessToken;
  console.log(`   ✓ ${login.user?.adSoyad} (${login.user?.rol})`);

  const subeler = await api('GET', '/subeler');
  if (!subeler?.length) throw new Error('Hiç şube yok — önce bir şube oluştur.');
  const sube = subeler.find((s) => /merkez/i.test(s.ad)) || subeler[0];
  const subeId = sube.id;
  console.log(`🏢 Şube: ${sube.ad} (${subeId})`);

  // ── Katlar ──
  const mevcutKatlar = await api('GET', `/katlar?subeId=${subeId}`);
  const katMap = new Map(mevcutKatlar.map((k) => [k.ad, k.id]));
  let katEklenen = 0;
  for (const k of KATLAR) {
    if (katMap.has(k.ad)) continue;
    const yeni = await api('POST', '/katlar', { ...k, subeId });
    katMap.set(k.ad, yeni.id);
    katEklenen++;
  }
  console.log(`🏬 Katlar: +${katEklenen} (toplam ${katMap.size})`);

  // ── Kategoriler ──
  const mevcutKat = await api('GET', `/kategoriler?subeId=${subeId}`);
  const katgMap = new Map(mevcutKat.map((c) => [c.ad, c.id]));
  let kategoriEklenen = 0;
  for (const c of KATEGORILER) {
    if (katgMap.has(c.ad)) continue;
    const yeni = await api('POST', '/kategoriler', { ...c, subeId });
    katgMap.set(c.ad, yeni.id);
    kategoriEklenen++;
  }
  console.log(`🗂️  Kategoriler: +${kategoriEklenen} (toplam ${katgMap.size})`);

  // ── Ürünler ──
  const mevcutUrun = await api('GET', `/urunler?subeId=${subeId}`);
  const urunSet = new Set(mevcutUrun.map((u) => u.ad));
  let urunEklenen = 0;
  for (const [katAd, liste] of Object.entries(URUNLER)) {
    const kategoriId = katgMap.get(katAd);
    for (const [ad, fiyat, aciklama] of liste) {
      if (urunSet.has(ad)) continue;
      await api('POST', '/urunler', {
        subeId,
        kategoriId,
        ad,
        fiyat,
        aciklama: aciklama || undefined,
        kdvOrani: 10,
        qrMenudeGoster: true,
        aktif: true,
      });
      urunSet.add(ad);
      urunEklenen++;
    }
  }
  console.log(`🍔 Ürünler: +${urunEklenen} (toplam ${urunSet.size})`);

  // ── Masalar ──
  const mevcutMasa = await api('GET', `/masalar?subeId=${subeId}`);
  const masaSet = new Set(mevcutMasa.map((m) => m.ad));
  let masaEklenen = 0;
  for (const plan of MASA_PLANI) {
    const katId = katMap.get(plan.kat);
    for (let i = 1; i <= plan.adet; i++) {
      const ad = `${plan.onek}${i}`;
      if (masaSet.has(ad)) continue;
      await api('POST', '/masalar', { subeId, ad, kapasite: plan.kapasite, katId });
      masaSet.add(ad);
      masaEklenen++;
    }
  }
  console.log(`🪑 Masalar: +${masaEklenen} (toplam ${masaSet.size})`);

  console.log('\n✅ Test verisi hazır.');
  console.log(`   QR menü:  ${BASE.replace(/\/api$/, '')}/qr/${subeId}`);
}

main().catch((e) => {
  console.error('\n❌ Hata:', e.message);
  process.exit(1);
});
