// Barkodlu Stok & Satış — HTTP sunucusu (ek paket yok, sadece Node 22+)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { islem, hepsi, tek, calistir } = require('./db');

const PORT = Number(process.env.PORT || 4100);
const PUBLIC = path.join(__dirname, 'public');

class HttpHata extends Error {
  constructor(kod, mesaj) { super(mesaj); this.kod = kod; }
}

// ---------- yardımcılar ----------
const yuvarla = (n) => Math.round(Number(n) * 100) / 100;
const sayi = (v, varsayilan = 0) => {
  if (v === undefined || v === null || v === '') return varsayilan;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) throw new HttpHata(400, `Geçersiz sayı: ${v}`);
  return n;
};

// EAN-13 kontrol hanesi
function ean13Kontrol(ilk12) {
  let t = 0;
  for (let i = 0; i < 12; i++) t += Number(ilk12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (t % 10)) % 10);
}

// Mağaza içi barkod: "2" ile başlayan EAN-13 (dünya genelinde iç kullanıma ayrılmış aralık)
function yeniBarkod() {
  const r = tek(`SELECT deger FROM ayarlar WHERE anahtar = 'barkod_sayac'`);
  let sayac = r ? Number(r.deger) : 0;
  let barkod;
  do {
    sayac++;
    const ilk12 = '2' + '00' + String(sayac).padStart(9, '0');
    barkod = ilk12 + ean13Kontrol(ilk12);
  } while (tek('SELECT id FROM urunler WHERE barkod = ?', barkod));
  calistir(
    `INSERT INTO ayarlar(anahtar, deger) VALUES('barkod_sayac', ?)
     ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger`,
    String(sayac),
  );
  return barkod;
}

function urunBul(id) {
  const u = tek('SELECT * FROM urunler WHERE id = ?', Number(id));
  if (!u) throw new HttpHata(404, 'Ürün bulunamadı');
  return u;
}

// Stoku değiştir + hareket kaydı yaz (çağıran transaction içinde olmalı)
function stokDegistir(urun, degisim, tip, { birimFiyat = 0, aciklama = '', satisId = null } = {}) {
  const onceki = urun.stok;
  const sonraki = yuvarla(onceki + degisim);
  calistir(
    `UPDATE urunler SET stok = ?, guncelleme = datetime('now','localtime') WHERE id = ?`,
    sonraki, urun.id,
  );
  calistir(
    `INSERT INTO hareketler(urun_id, tip, miktar, onceki, sonraki, birim_fiyat, aciklama, satis_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    urun.id, tip, degisim, onceki, sonraki, birimFiyat, aciklama, satisId,
  );
  urun.stok = sonraki;
  return sonraki;
}

function urunAlanlari(g, mevcut = {}) {
  const ad = String(g.ad ?? mevcut.ad ?? '').trim();
  if (!ad) throw new HttpHata(400, 'Ürün adı zorunlu');
  return {
    ad,
    kategori: String(g.kategori ?? mevcut.kategori ?? '').trim(),
    birim: String(g.birim ?? mevcut.birim ?? 'Adet').trim() || 'Adet',
    alis_fiyat: yuvarla(sayi(g.alis_fiyat, mevcut.alis_fiyat ?? 0)),
    satis_fiyat: yuvarla(sayi(g.satis_fiyat, mevcut.satis_fiyat ?? 0)),
    kdv: sayi(g.kdv, mevcut.kdv ?? 20),
    min_stok: sayi(g.min_stok, mevcut.min_stok ?? 0),
  };
}

function fisNo() {
  const d = new Date();
  const gun = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const r = tek(`SELECT COUNT(*) AS n FROM satislar WHERE fis_no LIKE ?`, `S-${gun}-%`);
  return `S-${gun}-${String(r.n + 1).padStart(4, '0')}`;
}

// ---------- API ----------
const rotalar = [];
const rota = (metod, desen, isleyici) => {
  const anahtarlar = [];
  const re = new RegExp('^' + desen.replace(/:(\w+)/g, (_, k) => { anahtarlar.push(k); return '([^/]+)'; }) + '$');
  rotalar.push({ metod, re, anahtarlar, isleyici });
};

// Ürünler
rota('GET', '/api/urunler', ({ q }) => {
  const ara = (q.ara || '').trim();
  let sql = 'SELECT * FROM urunler WHERE aktif = 1';
  const p = [];
  if (ara) {
    sql += ' AND (ad LIKE ? OR barkod LIKE ? OR kategori LIKE ?)';
    p.push(`%${ara}%`, `%${ara}%`, `%${ara}%`);
  }
  if (q.kritik === '1') sql += ' AND stok <= min_stok';
  sql += ' ORDER BY ad COLLATE NOCASE';
  return hepsi(sql, ...p);
});

rota('GET', '/api/urunler/barkod/:barkod', ({ p }) => {
  const u = tek('SELECT * FROM urunler WHERE barkod = ? AND aktif = 1', decodeURIComponent(p.barkod));
  if (!u) throw new HttpHata(404, 'Bu barkodla kayıtlı ürün yok');
  return u;
});

rota('GET', '/api/yeni-barkod', () => islem(() => ({ barkod: yeniBarkod() })));

rota('POST', '/api/urunler', ({ g }) => islem(() => {
  const a = urunAlanlari(g);
  const barkod = String(g.barkod || '').trim() || yeniBarkod();
  const eski = tek('SELECT * FROM urunler WHERE barkod = ?', barkod);
  if (eski && eski.aktif) throw new HttpHata(409, `Bu barkod zaten "${eski.ad}" ürününde kayıtlı`);
  let id;
  if (eski) {
    // Silinmiş ürünün barkodu yeniden kullanılıyor → ürünü canlandır
    calistir(
      `UPDATE urunler SET ad=?, kategori=?, birim=?, alis_fiyat=?, satis_fiyat=?, kdv=?, min_stok=?, aktif=1,
       guncelleme=datetime('now','localtime') WHERE id=?`,
      a.ad, a.kategori, a.birim, a.alis_fiyat, a.satis_fiyat, a.kdv, a.min_stok, eski.id,
    );
    id = eski.id;
  } else {
    id = Number(calistir(
      `INSERT INTO urunler(barkod, ad, kategori, birim, alis_fiyat, satis_fiyat, kdv, min_stok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      barkod, a.ad, a.kategori, a.birim, a.alis_fiyat, a.satis_fiyat, a.kdv, a.min_stok,
    ).lastInsertRowid);
  }
  const urun = tek('SELECT * FROM urunler WHERE id = ?', id);
  const baslangic = sayi(g.stok, 0);
  if (baslangic !== 0) stokDegistir(urun, baslangic, 'GIRIS', { birimFiyat: a.alis_fiyat, aciklama: 'Açılış stoku' });
  return tek('SELECT * FROM urunler WHERE id = ?', id);
}));

rota('PUT', '/api/urunler/:id', ({ p, g }) => islem(() => {
  const u = urunBul(p.id);
  const a = urunAlanlari(g, u);
  const barkod = String(g.barkod ?? u.barkod).trim();
  if (!barkod) throw new HttpHata(400, 'Barkod boş olamaz');
  const cakisan = tek('SELECT ad FROM urunler WHERE barkod = ? AND id <> ?', barkod, u.id);
  if (cakisan) throw new HttpHata(409, `Bu barkod zaten "${cakisan.ad}" ürününde kayıtlı`);
  calistir(
    `UPDATE urunler SET barkod=?, ad=?, kategori=?, birim=?, alis_fiyat=?, satis_fiyat=?, kdv=?, min_stok=?,
     guncelleme=datetime('now','localtime') WHERE id=?`,
    barkod, a.ad, a.kategori, a.birim, a.alis_fiyat, a.satis_fiyat, a.kdv, a.min_stok, u.id,
  );
  return tek('SELECT * FROM urunler WHERE id = ?', u.id);
}));

rota('DELETE', '/api/urunler/:id', ({ p }) => {
  const u = urunBul(p.id);
  // Geçmiş satış/hareket kayıtları bozulmasın diye pasife alınır
  calistir(`UPDATE urunler SET aktif = 0, guncelleme = datetime('now','localtime') WHERE id = ?`, u.id);
  return { ok: true };
});

// Stok hareketi (giriş / çıkış / sayım) — toplu
// g.tip: GIRIS | CIKIS | SAYIM ; g.kalemler: [{ urun_id, miktar, birim_fiyat? }]
rota('POST', '/api/stok-hareket', ({ g }) => islem(() => {
  const tip = String(g.tip || '').toUpperCase();
  if (!['GIRIS', 'CIKIS', 'SAYIM'].includes(tip)) throw new HttpHata(400, 'Geçersiz hareket tipi');
  const kalemler = Array.isArray(g.kalemler) ? g.kalemler : [];
  if (!kalemler.length) throw new HttpHata(400, 'Liste boş');
  const aciklama = String(g.aciklama || '').trim();
  const sonuc = [];
  for (const k of kalemler) {
    const u = urunBul(k.urun_id);
    const miktar = sayi(k.miktar);
    if (tip !== 'SAYIM' && miktar <= 0) throw new HttpHata(400, `"${u.ad}" için miktar 0'dan büyük olmalı`);
    if (tip === 'SAYIM' && miktar < 0) throw new HttpHata(400, `"${u.ad}" için sayım negatif olamaz`);
    let degisim = tip === 'GIRIS' ? miktar : tip === 'CIKIS' ? -miktar : yuvarla(miktar - u.stok);
    if (tip === 'CIKIS' && u.stok + degisim < 0 && !g.eksiyeIzinVer) {
      throw new HttpHata(409, `"${u.ad}" için yeterli stok yok (elde ${u.stok})`);
    }
    const birimFiyat = k.birim_fiyat !== undefined && k.birim_fiyat !== '' ? yuvarla(sayi(k.birim_fiyat)) : u.alis_fiyat;
    if (tip === 'GIRIS' && g.alisFiyatGuncelle && birimFiyat > 0 && birimFiyat !== u.alis_fiyat) {
      calistir('UPDATE urunler SET alis_fiyat = ? WHERE id = ?', birimFiyat, u.id);
    }
    if (degisim !== 0) stokDegistir(u, degisim, tip, { birimFiyat, aciklama });
    sonuc.push({ urun_id: u.id, ad: u.ad, stok: u.stok });
  }
  return { ok: true, urunler: sonuc };
}));

rota('GET', '/api/hareketler', ({ q }) => {
  let sql = `SELECT h.*, u.ad, u.barkod, u.birim FROM hareketler h JOIN urunler u ON u.id = h.urun_id WHERE 1=1`;
  const p = [];
  if (q.urun_id) { sql += ' AND h.urun_id = ?'; p.push(Number(q.urun_id)); }
  if (q.tip) { sql += ' AND h.tip = ?'; p.push(q.tip); }
  if (q.bas) { sql += ' AND date(h.tarih) >= date(?)'; p.push(q.bas); }
  if (q.bit) { sql += ' AND date(h.tarih) <= date(?)'; p.push(q.bit); }
  sql += ' ORDER BY h.id DESC LIMIT ?';
  p.push(Math.min(Number(q.limit) || 300, 2000));
  return hepsi(sql, ...p);
});

// Satış
// g: { kalemler: [{ urun_id, miktar, birim_fiyat? }], odeme_tipi, alinan, iskonto, eksiyeIzinVer }
rota('POST', '/api/satislar', ({ g }) => islem(() => {
  const kalemler = Array.isArray(g.kalemler) ? g.kalemler : [];
  if (!kalemler.length) throw new HttpHata(400, 'Sepet boş');
  const odemeTipi = ['NAKIT', 'KART', 'DIGER'].includes(g.odeme_tipi) ? g.odeme_tipi : 'NAKIT';

  // Aynı ürün birden çok satırda olabilir → önce toplam talebi kontrol et
  const talep = new Map();
  const hazir = kalemler.map((k) => {
    const u = urunBul(k.urun_id);
    const miktar = sayi(k.miktar);
    if (miktar <= 0) throw new HttpHata(400, `"${u.ad}" miktarı 0'dan büyük olmalı`);
    const birimFiyat = k.birim_fiyat !== undefined && k.birim_fiyat !== '' ? yuvarla(sayi(k.birim_fiyat)) : u.satis_fiyat;
    talep.set(u.id, (talep.get(u.id) || 0) + miktar);
    return { u, miktar, birimFiyat, tutar: yuvarla(miktar * birimFiyat) };
  });
  if (!g.eksiyeIzinVer) {
    const yetersiz = hazir
      .filter((k, i, a) => a.findIndex((x) => x.u.id === k.u.id) === i)
      .filter((k) => talep.get(k.u.id) > k.u.stok)
      .map((k) => `${k.u.ad} (elde ${k.u.stok}, istenen ${talep.get(k.u.id)})`);
    if (yetersiz.length) throw new HttpHata(409, 'Yetersiz stok: ' + yetersiz.join(', '));
  }

  const araToplam = yuvarla(hazir.reduce((t, k) => t + k.tutar, 0));
  const iskonto = Math.min(Math.max(yuvarla(sayi(g.iskonto, 0)), 0), araToplam);
  const toplam = yuvarla(araToplam - iskonto);
  const alinan = odemeTipi === 'NAKIT' ? yuvarla(sayi(g.alinan, toplam)) : toplam;
  if (alinan < toplam) throw new HttpHata(400, 'Alınan tutar toplamdan az');

  const no = fisNo();
  const satisId = Number(calistir(
    `INSERT INTO satislar(fis_no, toplam, iskonto, odeme_tipi, alinan, para_ustu) VALUES (?, ?, ?, ?, ?, ?)`,
    no, toplam, iskonto, odemeTipi, alinan, yuvarla(alinan - toplam),
  ).lastInsertRowid);

  const guncel = new Map();
  for (const k of hazir) {
    const u = guncel.get(k.u.id) || k.u;
    guncel.set(u.id, u);
    calistir(
      `INSERT INTO satis_kalemleri(satis_id, urun_id, barkod, ad, miktar, birim_fiyat, tutar) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      satisId, u.id, u.barkod, u.ad, k.miktar, k.birimFiyat, k.tutar,
    );
    stokDegistir(u, -k.miktar, 'SATIS', { birimFiyat: k.birimFiyat, aciklama: no, satisId });
  }
  return satisDetay(satisId);
}));

function satisDetay(id) {
  const s = tek('SELECT * FROM satislar WHERE id = ?', Number(id));
  if (!s) throw new HttpHata(404, 'Satış bulunamadı');
  s.kalemler = hepsi('SELECT * FROM satis_kalemleri WHERE satis_id = ? ORDER BY id', s.id);
  return s;
}

rota('GET', '/api/satislar', ({ q }) => {
  let sql = `SELECT s.*, (SELECT COUNT(*) FROM satis_kalemleri k WHERE k.satis_id = s.id) AS kalem_sayisi
             FROM satislar s WHERE 1=1`;
  const p = [];
  if (q.bas) { sql += ' AND date(s.tarih) >= date(?)'; p.push(q.bas); }
  if (q.bit) { sql += ' AND date(s.tarih) <= date(?)'; p.push(q.bit); }
  sql += ' ORDER BY s.id DESC LIMIT 1000';
  return hepsi(sql, ...p);
});

rota('GET', '/api/satislar/:id', ({ p }) => satisDetay(p.id));

// Satış iptali → stoklar geri eklenir
rota('POST', '/api/satislar/:id/iptal', ({ p }) => islem(() => {
  const s = satisDetay(p.id);
  if (s.iptal) throw new HttpHata(409, 'Bu satış zaten iptal edilmiş');
  calistir('UPDATE satislar SET iptal = 1 WHERE id = ?', s.id);
  for (const k of s.kalemler) {
    const u = tek('SELECT * FROM urunler WHERE id = ?', k.urun_id);
    stokDegistir(u, k.miktar, 'IADE', { birimFiyat: k.birim_fiyat, aciklama: `${s.fis_no} iptal`, satisId: s.id });
  }
  return satisDetay(s.id);
}));

// Özet (ana sayfa)
rota('GET', '/api/ozet', () => {
  const bugun = tek(
    `SELECT COUNT(*) AS adet, COALESCE(SUM(toplam),0) AS ciro,
            COALESCE(SUM(CASE WHEN odeme_tipi='NAKIT' THEN toplam END),0) AS nakit,
            COALESCE(SUM(CASE WHEN odeme_tipi='KART' THEN toplam END),0) AS kart
     FROM satislar WHERE iptal = 0 AND date(tarih) = date('now','localtime')`,
  );
  const stok = tek(
    `SELECT COUNT(*) AS urun_sayisi, COALESCE(SUM(stok),0) AS toplam_adet,
            COALESCE(SUM(stok * alis_fiyat),0) AS maliyet_degeri,
            COALESCE(SUM(stok * satis_fiyat),0) AS satis_degeri,
            SUM(CASE WHEN stok <= min_stok THEN 1 ELSE 0 END) AS kritik
     FROM urunler WHERE aktif = 1`,
  );
  const enCok = hepsi(
    `SELECT k.ad, SUM(k.miktar) AS miktar, SUM(k.tutar) AS tutar
     FROM satis_kalemleri k JOIN satislar s ON s.id = k.satis_id
     WHERE s.iptal = 0 AND date(s.tarih) = date('now','localtime')
     GROUP BY k.urun_id ORDER BY miktar DESC LIMIT 5`,
  );
  return { bugun, stok, enCok };
});

rota('GET', '/api/ayarlar', () => {
  const r = {};
  for (const a of hepsi('SELECT * FROM ayarlar')) r[a.anahtar] = a.deger;
  return r;
});

rota('PUT', '/api/ayarlar', ({ g }) => islem(() => {
  for (const [k, v] of Object.entries(g || {})) {
    if (k === 'barkod_sayac') continue;
    calistir(
      `INSERT INTO ayarlar(anahtar, deger) VALUES(?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger`,
      k, String(v),
    );
  }
  return { ok: true };
}));

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png',
};

function govdeOku(req) {
  return new Promise((coz, reddet) => {
    let v = '';
    req.on('data', (c) => { v += c; if (v.length > 5e6) reddet(new HttpHata(413, 'İstek çok büyük')); });
    req.on('end', () => {
      if (!v) return coz({});
      try { coz(JSON.parse(v)); } catch { reddet(new HttpHata(400, 'Geçersiz JSON')); }
    });
    req.on('error', reddet);
  });
}

const json = (res, kod, veri) => {
  res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(veri));
};

const sunucu = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) {
      for (const r of rotalar) {
        const m = r.metod === req.method && url.pathname.match(r.re);
        if (!m) continue;
        const p = Object.fromEntries(r.anahtarlar.map((k, i) => [k, m[i + 1]]));
        const g = ['POST', 'PUT'].includes(req.method) ? await govdeOku(req) : {};
        return json(res, 200, r.isleyici({ p, q: Object.fromEntries(url.searchParams), g }));
      }
      throw new HttpHata(404, 'Bulunamadı');
    }
    // Statik dosyalar
    let dosya = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!dosya.startsWith(PUBLIC)) throw new HttpHata(403, 'Yasak');
    if (!fs.existsSync(dosya) || fs.statSync(dosya).isDirectory()) dosya = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(dosya)] || 'application/octet-stream' });
    fs.createReadStream(dosya).pipe(res);
  } catch (e) {
    const kod = e.kod || (String(e.message).includes('UNIQUE') ? 409 : 500);
    if (kod === 500) console.error(e);
    json(res, kod, { hata: e.message || 'Sunucu hatası' });
  }
});

sunucu.listen(PORT, () => {
  console.log(`\n  Barkodlu Stok & Satış çalışıyor →  http://localhost:${PORT}\n`);
});
