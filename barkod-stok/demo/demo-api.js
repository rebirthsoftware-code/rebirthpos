// DEMO: Sunucu olmadan çalışsın diye /api/* isteklerini tarayıcı içinde karşılar.
// Mantık server.js ile aynıdır; veriler tarayıcının localStorage'ında tutulur.
(function () {
  const ANAHTAR = 'bs_demo_db';
  const simdi = () => {
    const d = new Date(); const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  const yuvarla = (n) => Math.round(Number(n) * 100) / 100;
  const sayi = (v, vars = 0) => {
    if (v === undefined || v === null || v === '') return vars;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) throw hata(400, `Geçersiz sayı: ${v}`);
    return n;
  };
  const hata = (kod, mesaj) => Object.assign(new Error(mesaj), { kod });
  const ean13Kontrol = (k) => { let t = 0; for (let i = 0; i < 12; i++) t += Number(k[i]) * (i % 2 ? 3 : 1); return String((10 - (t % 10)) % 10); };

  function ornekVeri() {
    const db = { urunler: [], hareketler: [], satislar: [], kalemler: [], ayarlar: { isletme_adi: 'Demo Market', barkod_sayac: '0' }, sira: { u: 0, h: 0, s: 0, k: 0 } };
    const ekle = (barkod, ad, kategori, alis, satis, stok, min, birim = 'Adet') => {
      const u = { id: ++db.sira.u, barkod, ad, kategori, birim, alis_fiyat: alis, satis_fiyat: satis, kdv: 20, stok: 0, min_stok: min, aktif: 1, olusturma: simdi(), guncelleme: simdi() };
      db.urunler.push(u);
      if (stok) stokDegistir(db, u, stok, 'GIRIS', { birimFiyat: alis, aciklama: 'Açılış stoku (örnek)' });
    };
    const ic = (n) => { const k = '200' + String(n).padStart(9, '0'); return k + ean13Kontrol(k); };
    ekle('8690504000017', 'Su 0,5 L', 'İçecek', 4, 10, 48, 12);
    ekle('8690632000011', 'Kola 330 ml', 'İçecek', 18, 35, 24, 6);
    ekle('8690526000014', 'Ayran 250 ml', 'İçecek', 9, 18, 5, 8);
    ekle(ic(1), 'Sütlü Çikolata 80 g', 'Atıştırmalık', 15, 25.5, 30, 5);
    ekle(ic(2), 'Tuzlu Kraker', 'Atıştırmalık', 11, 20, 3, 5);
    ekle(ic(3), 'Tükenmez Kalem Mavi', 'Kırtasiye', 6, 12.5, 60, 10);
    ekle(ic(4), 'Defter A4 Kareli', 'Kırtasiye', 32, 55, 14, 4);
    ekle(ic(5), 'Pil AA 4\'lü', 'Elektrik', 45, 79.9, 0, 3, 'Paket');
    db.ayarlar.barkod_sayac = '5';
    return db;
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(ANAHTAR)); } catch { db = null; }
  if (!db || !db.urunler) db = ornekVeri();
  const kaydet = () => { try { localStorage.setItem(ANAHTAR, JSON.stringify(db)); } catch { /* depolama yoksa bellekte kalır */ } };
  kaydet();
  window.demoSifirla = () => { db = ornekVeri(); kaydet(); try { localStorage.removeItem('bs_sepet'); localStorage.removeItem('bs_etiketKuyruk'); } catch { /* */ } location.reload(); };

  function stokDegistir(d, u, degisim, tip, { birimFiyat = 0, aciklama = '', satisId = null } = {}) {
    const onceki = u.stok, sonraki = yuvarla(onceki + degisim);
    u.stok = sonraki; u.guncelleme = simdi();
    d.hareketler.push({ id: ++d.sira.h, urun_id: u.id, tip, miktar: degisim, onceki, sonraki, birim_fiyat: birimFiyat, aciklama, satis_id: satisId, tarih: simdi() });
  }
  const urunBul = (id) => { const u = db.urunler.find((x) => x.id === Number(id)); if (!u) throw hata(404, 'Ürün bulunamadı'); return u; };
  const kopya = (x) => JSON.parse(JSON.stringify(x));
  function yeniBarkod() {
    let s = Number(db.ayarlar.barkod_sayac || 0), b;
    do { s++; const k = '200' + String(s).padStart(9, '0'); b = k + ean13Kontrol(k); } while (db.urunler.some((u) => u.barkod === b));
    db.ayarlar.barkod_sayac = String(s); return b;
  }
  function alanlar(g, m = {}) {
    const ad = String(g.ad ?? m.ad ?? '').trim();
    if (!ad) throw hata(400, 'Ürün adı zorunlu');
    return { ad, kategori: String(g.kategori ?? m.kategori ?? '').trim(), birim: String(g.birim ?? m.birim ?? 'Adet') || 'Adet',
      alis_fiyat: yuvarla(sayi(g.alis_fiyat, m.alis_fiyat ?? 0)), satis_fiyat: yuvarla(sayi(g.satis_fiyat, m.satis_fiyat ?? 0)),
      kdv: sayi(g.kdv, m.kdv ?? 20), min_stok: sayi(g.min_stok, m.min_stok ?? 0) };
  }
  const gun = (t) => t.slice(0, 10);
  const bugun = () => simdi().slice(0, 10);
  const aralik = (t, q) => (!q.bas || gun(t) >= q.bas) && (!q.bit || gun(t) <= q.bit);
  function satisDetay(id) {
    const s = db.satislar.find((x) => x.id === Number(id));
    if (!s) throw hata(404, 'Satış bulunamadı');
    return { ...kopya(s), kalemler: kopya(db.kalemler.filter((k) => k.satis_id === s.id)) };
  }

  const R = [];
  const rota = (m, desen, f) => { const ks = []; R.push({ m, re: new RegExp('^' + desen.replace(/:(\w+)/g, (_, k) => (ks.push(k), '([^/]+)')) + '$'), ks, f }); };

  rota('GET', '/api/urunler', ({ q }) => {
    const a = (q.ara || '').toLocaleLowerCase('tr');
    return kopya(db.urunler.filter((u) => u.aktif && (!a || (u.ad + u.barkod + u.kategori).toLocaleLowerCase('tr').includes(a)) && (q.kritik !== '1' || u.stok <= u.min_stok))
      .sort((x, y) => x.ad.localeCompare(y.ad, 'tr')));
  });
  rota('GET', '/api/urunler/barkod/:b', ({ p }) => { const u = db.urunler.find((x) => x.aktif && x.barkod === decodeURIComponent(p.b)); if (!u) throw hata(404, 'Bu barkodla kayıtlı ürün yok'); return kopya(u); });
  rota('GET', '/api/yeni-barkod', () => ({ barkod: yeniBarkod() }));
  rota('POST', '/api/urunler', ({ g }) => {
    const a = alanlar(g);
    const barkod = String(g.barkod || '').trim() || yeniBarkod();
    let u = db.urunler.find((x) => x.barkod === barkod);
    if (u && u.aktif) throw hata(409, `Bu barkod zaten "${u.ad}" ürününde kayıtlı`);
    if (u) Object.assign(u, a, { aktif: 1, guncelleme: simdi() });
    else { u = { id: ++db.sira.u, barkod, ...a, stok: 0, aktif: 1, olusturma: simdi(), guncelleme: simdi() }; db.urunler.push(u); }
    const bas = sayi(g.stok, 0);
    if (bas) stokDegistir(db, u, bas, 'GIRIS', { birimFiyat: a.alis_fiyat, aciklama: 'Açılış stoku' });
    return kopya(u);
  });
  rota('PUT', '/api/urunler/:id', ({ p, g }) => {
    const u = urunBul(p.id), a = alanlar(g, u);
    const barkod = String(g.barkod ?? u.barkod).trim();
    if (!barkod) throw hata(400, 'Barkod boş olamaz');
    const c = db.urunler.find((x) => x.barkod === barkod && x.id !== u.id);
    if (c) throw hata(409, `Bu barkod zaten "${c.ad}" ürününde kayıtlı`);
    Object.assign(u, a, { barkod, guncelleme: simdi() });
    return kopya(u);
  });
  rota('DELETE', '/api/urunler/:id', ({ p }) => { urunBul(p.id).aktif = 0; return { ok: true }; });

  rota('POST', '/api/stok-hareket', ({ g }) => {
    const tip = String(g.tip || '').toUpperCase();
    if (!['GIRIS', 'CIKIS', 'SAYIM'].includes(tip)) throw hata(400, 'Geçersiz hareket tipi');
    const ks = g.kalemler || [];
    if (!ks.length) throw hata(400, 'Liste boş');
    const plan = ks.map((k) => {
      const u = urunBul(k.urun_id), m = sayi(k.miktar);
      if (tip !== 'SAYIM' && m <= 0) throw hata(400, `"${u.ad}" için miktar 0'dan büyük olmalı`);
      if (tip === 'SAYIM' && m < 0) throw hata(400, `"${u.ad}" için sayım negatif olamaz`);
      const deg = tip === 'GIRIS' ? m : tip === 'CIKIS' ? -m : yuvarla(m - u.stok);
      if (tip === 'CIKIS' && u.stok + deg < 0 && !g.eksiyeIzinVer) throw hata(409, `"${u.ad}" için yeterli stok yok (elde ${u.stok})`);
      const bf = k.birim_fiyat !== undefined && k.birim_fiyat !== '' ? yuvarla(sayi(k.birim_fiyat)) : u.alis_fiyat;
      return { u, deg, bf };
    });
    for (const { u, deg, bf } of plan) {
      if (tip === 'GIRIS' && g.alisFiyatGuncelle && bf > 0) u.alis_fiyat = bf;
      if (deg) stokDegistir(db, u, deg, tip, { birimFiyat: bf, aciklama: String(g.aciklama || '') });
    }
    return { ok: true };
  });
  rota('GET', '/api/hareketler', ({ q }) => db.hareketler
    .filter((h) => (!q.urun_id || h.urun_id === Number(q.urun_id)) && (!q.tip || h.tip === q.tip) && aralik(h.tarih, q))
    .slice(-300).reverse().map((h) => { const u = db.urunler.find((x) => x.id === h.urun_id); return { ...h, ad: u.ad, barkod: u.barkod, birim: u.birim }; }));

  rota('POST', '/api/satislar', ({ g }) => {
    const ks = g.kalemler || [];
    if (!ks.length) throw hata(400, 'Sepet boş');
    const tipO = ['NAKIT', 'KART', 'DIGER'].includes(g.odeme_tipi) ? g.odeme_tipi : 'NAKIT';
    const talep = new Map();
    const hazir = ks.map((k) => {
      const u = urunBul(k.urun_id), m = sayi(k.miktar);
      if (m <= 0) throw hata(400, `"${u.ad}" miktarı 0'dan büyük olmalı`);
      const bf = k.birim_fiyat !== undefined && k.birim_fiyat !== '' ? yuvarla(sayi(k.birim_fiyat)) : u.satis_fiyat;
      talep.set(u.id, (talep.get(u.id) || 0) + m);
      return { u, m, bf, tutar: yuvarla(m * bf) };
    });
    if (!g.eksiyeIzinVer) {
      const y = [...new Set(hazir.map((k) => k.u))].filter((u) => talep.get(u.id) > u.stok).map((u) => `${u.ad} (elde ${u.stok}, istenen ${talep.get(u.id)})`);
      if (y.length) throw hata(409, 'Yetersiz stok: ' + y.join(', '));
    }
    const ara = yuvarla(hazir.reduce((t, k) => t + k.tutar, 0));
    const isk = Math.min(Math.max(yuvarla(sayi(g.iskonto, 0)), 0), ara);
    const toplam = yuvarla(ara - isk);
    const alinan = tipO === 'NAKIT' ? yuvarla(sayi(g.alinan, toplam)) : toplam;
    if (alinan < toplam) throw hata(400, 'Alınan tutar toplamdan az');
    const g8 = bugun().replace(/-/g, '');
    const no = `S-${g8}-${String(db.satislar.filter((s) => s.fis_no.startsWith(`S-${g8}-`)).length + 1).padStart(4, '0')}`;
    const s = { id: ++db.sira.s, fis_no: no, toplam, iskonto: isk, odeme_tipi: tipO, alinan, para_ustu: yuvarla(alinan - toplam), iptal: 0, tarih: simdi() };
    db.satislar.push(s);
    for (const k of hazir) {
      db.kalemler.push({ id: ++db.sira.k, satis_id: s.id, urun_id: k.u.id, barkod: k.u.barkod, ad: k.u.ad, miktar: k.m, birim_fiyat: k.bf, tutar: k.tutar });
      stokDegistir(db, k.u, -k.m, 'SATIS', { birimFiyat: k.bf, aciklama: no, satisId: s.id });
    }
    return satisDetay(s.id);
  });
  rota('GET', '/api/satislar', ({ q }) => db.satislar.filter((s) => aralik(s.tarih, q)).slice().reverse()
    .map((s) => ({ ...s, kalem_sayisi: db.kalemler.filter((k) => k.satis_id === s.id).length })));
  rota('GET', '/api/satislar/:id', ({ p }) => satisDetay(p.id));
  rota('POST', '/api/satislar/:id/iptal', ({ p }) => {
    const s = db.satislar.find((x) => x.id === Number(p.id));
    if (!s) throw hata(404, 'Satış bulunamadı');
    if (s.iptal) throw hata(409, 'Bu satış zaten iptal edilmiş');
    s.iptal = 1;
    for (const k of db.kalemler.filter((x) => x.satis_id === s.id)) stokDegistir(db, urunBul(k.urun_id), k.miktar, 'IADE', { birimFiyat: k.birim_fiyat, aciklama: `${s.fis_no} iptal`, satisId: s.id });
    return satisDetay(s.id);
  });
  rota('GET', '/api/ozet', () => {
    const bs = db.satislar.filter((s) => !s.iptal && gun(s.tarih) === bugun());
    const top = (f) => bs.filter(f).reduce((t, s) => t + s.toplam, 0);
    const aktif = db.urunler.filter((u) => u.aktif);
    const say = new Map();
    for (const k of db.kalemler) if (bs.some((s) => s.id === k.satis_id)) {
      const x = say.get(k.urun_id) || { ad: k.ad, miktar: 0, tutar: 0 }; x.miktar += k.miktar; x.tutar += k.tutar; say.set(k.urun_id, x);
    }
    return {
      bugun: { adet: bs.length, ciro: top(() => true), nakit: top((s) => s.odeme_tipi === 'NAKIT'), kart: top((s) => s.odeme_tipi === 'KART') },
      stok: { urun_sayisi: aktif.length, toplam_adet: aktif.reduce((t, u) => t + u.stok, 0), maliyet_degeri: aktif.reduce((t, u) => t + u.stok * u.alis_fiyat, 0),
        satis_degeri: aktif.reduce((t, u) => t + u.stok * u.satis_fiyat, 0), kritik: aktif.filter((u) => u.stok <= u.min_stok).length },
      enCok: [...say.values()].sort((a, b) => b.miktar - a.miktar).slice(0, 5),
    };
  });
  rota('GET', '/api/ayarlar', () => ({ ...db.ayarlar }));
  rota('PUT', '/api/ayarlar', ({ g }) => { for (const [k, v] of Object.entries(g || {})) if (k !== 'barkod_sayac') db.ayarlar[k] = String(v); return { ok: true }; });

  const asilFetch = window.fetch.bind(window);
  window.fetch = async (url, secenek = {}) => {
    const u = new URL(url, 'http://demo');
    if (!u.pathname.startsWith('/api/')) return asilFetch(url, secenek);
    const metod = (secenek.method || 'GET').toUpperCase();
    const cevap = (kod, veri) => new Response(JSON.stringify(veri), { status: kod, headers: { 'Content-Type': 'application/json' } });
    for (const r of R) {
      const m = r.m === metod && u.pathname.match(r.re);
      if (!m) continue;
      const yedek = JSON.stringify(db);
      try {
        const sonuc = r.f({ p: Object.fromEntries(r.ks.map((k, i) => [k, m[i + 1]])), q: Object.fromEntries(u.searchParams), g: secenek.body ? JSON.parse(secenek.body) : {} });
        if (metod !== 'GET' || r.re.source.includes('yeni-barkod')) kaydet();
        return cevap(200, sonuc);
      } catch (e) {
        db = JSON.parse(yedek); // hata olursa işlemi geri al (transaction gibi)
        return cevap(e.kod || 500, { hata: e.message });
      }
    }
    return cevap(404, { hata: 'Bulunamadı' });
  };
})();
