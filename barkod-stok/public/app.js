// Barkodlu Stok & Satış — arayüz
'use strict';

// ================= Yardımcılar =================
const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const kac = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paraFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const para = (n) => paraFmt.format(Number(n) || 0) + ' ₺';
const sayiFmt = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(Number(n) || 0);
// "1.234,56" / "12,5" / "12.5" hepsini sayıya çevirir
function sayiOku(v) {
  let t = String(v ?? '').trim().replace(/\s|₺/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}
const yuvarla = (n) => Math.round(n * 100) / 100;
const bugunStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const tarihFmt = (t) => (t ? new Date(t.replace(' ', 'T')).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const yerel = {
  al(k, v) { try { const x = localStorage.getItem('bs_' + k); return x ? JSON.parse(x) : v; } catch { return v; } },
  koy(k, v) { try { localStorage.setItem('bs_' + k, JSON.stringify(v)); } catch { /* gizli sekme vb. */ } },
};

async function api(metod, url, govde) {
  const r = await fetch(url, {
    method: metod,
    headers: govde ? { 'Content-Type': 'application/json' } : {},
    body: govde ? JSON.stringify(govde) : undefined,
  });
  const v = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(v.hata || `Hata (${r.status})`);
  return v;
}

function toast(mesaj, tip = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + tip;
  el.textContent = mesaj;
  $('#toastlar').appendChild(el);
  setTimeout(() => el.remove(), tip === 'hata' ? 5000 : 2800);
}

// Okuma sesi (başarılı: kısa ince bip, hata: kalın çift bip)
let sesBaglam;
function bip(hata = false) {
  try {
    sesBaglam ||= new (window.AudioContext || window.webkitAudioContext)();
    const cal = (f, bas, sure) => {
      const o = sesBaglam.createOscillator(), g = sesBaglam.createGain();
      o.frequency.value = f; o.type = hata ? 'square' : 'sine';
      g.gain.value = 0.08; o.connect(g); g.connect(sesBaglam.destination);
      o.start(sesBaglam.currentTime + bas); o.stop(sesBaglam.currentTime + bas + sure);
    };
    if (hata) { cal(220, 0, 0.12); cal(180, 0.16, 0.18); } else cal(1400, 0, 0.07);
  } catch { /* ses yoksa sorun değil */ }
}

// ================= Modal =================
function modalAc(html, genis = false) {
  const k = $('#modal-kutu');
  k.className = 'modal-kutu' + (genis ? ' genis' : '');
  k.innerHTML = html;
  $('#modal').classList.remove('gizli');
  setTimeout(() => $('[autofocus]', k)?.focus(), 30);
  return k;
}
function modalKapat() {
  $('#modal').classList.add('gizli');
  $('#modal-kutu').innerHTML = '';
  odakGeriVer();
}
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') modalKapat(); });
const modalAcik = () => !$('#modal').classList.contains('gizli');
function onayla(mesaj, evetYazi = 'Evet') {
  return new Promise((coz) => {
    const k = modalAc(`<h2>${kac(mesaj)}</h2><div class="modal-alt">
      <button class="btn" data-c="0">Vazgeç</button><button class="btn ana" data-c="1" autofocus>${kac(evetYazi)}</button></div>`);
    k.addEventListener('click', (e) => {
      const c = e.target.closest('[data-c]');
      if (c) { modalKapat(); coz(c.dataset.c === '1'); }
    });
  });
}

// ================= Veri =================
const durum = {
  urunler: [],
  barkodHarita: new Map(),
  ayarlar: {},
  sepet: yerel.al('sepet', []), // [{urun_id, miktar, birim_fiyat}]
  sonUrun: null,
  stokMod: 'GIRIS',
  stokListe: [], // [{urun_id, miktar, birim_fiyat}]
  etiketKuyruk: yerel.al('etiketKuyruk', []), // [{urun_id, adet}]
};

async function urunleriYukle() {
  durum.urunler = await api('GET', '/api/urunler');
  durum.barkodHarita = new Map(durum.urunler.map((u) => [u.barkod, u]));
}
const urunGetir = (id) => durum.urunler.find((u) => u.id === Number(id));

async function barkodlaBul(barkod) {
  const u = durum.barkodHarita.get(barkod);
  if (u) return u;
  try {
    const bulunan = await api('GET', '/api/urunler/barkod/' + encodeURIComponent(barkod));
    await urunleriYukle();
    return urunGetir(bulunan.id);
  } catch { return null; }
}

function urunAra(metin, limit = 12) {
  const q = metin.toLocaleLowerCase('tr').trim();
  if (!q) return [];
  return durum.urunler
    .filter((u) => u.ad.toLocaleLowerCase('tr').includes(q) || u.barkod.includes(q) || u.kategori.toLocaleLowerCase('tr').includes(q))
    .slice(0, limit);
}

function stokRozet(u) {
  const s = Number(u.stok);
  const cls = s <= 0 ? 'kirmizi' : s <= Number(u.min_stok) ? 'sari' : 'yesil';
  return `<span class="rozet ${cls}">${sayiFmt(s)} ${kac(u.birim)}</span>`;
}

// ================= Okutma girişi (barkod okuyucu + isimle arama) =================
// Barkod okuyucular klavye gibi davranır: kodu yazar + Enter basar.
// "3*8690..." yazımı 3 adet demektir.
function okutmaBagla(input, { secildi, bulunamadi }) {
  const kap = input.closest('.arama-sonuc');
  let liste = null, secIndex = -1, sonuclar = [];
  const listeKapat = () => { liste?.remove(); liste = null; secIndex = -1; };
  const listeCiz = () => {
    listeKapat();
    const deger = input.value.replace(/^\d+([.,]\d+)?\*/, '');
    if (deger.length < 2 || /^\d{6,}$/.test(deger)) return;
    sonuclar = urunAra(deger);
    if (!sonuclar.length) return;
    liste = document.createElement('div');
    liste.className = 'arama-liste';
    liste.innerHTML = sonuclar.map((u, i) => `<div data-i="${i}"><span>${kac(u.ad)} <small class="soluk mono">${kac(u.barkod)}</small></span>
      <span><b>${para(u.satis_fiyat)}</b> · ${stokRozet(u)}</span></div>`).join('');
    liste.addEventListener('mousedown', (e) => {
      const d = e.target.closest('[data-i]');
      if (!d) return;
      e.preventDefault();
      const carpan = carpanAl();
      input.value = ''; listeKapat();
      secildi(sonuclar[Number(d.dataset.i)], carpan);
    });
    kap.appendChild(liste);
  };
  const carpanAl = () => {
    const m = input.value.match(/^(\d+(?:[.,]\d+)?)\*/);
    return m ? sayiOku(m[1]) : null;
  };
  input.addEventListener('input', listeCiz);
  input.addEventListener('blur', () => setTimeout(listeKapat, 150));
  input.addEventListener('keydown', async (e) => {
    if (liste && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      secIndex = (secIndex + (e.key === 'ArrowDown' ? 1 : -1) + sonuclar.length) % sonuclar.length;
      $$('[data-i]', liste).forEach((d, i) => d.classList.toggle('sec', i === secIndex));
      return;
    }
    if (e.key === 'Escape') { listeKapat(); input.value = ''; return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const carpan = carpanAl();
    const deger = input.value.replace(/^\d+([.,]\d+)?\*/, '').trim();
    if (!deger) return;
    if (liste && secIndex >= 0) {
      const u = sonuclar[secIndex];
      input.value = ''; listeKapat();
      return secildi(u, carpan);
    }
    input.value = ''; listeKapat();
    const u = await barkodlaBul(deger);
    if (u) return secildi(u, carpan);
    // Barkod değilse ve tek isim eşleşmesi varsa onu al
    const es = urunAra(deger, 2);
    if (es.length === 1 && !/^\d+$/.test(deger)) return secildi(es[0], carpan);
    bip(true);
    bulunamadi?.(deger, carpan);
  });
}

let aktifOdak = null;
function odakGeriVer() { if (!modalAcik()) setTimeout(() => aktifOdak?.isConnected && aktifOdak.focus(), 0); }

// ================= Ürün formu (yeni / düzenle) =================
function kategoriSecenekleri() {
  return [...new Set(durum.urunler.map((u) => u.kategori).filter(Boolean))].sort()
    .map((k) => `<option value="${kac(k)}">`).join('');
}

function urunFormu(urun = {}, { stokGoster = !urun.id } = {}) {
  return new Promise((coz) => {
    const k = modalAc(`
      <h2>${urun.id ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2>
      <form id="urun-form">
        <div class="alan"><label>Barkod</label>
          <div class="satir"><input name="barkod" value="${kac(urun.barkod || '')}" placeholder="Okutun ya da boş bırakın → otomatik üretilir" class="mono">
          <button type="button" class="btn dar" id="barkod-uret">Barkod üret</button></div></div>
        <div class="alan"><label>Ürün adı *</label><input name="ad" required value="${kac(urun.ad || '')}"></div>
        <div class="satir alan">
          <div><label>Kategori</label><input name="kategori" list="kat-liste" value="${kac(urun.kategori || '')}"><datalist id="kat-liste">${kategoriSecenekleri()}</datalist></div>
          <div><label>Birim</label><select name="birim">${['Adet', 'Kg', 'Gr', 'Lt', 'Metre', 'Paket', 'Koli', 'Kutu'].map((b) => `<option ${b === (urun.birim || 'Adet') ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
        </div>
        <div class="satir alan">
          <div><label>Alış fiyatı (₺)</label><input name="alis_fiyat" inputmode="decimal" value="${urun.alis_fiyat ?? ''}"></div>
          <div><label>Satış fiyatı (₺) *</label><input name="satis_fiyat" inputmode="decimal" required value="${urun.satis_fiyat ?? ''}"></div>
          <div><label>KDV %</label><input name="kdv" inputmode="decimal" value="${urun.kdv ?? 20}"></div>
        </div>
        <div class="satir alan">
          ${stokGoster ? `<div><label>Açılış stoku</label><input name="stok" inputmode="decimal" value="${urun.stok ?? 0}"></div>` : ''}
          <div><label>Kritik stok seviyesi</label><input name="min_stok" inputmode="decimal" value="${urun.min_stok ?? 0}"></div>
        </div>
        <div id="kar-bilgi" class="soluk"></div>
        <div class="modal-alt">
          <button type="button" class="btn" id="iptal">Vazgeç</button>
          <button class="btn ana">Kaydet</button>
        </div>
      </form>`);
    const f = $('#urun-form', k);
    const adInput = f.elements.ad;
    if (!adInput.value) setTimeout(() => (f.elements.barkod.value ? adInput : f.elements.barkod).focus(), 40);
    const karGuncelle = () => {
      const a = sayiOku(f.elements.alis_fiyat.value), s = sayiOku(f.elements.satis_fiyat.value);
      $('#kar-bilgi', k).textContent = a > 0 && s > 0 ? `Kâr: ${para(s - a)} (%${sayiFmt(((s - a) / a) * 100)})` : '';
    };
    f.addEventListener('input', karGuncelle); karGuncelle();
    // Barkod alanında Enter formu göndermesin (okuyucu Enter basar)
    f.elements.barkod.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adInput.focus(); } });
    $('#barkod-uret', k).onclick = async () => { f.elements.barkod.value = (await api('GET', '/api/yeni-barkod')).barkod; };
    $('#iptal', k).onclick = () => { modalKapat(); coz(null); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const g = Object.fromEntries(new FormData(f));
      for (const a of ['alis_fiyat', 'satis_fiyat', 'kdv', 'stok', 'min_stok']) if (a in g) g[a] = sayiOku(g[a]);
      try {
        const kaydedilen = urun.id ? await api('PUT', '/api/urunler/' + urun.id, g) : await api('POST', '/api/urunler', g);
        await urunleriYukle();
        toast('Ürün kaydedildi', 'basari');
        modalKapat();
        coz(urunGetir(kaydedilen.id));
      } catch (err) { toast(err.message, 'hata'); }
    };
  });
}

// ================= SATIŞ =================
function sepetKaydet() { yerel.koy('sepet', durum.sepet); }
function sepetHesap() {
  const satirlar = durum.sepet.map((s) => {
    const u = urunGetir(s.urun_id);
    return { ...s, u, tutar: yuvarla(s.miktar * s.birim_fiyat) };
  }).filter((s) => s.u);
  const ara = yuvarla(satirlar.reduce((t, s) => t + s.tutar, 0));
  return { satirlar, ara };
}

function sepeteEkle(u, carpan) {
  const miktar = carpan || 1;
  const var_ = durum.sepet.find((s) => s.urun_id === u.id && s.birim_fiyat === u.satis_fiyat);
  const sepettekiToplam = durum.sepet.filter((s) => s.urun_id === u.id).reduce((t, s) => t + s.miktar, 0);
  if (var_) var_.miktar = yuvarla(var_.miktar + miktar);
  else durum.sepet.push({ urun_id: u.id, miktar, birim_fiyat: u.satis_fiyat });
  durum.sonUrun = u;
  bip(false);
  if (sepettekiToplam + miktar > u.stok) toast(`Dikkat: "${u.ad}" stokta ${sayiFmt(u.stok)} ${u.birim} var`, 'hata');
  sepetKaydet();
  satisCiz();
}

let satisOdeme = { tip: 'NAKIT', alinan: '', iskonto: '' };

function satisSayfa() {
  const el = $('#icerik');
  el.innerHTML = `
    <h1>🛒 Satış <span class="sag"><button class="btn" id="sepet-bosalt">Sepeti boşalt</button></span></h1>
    <div class="satis-duzen">
      <div>
        <div class="arama-sonuc">
          <div class="okut"><span>▮▯▮</span>
            <input id="okut" placeholder="Barkod okutun veya ürün adı yazın…  (3*barkod = 3 adet)" autocomplete="off">
          </div>
        </div>
        <div id="son-urun"></div>
        <div class="kart tablo-kap" id="sepet"></div>
      </div>
      <div class="kart toplam-kutu" id="odeme"></div>
    </div>`;
  const inp = $('#okut');
  aktifOdak = inp;
  okutmaBagla(inp, {
    secildi: sepeteEkle,
    bulunamadi: async (barkod) => {
      const tanimla = await onayla(`"${barkod}" barkodlu ürün bulunamadı. Yeni ürün olarak tanımlansın mı?`, 'Tanımla');
      if (!tanimla) return;
      const u = await urunFormu({ barkod });
      if (u) sepeteEkle(u);
    },
  });
  $('#sepet-bosalt').onclick = async () => {
    if (durum.sepet.length && await onayla('Sepet boşaltılsın mı?')) { durum.sepet = []; durum.sonUrun = null; sepetKaydet(); satisCiz(); }
  };
  satisCiz();
  inp.focus();
}

function satisCiz() {
  if (!$('#sepet')) return;
  const { satirlar, ara } = sepetHesap();
  const u = durum.sonUrun && urunGetir(durum.sonUrun.id);
  $('#son-urun').innerHTML = u ? `
    <div class="son-urun">
      <div><div class="ad">${kac(u.ad)}</div><div class="soluk mono">${kac(u.barkod)} ${u.kategori ? '· ' + kac(u.kategori) : ''}</div></div>
      <div class="deger"><small>Fiyat</small><b>${para(u.satis_fiyat)}</b></div>
      <div class="deger"><small>Elde (stok)</small><b>${stokRozet(u)}</b></div>
    </div>` : '';

  $('#sepet').innerHTML = satirlar.length ? `
    <table>
      <thead><tr><th>Ürün</th><th class="sag">Fiyat</th><th class="orta">Miktar</th><th class="sag">Elde</th><th class="sag">Tutar</th><th></th></tr></thead>
      <tbody>${satirlar.map((s, i) => `
        <tr data-i="${i}">
          <td><b>${kac(s.u.ad)}</b><br><small class="soluk mono">${kac(s.u.barkod)}</small></td>
          <td class="sag"><input class="hucre" data-fiyat value="${s.birim_fiyat}" inputmode="decimal" title="Bu satış için fiyatı değiştir"></td>
          <td class="orta"><span class="adet-kontrol"><button data-azalt>−</button><input data-miktar value="${s.miktar}" inputmode="decimal"><button data-arttir>+</button></span></td>
          <td class="sag">${stokRozet(s.u)}</td>
          <td class="sag"><b>${para(s.tutar)}</b></td>
          <td class="sag"><button class="btn kucuk kirmizi" data-sil>✕</button></td>
        </tr>`).join('')}</tbody>
    </table>` : '<div class="bos">Sepet boş — ürün barkodunu okutun.</div>';

  $('#sepet').onclick = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const s = durum.sepet[Number(tr.dataset.i)];
    if (e.target.closest('[data-sil]')) durum.sepet.splice(Number(tr.dataset.i), 1);
    else if (e.target.closest('[data-arttir]')) s.miktar = yuvarla(s.miktar + 1);
    else if (e.target.closest('[data-azalt]')) { s.miktar = yuvarla(s.miktar - 1); if (s.miktar <= 0) durum.sepet.splice(Number(tr.dataset.i), 1); }
    else return;
    sepetKaydet(); satisCiz(); aktifOdak.focus();
  };
  $('#sepet').onchange = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const s = durum.sepet[Number(tr.dataset.i)];
    if (e.target.matches('[data-miktar]')) { s.miktar = sayiOku(e.target.value); if (s.miktar <= 0) durum.sepet.splice(Number(tr.dataset.i), 1); }
    if (e.target.matches('[data-fiyat]')) s.birim_fiyat = Math.max(0, yuvarla(sayiOku(e.target.value)));
    sepetKaydet(); satisCiz(); aktifOdak.focus();
  };
  $$('#sepet input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); }));

  const iskonto = Math.min(Math.max(sayiOku(satisOdeme.iskonto), 0), ara);
  const toplam = yuvarla(ara - iskonto);
  const alinan = satisOdeme.alinan === '' ? toplam : sayiOku(satisOdeme.alinan);
  const paraUstu = yuvarla(alinan - toplam);
  const adet = satirlar.reduce((t, s) => t + s.miktar, 0);
  $('#odeme').innerHTML = `
    <div class="ozet-satir"><span>Kalem / Ürün adedi</span><b>${satirlar.length} / ${sayiFmt(adet)}</b></div>
    <div class="ozet-satir"><span>Ara toplam</span><b>${para(ara)}</b></div>
    <div class="alan satir" style="margin-top:6px"><div><label>İskonto (₺)</label><input id="iskonto" inputmode="decimal" value="${kac(satisOdeme.iskonto)}" placeholder="0"></div></div>
    <div class="soluk">Ödenecek</div>
    <div class="toplam-rakam">${para(toplam)}</div>
    <div class="odeme-tipleri">
      ${[['NAKIT', '💵 Nakit'], ['KART', '💳 Kart'], ['DIGER', '🔁 Diğer']].map(([t, y]) => `<button class="btn ${satisOdeme.tip === t ? 'secili' : ''}" data-tip="${t}">${y}</button>`).join('')}
    </div>
    ${satisOdeme.tip === 'NAKIT' ? `
      <div class="alan"><label>Alınan nakit</label><input id="alinan" inputmode="decimal" value="${kac(satisOdeme.alinan)}" placeholder="${paraFmt.format(toplam)}">
        <div class="hizli-para">${[50, 100, 200, 500, 1000].filter((p) => p >= toplam || p === 1000).slice(0, 4).map((p) => `<button class="btn kucuk" data-para="${p}">${p} ₺</button>`).join('')}</div></div>
      <div class="ozet-satir"><span>Para üstü</span><span class="para-ustu">${paraUstu >= 0 ? para(paraUstu) : '<span style="color:var(--kirmizi)">Eksik ' + para(-paraUstu) + '</span>'}</span></div>` : ''}
    <button class="btn yesil buyuk" id="satis-tamamla" ${satirlar.length ? '' : 'disabled'} style="margin-top:12px">✔ Satışı Tamamla <small>(F9)</small></button>`;

  $('#odeme').onclick = (e) => {
    const t = e.target.closest('[data-tip]');
    if (t) { satisOdeme.tip = t.dataset.tip; satisCiz(); return; }
    const p = e.target.closest('[data-para]');
    if (p) { satisOdeme.alinan = p.dataset.para; satisCiz(); return; }
  };
  $('#iskonto').onchange = (e) => { satisOdeme.iskonto = e.target.value; satisCiz(); };
  if ($('#alinan')) {
    $('#alinan').onchange = (e) => { satisOdeme.alinan = e.target.value; satisCiz(); };
    $('#alinan').onkeydown = (e) => { if (e.key === 'Enter') { satisOdeme.alinan = e.target.value; satisTamamla(); } };
  }
  $('#satis-tamamla').onclick = satisTamamla;
}

let satisGonderiliyor = false;
async function satisTamamla() {
  if (satisGonderiliyor || !durum.sepet.length) return;
  const eksiyeIzin = durum.ayarlar.eksi_stok === '1';
  satisGonderiliyor = true;
  try {
    const g = {
      kalemler: durum.sepet,
      odeme_tipi: satisOdeme.tip,
      iskonto: sayiOku(satisOdeme.iskonto),
      alinan: satisOdeme.alinan === '' ? undefined : sayiOku(satisOdeme.alinan),
      eksiyeIzinVer: eksiyeIzin,
    };
    let satis;
    try {
      satis = await api('POST', '/api/satislar', g);
    } catch (err) {
      if (!err.message.startsWith('Yetersiz stok')) throw err;
      if (!(await onayla(err.message + ' — Yine de satılsın mı? (stok eksiye düşer)', 'Evet, sat'))) return;
      satis = await api('POST', '/api/satislar', { ...g, eksiyeIzinVer: true });
    }
    durum.sepet = []; durum.sonUrun = null; sepetKaydet();
    satisOdeme = { tip: 'NAKIT', alinan: '', iskonto: '' };
    await urunleriYukle();
    toast(`Satış tamamlandı: ${satis.fis_no} — ${para(satis.toplam)}${satis.para_ustu > 0 ? ' · Para üstü ' + para(satis.para_ustu) : ''}`, 'basari');
    if (durum.ayarlar.otomatik_fis === '1') fisYazdir(satis);
    satisCiz();
  } catch (err) {
    bip(true);
    toast(err.message, 'hata');
  } finally {
    satisGonderiliyor = false;
    aktifOdak?.focus();
  }
}

// ================= STOK GİRİŞ / ÇIKIŞ / SAYIM =================
const STOK_MODLAR = {
  GIRIS: { ad: '📥 Stok Girişi', buton: 'Stoğa Ekle', aciklama: 'Gelen malı okutun; miktarlar mevcut stoğa eklenir.' },
  CIKIS: { ad: '📤 Stok Çıkışı', buton: 'Stoktan Düş', aciklama: 'Fire, zayi, iade, iç kullanım vb. — miktarlar stoktan düşülür.' },
  SAYIM: { ad: '🔢 Sayım', buton: 'Sayımı Uygula', aciklama: 'Saydığınız gerçek miktarı girin; stok bu değere eşitlenir.' },
};

function stokSayfa() {
  const el = $('#icerik');
  const m = STOK_MODLAR[durum.stokMod];
  el.innerHTML = `
    <h1>${m.ad}
      <span class="sag">${Object.entries(STOK_MODLAR).map(([k, v]) => `<button class="btn ${k === durum.stokMod ? 'secili' : ''}" data-mod="${k}">${v.ad}</button>`).join('')}</span>
    </h1>
    <p class="soluk" style="margin-top:-8px">${m.aciklama}</p>
    <div class="arama-sonuc">
      <div class="okut"><span>▮▯▮</span>
        <input id="okut" placeholder="Barkod okutun veya ürün adı yazın…" autocomplete="off">
        <input id="okut-miktar" class="miktar-giris" value="1" title="Her okutmada eklenecek miktar" inputmode="decimal">
      </div>
    </div>
    <div class="kart tablo-kap" id="stok-liste"></div>
    <div class="kart" style="margin-top:14px">
      <div class="satir">
        <div><label>Açıklama (tedarikçi, fatura no, fire nedeni…)</label><input id="stok-aciklama"></div>
        ${durum.stokMod === 'GIRIS' ? `
          <label class="dar" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="alis-guncelle" style="width:auto" checked> Alış fiyatlarını güncelle</label>
          <label class="dar" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="etiket-sonra" style="width:auto"> Sonra etiket bas</label>` : ''}
        <button class="btn dar" id="liste-temizle">Listeyi temizle</button>
        <button class="btn ana dar" id="stok-kaydet">${m.buton}</button>
      </div>
    </div>`;

  $$('[data-mod]').forEach((b) => (b.onclick = () => {
    if (durum.stokMod === b.dataset.mod) return;
    durum.stokMod = b.dataset.mod;
    durum.stokListe = [];
    stokSayfa();
  }));
  const inp = $('#okut');
  aktifOdak = inp;
  const ekle = (u, carpan) => {
    const miktar = carpan ?? (sayiOku($('#okut-miktar').value) || 1);
    const var_ = durum.stokListe.find((s) => s.urun_id === u.id);
    if (var_) var_.miktar = yuvarla(var_.miktar + miktar);
    else durum.stokListe.unshift({ urun_id: u.id, miktar, birim_fiyat: u.alis_fiyat });
    bip(false);
    stokListeCiz();
  };
  okutmaBagla(inp, {
    secildi: ekle,
    bulunamadi: async (barkod, carpan) => {
      if (durum.stokMod !== 'GIRIS') return toast(`"${barkod}" bulunamadı`, 'hata');
      toast('Yeni ürün — bilgilerini girin');
      const u = await urunFormu({ barkod }, { stokGoster: false });
      if (u) ekle(u, carpan);
    },
  });
  $('#liste-temizle').onclick = () => { durum.stokListe = []; stokListeCiz(); inp.focus(); };
  $('#stok-kaydet').onclick = stokKaydet;
  stokListeCiz();
  inp.focus();
}

function stokListeCiz() {
  const kap = $('#stok-liste');
  if (!kap) return;
  const mod = durum.stokMod;
  const satirlar = durum.stokListe.map((s) => ({ ...s, u: urunGetir(s.urun_id) })).filter((s) => s.u);
  if (!satirlar.length) { kap.innerHTML = '<div class="bos">Liste boş — ürün okutun.</div>'; return; }
  const yeni = (s) => mod === 'GIRIS' ? s.u.stok + s.miktar : mod === 'CIKIS' ? s.u.stok - s.miktar : s.miktar;
  const toplamMaliyet = satirlar.reduce((t, s) => t + s.miktar * s.birim_fiyat, 0);
  kap.innerHTML = `
    <table>
      <thead><tr><th>Ürün</th><th class="sag">Mevcut</th><th class="sag">${mod === 'SAYIM' ? 'Sayılan' : 'Miktar'}</th>
        ${mod === 'GIRIS' ? '<th class="sag">Alış fiyatı</th><th class="sag">Satış fiyatı</th>' : ''}
        <th class="sag">Yeni stok</th><th></th></tr></thead>
      <tbody>${satirlar.map((s, i) => `
        <tr data-i="${i}">
          <td><b>${kac(s.u.ad)}</b><br><small class="soluk mono">${kac(s.u.barkod)}</small></td>
          <td class="sag">${stokRozet(s.u)}</td>
          <td class="sag"><input class="hucre" data-alan="miktar" value="${s.miktar}" inputmode="decimal"></td>
          ${mod === 'GIRIS' ? `<td class="sag"><input class="hucre" data-alan="birim_fiyat" value="${s.birim_fiyat}" inputmode="decimal"></td>
            <td class="sag">${para(s.u.satis_fiyat)}</td>` : ''}
          <td class="sag"><b>${sayiFmt(yeni(s))} ${kac(s.u.birim)}</b></td>
          <td class="sag"><button class="btn kucuk kirmizi" data-sil>✕</button></td>
        </tr>`).join('')}</tbody>
      ${mod === 'GIRIS' ? `<tfoot><tr><td colspan="3"><b>${satirlar.length} kalem</b></td><td class="sag"><b>${para(toplamMaliyet)}</b></td><td colspan="3"></td></tr></tfoot>` : ''}
    </table>`;
  kap.onclick = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (tr && e.target.closest('[data-sil]')) { durum.stokListe.splice(Number(tr.dataset.i), 1); stokListeCiz(); aktifOdak.focus(); }
  };
  kap.onchange = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr || !e.target.dataset.alan) return;
    durum.stokListe[Number(tr.dataset.i)][e.target.dataset.alan] = sayiOku(e.target.value);
    stokListeCiz(); aktifOdak.focus();
  };
  $$('input', kap).forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); }));
}

async function stokKaydet() {
  if (!durum.stokListe.length) return toast('Liste boş', 'hata');
  const mod = durum.stokMod;
  const g = {
    tip: mod,
    kalemler: durum.stokListe,
    aciklama: $('#stok-aciklama').value,
    alisFiyatGuncelle: $('#alis-guncelle')?.checked,
  };
  try {
    try {
      await api('POST', '/api/stok-hareket', g);
    } catch (err) {
      if (!err.message.includes('yeterli stok')) throw err;
      if (!(await onayla(err.message + ' — Yine de düşülsün mü?', 'Evet'))) return;
      await api('POST', '/api/stok-hareket', { ...g, eksiyeIzinVer: true });
    }
    const etiketBas = mod === 'GIRIS' && $('#etiket-sonra')?.checked;
    const liste = durum.stokListe;
    durum.stokListe = [];
    await urunleriYukle();
    toast(`${liste.length} kalem işlendi`, 'basari');
    if (etiketBas) {
      for (const s of liste) etiketKuyrugaEkle(s.urun_id, Math.max(1, Math.ceil(s.miktar)));
      location.hash = '#/etiket';
    } else stokListeCiz();
  } catch (err) { toast(err.message, 'hata'); }
}

// ================= ÜRÜNLER =================
let urunFiltre = { ara: '', kritik: false };
function urunlerSayfa() {
  const el = $('#icerik');
  el.innerHTML = `
    <h1>📦 Ürünler & Stok
      <span class="sag"><button class="btn" id="csv">⬇ Excel (CSV)</button><button class="btn ana" id="yeni-urun">+ Yeni ürün</button></span></h1>
    <div class="kart" style="margin-bottom:14px">
      <div class="satir">
        <div><input id="urun-ara" placeholder="Ad, barkod veya kategori ile ara… (barkod okutabilirsiniz)" value="${kac(urunFiltre.ara)}"></div>
        <label class="dar" style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="kritik" style="width:auto" ${urunFiltre.kritik ? 'checked' : ''}> Sadece kritik / biten stok</label>
      </div>
    </div>
    <div class="kart tablo-kap" id="urun-tablo"></div>`;
  aktifOdak = $('#urun-ara');
  $('#urun-ara').oninput = (e) => { urunFiltre.ara = e.target.value; urunTabloCiz(); };
  $('#urun-ara').onkeydown = (e) => { if (e.key === 'Enter') e.target.select(); };
  $('#kritik').onchange = (e) => { urunFiltre.kritik = e.target.checked; urunTabloCiz(); };
  $('#yeni-urun').onclick = async () => { await urunFormu(); urunTabloCiz(); };
  $('#csv').onclick = csvIndir;
  urunTabloCiz();
  $('#urun-ara').focus();
}

function filtreliUrunler() {
  const q = urunFiltre.ara.toLocaleLowerCase('tr').trim();
  return durum.urunler.filter((u) =>
    (!q || u.ad.toLocaleLowerCase('tr').includes(q) || u.barkod.includes(q) || u.kategori.toLocaleLowerCase('tr').includes(q)) &&
    (!urunFiltre.kritik || u.stok <= u.min_stok));
}

function urunTabloCiz() {
  const liste = filtreliUrunler();
  const kap = $('#urun-tablo');
  const topAdet = liste.reduce((t, u) => t + u.stok, 0);
  const topDeger = liste.reduce((t, u) => t + Math.max(u.stok, 0) * u.satis_fiyat, 0);
  kap.innerHTML = liste.length ? `
    <table>
      <thead><tr><th>Barkod</th><th>Ürün</th><th>Kategori</th><th class="sag">Alış</th><th class="sag">Satış</th><th class="sag">Elde</th><th class="sag">Stok değeri</th><th class="sag">İşlem</th></tr></thead>
      <tbody>${liste.map((u) => `
        <tr data-id="${u.id}">
          <td class="mono">${kac(u.barkod)}</td>
          <td><b>${kac(u.ad)}</b></td>
          <td class="soluk">${kac(u.kategori)}</td>
          <td class="sag soluk">${para(u.alis_fiyat)}</td>
          <td class="sag"><b>${para(u.satis_fiyat)}</b></td>
          <td class="sag">${stokRozet(u)}</td>
          <td class="sag">${para(Math.max(u.stok, 0) * u.satis_fiyat)}</td>
          <td class="sag" style="white-space:nowrap">
            <button class="btn kucuk" data-islem="etiket" title="Etiket kuyruğuna ekle">🏷️</button>
            <button class="btn kucuk" data-islem="hareket" title="Stok hareketleri">↕️</button>
            <button class="btn kucuk" data-islem="duzenle">Düzenle</button>
            <button class="btn kucuk kirmizi" data-islem="sil">Sil</button>
          </td>
        </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5"><b>${liste.length} ürün</b></td><td class="sag"><b>${sayiFmt(topAdet)}</b></td><td class="sag"><b>${para(topDeger)}</b></td><td></td></tr></tfoot>
    </table>` : `<div class="bos">${durum.urunler.length ? 'Eşleşen ürün yok.' : 'Henüz ürün yok. “+ Yeni ürün” ile ya da Stok Giriş ekranında barkod okutarak ekleyin.'}</div>`;
  kap.onclick = async (e) => {
    const b = e.target.closest('[data-islem]');
    if (!b) return;
    const u = urunGetir(b.closest('tr').dataset.id);
    if (b.dataset.islem === 'duzenle') { await urunFormu(u); urunTabloCiz(); }
    if (b.dataset.islem === 'etiket') { etiketKuyrugaEkle(u.id, 1); toast(`"${u.ad}" etiket kuyruğuna eklendi`); }
    if (b.dataset.islem === 'hareket') { hareketFiltre = { urun_id: u.id, tip: '', bas: '', bit: '' }; location.hash = '#/hareketler'; }
    if (b.dataset.islem === 'sil' && await onayla(`"${u.ad}" silinsin mi? (geçmiş kayıtlar korunur)`, 'Sil')) {
      try { await api('DELETE', '/api/urunler/' + u.id); await urunleriYukle(); urunTabloCiz(); toast('Silindi'); } catch (err) { toast(err.message, 'hata'); }
    }
  };
}

function csvIndir() {
  const bas = ['Barkod', 'Ürün', 'Kategori', 'Birim', 'Alış', 'Satış', 'KDV', 'Stok', 'Kritik Stok'];
  const satir = (a) => a.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';');
  const icerik = [satir(bas), ...filtreliUrunler().map((u) => satir([u.barkod, u.ad, u.kategori, u.birim,
    String(u.alis_fiyat).replace('.', ','), String(u.satis_fiyat).replace('.', ','), u.kdv, String(u.stok).replace('.', ','), u.min_stok]))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + icerik], { type: 'text/csv;charset=utf-8' }));
  a.download = `stok-${bugunStr()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ================= ETİKET BASMA =================
const ETIKET_VARSAYILAN = { mod: 'rulo', gen: 50, yuk: 30, sutun: 4, bosluk: 2, kenar: 8, adGoster: true, fiyatGoster: true, kodGoster: true, isletmeGoster: false };
let etiketAyar = { ...ETIKET_VARSAYILAN, ...yerel.al('etiketAyar', {}) };

function etiketKuyrugaEkle(urunId, adet) {
  const var_ = durum.etiketKuyruk.find((e) => e.urun_id === urunId);
  if (var_) var_.adet += adet; else durum.etiketKuyruk.push({ urun_id: urunId, adet });
  yerel.koy('etiketKuyruk', durum.etiketKuyruk);
}

function etiketHtml(u, ayar = etiketAyar) {
  const h = Number(ayar.yuk), w = Number(ayar.gen);
  const adPt = Math.max(6, Math.min(11, h * 0.28));
  const fiyatPt = Math.max(8, Math.min(20, h * 0.5));
  let barkodSvg = '';
  try { barkodSvg = Barkod.svg(u.barkod, { yaziGoster: ayar.kodGoster }); } catch (e) { barkodSvg = `<small>${kac(e.message)}</small>`; }
  return `<div class="etiket ${ayar.mod === 'rulo' ? 'tek' : ''}" style="width:${w}mm;height:${h}mm">
    ${ayar.isletmeGoster && durum.ayarlar.isletme_adi ? `<div style="font-size:${adPt * 0.8}pt">${kac(durum.ayarlar.isletme_adi)}</div>` : ''}
    ${ayar.adGoster ? `<div class="e-ad" style="font-size:${adPt}pt">${kac(u.ad)}</div>` : ''}
    <div class="e-barkod">${barkodSvg}</div>
    ${ayar.fiyatGoster ? `<div class="e-fiyat" style="font-size:${fiyatPt}pt">${para(u.satis_fiyat)}</div>` : ''}
  </div>`;
}

function etiketSayfa() {
  const el = $('#icerik');
  const a = etiketAyar;
  el.innerHTML = `
    <h1>🏷️ Barkod Etiketi Bas
      <span class="sag"><button class="btn" id="kuyruk-temizle">Kuyruğu temizle</button>
      <button class="btn" id="stoktaki-hepsi" title="Stoğu olan tüm ürünler, stok adedi kadar">Tüm stok kadar ekle</button>
      <button class="btn ana" id="yazdir">🖨️ Yazdır</button></span></h1>
    <div class="izgara" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">
      <div>
        <div class="arama-sonuc">
          <div class="okut"><span>▮▯▮</span>
            <input id="okut" placeholder="Etiketi basılacak ürünü okutun veya adını yazın…" autocomplete="off">
            <input id="okut-miktar" class="miktar-giris" value="1" title="Kaç etiket" inputmode="numeric">
          </div>
        </div>
        <div class="kart tablo-kap" id="kuyruk" style="margin-bottom:14px"></div>
        <div class="kart"><h2>Önizleme</h2><div class="etiket-onizleme" id="onizleme"></div></div>
      </div>
      <div class="kart" id="etiket-ayar">
        <h2>Etiket ayarları</h2>
        <div class="alan"><label>Yazıcı tipi</label>
          <select name="mod"><option value="rulo" ${a.mod === 'rulo' ? 'selected' : ''}>Etiket yazıcısı (rulo, her sayfa 1 etiket)</option>
          <option value="a4" ${a.mod === 'a4' ? 'selected' : ''}>A4 etiket kâğıdı (ızgara)</option></select></div>
        <div class="satir alan">
          <div><label>Genişlik (mm)</label><input name="gen" value="${a.gen}" inputmode="decimal"></div>
          <div><label>Yükseklik (mm)</label><input name="yuk" value="${a.yuk}" inputmode="decimal"></div>
        </div>
        <div class="soluk" style="margin:-4px 0 10px;font-size:13px">Hazır: ${[[40, 20], [50, 30], [58, 40], [70, 40], [100, 50]].map(([g, y]) => `<a href="#" data-boy="${g}x${y}">${g}×${y}</a>`).join(' · ')}</div>
        <div id="a4-ayar" style="${a.mod === 'a4' ? '' : 'display:none'}">
          <div class="satir alan">
            <div><label>Sütun sayısı</label><input name="sutun" value="${a.sutun}" inputmode="numeric"></div>
            <div><label>Aralık (mm)</label><input name="bosluk" value="${a.bosluk}" inputmode="decimal"></div>
            <div><label>Kenar (mm)</label><input name="kenar" value="${a.kenar}" inputmode="decimal"></div>
          </div>
        </div>
        ${[['adGoster', 'Ürün adını yaz'], ['fiyatGoster', 'Fiyatı yaz'], ['kodGoster', 'Barkod numarasını yaz'], ['isletmeGoster', 'İşletme adını yaz']].map(([k, y]) =>
          `<label style="display:flex;gap:8px;align-items:center;color:var(--yazi);font-size:14px"><input type="checkbox" name="${k}" style="width:auto" ${a[k] ? 'checked' : ''}> ${y}</label>`).join('')}
        <p class="soluk" style="font-size:12.5px;margin-bottom:0">İpucu: Yazdırma penceresinde <b>kenar boşluğu: Yok</b> ve <b>ölçek: %100</b> seçin; etiket yazıcısında kâğıt boyutunu etiket ölçüsüne ayarlayın.</p>
      </div>
    </div>`;

  const ayarKap = $('#etiket-ayar');
  ayarKap.addEventListener('change', (e) => {
    const n = e.target.name;
    if (!n) return;
    etiketAyar[n] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'select-one' ? e.target.value : sayiOku(e.target.value);
    yerel.koy('etiketAyar', etiketAyar);
    $('#a4-ayar').style.display = etiketAyar.mod === 'a4' ? '' : 'none';
    kuyrukCiz();
  });
  ayarKap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-boy]');
    if (!b) return;
    e.preventDefault();
    const [g, y] = b.dataset.boy.split('x').map(Number);
    etiketAyar.gen = g; etiketAyar.yuk = y;
    yerel.koy('etiketAyar', etiketAyar);
    $('[name=gen]', ayarKap).value = g; $('[name=yuk]', ayarKap).value = y;
    kuyrukCiz();
  });

  const inp = $('#okut');
  aktifOdak = inp;
  okutmaBagla(inp, {
    secildi: (u, carpan) => { etiketKuyrugaEkle(u.id, Math.max(1, Math.round(carpan ?? (sayiOku($('#okut-miktar').value) || 1)))); bip(); kuyrukCiz(); },
    bulunamadi: (b) => toast(`"${b}" bulunamadı`, 'hata'),
  });
  $('#kuyruk-temizle').onclick = () => { durum.etiketKuyruk = []; yerel.koy('etiketKuyruk', []); kuyrukCiz(); };
  $('#stoktaki-hepsi').onclick = () => {
    durum.urunler.filter((u) => u.stok > 0).forEach((u) => etiketKuyrugaEkle(u.id, Math.ceil(u.stok)));
    kuyrukCiz();
  };
  $('#yazdir').onclick = etiketYazdir;
  kuyrukCiz();
  inp.focus();
}

function kuyrukCiz() {
  const satirlar = durum.etiketKuyruk.map((e) => ({ ...e, u: urunGetir(e.urun_id) })).filter((e) => e.u);
  const toplam = satirlar.reduce((t, s) => t + s.adet, 0);
  $('#kuyruk').innerHTML = satirlar.length ? `
    <table><thead><tr><th>Ürün</th><th class="sag">Fiyat</th><th class="sag">Elde</th><th class="sag">Etiket adedi</th><th></th></tr></thead>
    <tbody>${satirlar.map((s, i) => `<tr data-i="${i}">
      <td><b>${kac(s.u.ad)}</b><br><small class="soluk mono">${kac(s.u.barkod)}</small></td>
      <td class="sag">${para(s.u.satis_fiyat)}</td><td class="sag">${stokRozet(s.u)}</td>
      <td class="sag"><input class="hucre" data-adet value="${s.adet}" inputmode="numeric"></td>
      <td class="sag"><button class="btn kucuk kirmizi" data-sil>✕</button></td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="3"><b>${satirlar.length} ürün</b></td><td class="sag"><b>${toplam} etiket</b></td><td></td></tr></tfoot></table>`
    : '<div class="bos">Kuyruk boş — ürün okutun ya da Ürünler sayfasından 🏷️ ile ekleyin.</div>';
  $('#kuyruk').onclick = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (tr && e.target.closest('[data-sil]')) { durum.etiketKuyruk.splice(Number(tr.dataset.i), 1); yerel.koy('etiketKuyruk', durum.etiketKuyruk); kuyrukCiz(); }
  };
  $('#kuyruk').onchange = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    durum.etiketKuyruk[Number(tr.dataset.i)].adet = Math.max(0, Math.round(sayiOku(e.target.value)));
    yerel.koy('etiketKuyruk', durum.etiketKuyruk); kuyrukCiz();
  };
  // Önizleme: her üründen 1 örnek
  $('#onizleme').innerHTML = satirlar.length ? satirlar.slice(0, 12).map((s) => etiketHtml(s.u)).join('') : '<span class="soluk">—</span>';
  $$('#onizleme .etiket').forEach((e) => e.classList.remove('tek'));
}

function yazdir(html, sayfaCss) {
  const alan = $('#yazdir-alani');
  alan.innerHTML = html;
  let stil = $('#sayfa-stil');
  if (!stil) { stil = document.createElement('style'); stil.id = 'sayfa-stil'; document.head.appendChild(stil); }
  stil.textContent = `@media print { ${sayfaCss} }`;
  document.body.classList.add('yazdiriliyor');
  const bitir = () => { document.body.classList.remove('yazdiriliyor'); alan.innerHTML = ''; stil.textContent = ''; odakGeriVer(); };
  window.addEventListener('afterprint', bitir, { once: true });
  setTimeout(() => window.print(), 50);
}

function etiketYazdir() {
  const liste = durum.etiketKuyruk.map((e) => ({ ...e, u: urunGetir(e.urun_id) })).filter((e) => e.u && e.adet > 0);
  if (!liste.length) return toast('Yazdırılacak etiket yok', 'hata');
  const a = etiketAyar;
  const hepsi = liste.flatMap((s) => Array.from({ length: s.adet }, () => etiketHtml(s.u)));
  if (a.mod === 'rulo') {
    yazdir(hepsi.join(''), `@page { size: ${a.gen}mm ${a.yuk}mm; margin: 0; } body { margin: 0; }`);
  } else {
    yazdir(`<div class="a4-izgara" style="grid-template-columns:repeat(${a.sutun}, ${a.gen}mm);gap:${a.bosluk}mm">${hepsi.join('')}</div>`,
      `@page { size: A4; margin: ${a.kenar}mm; } body { margin: 0; }`);
  }
}

// ================= FİŞ =================
function fisYazdir(s) {
  const ay = durum.ayarlar;
  const tipAd = { NAKIT: 'Nakit', KART: 'Kredi Kartı', DIGER: 'Diğer' }[s.odeme_tipi];
  yazdir(`<div class="fis">
    <h3>${kac(ay.isletme_adi || 'SATIŞ FİŞİ')}</h3>
    ${ay.fis_ust ? `<div class="ortala">${kac(ay.fis_ust)}</div>` : ''}
    <div class="ortala">${tarihFmt(s.tarih)} · ${kac(s.fis_no)}</div>${s.iptal ? '<div class="ortala buyuk">*** İPTAL ***</div>' : ''}
    <hr><table style="width:100%">${s.kalemler.map((k) => `
      <tr><td colspan="2">${kac(k.ad)}</td></tr>
      <tr><td>&nbsp; ${sayiFmt(k.miktar)} x ${paraFmt.format(k.birim_fiyat)}</td><td style="text-align:right">${paraFmt.format(k.tutar)}</td></tr>`).join('')}
    </table><hr>
    <table style="width:100%">
      ${s.iskonto > 0 ? `<tr><td>İskonto</td><td style="text-align:right">-${paraFmt.format(s.iskonto)}</td></tr>` : ''}
      <tr class="buyuk"><td>TOPLAM</td><td style="text-align:right">${para(s.toplam)}</td></tr>
      <tr><td>${tipAd}</td><td style="text-align:right">${paraFmt.format(s.alinan)}</td></tr>
      ${s.para_ustu > 0 ? `<tr><td>Para üstü</td><td style="text-align:right">${paraFmt.format(s.para_ustu)}</td></tr>` : ''}
    </table><hr>
    <div class="ortala">${kac(ay.fis_alt || 'Teşekkür ederiz')}</div>
  </div>`, '@page { size: 80mm auto; margin: 3mm; } body { margin: 0; }');
}

// ================= SATIŞLAR =================
let satisFiltre = { bas: bugunStr(), bit: bugunStr() };
async function satislarSayfa() {
  const el = $('#icerik');
  el.innerHTML = `
    <h1>🧾 Satışlar</h1>
    <div class="kart" style="margin-bottom:14px"><div class="satir">
      <div><label>Başlangıç</label><input type="date" id="bas" value="${satisFiltre.bas}"></div>
      <div><label>Bitiş</label><input type="date" id="bit" value="${satisFiltre.bit}"></div>
      <button class="btn dar" data-aralik="0">Bugün</button><button class="btn dar" data-aralik="7">Son 7 gün</button><button class="btn dar" data-aralik="30">Son 30 gün</button>
    </div></div>
    <div class="kpi-izgara" id="satis-kpi"></div>
    <div class="kart tablo-kap" id="satis-tablo"><div class="bos">Yükleniyor…</div></div>`;
  aktifOdak = null;
  const yukle = async () => {
    satisFiltre = { bas: $('#bas').value, bit: $('#bit').value };
    const liste = await api('GET', `/api/satislar?bas=${satisFiltre.bas}&bit=${satisFiltre.bit}`);
    const gecerli = liste.filter((s) => !s.iptal);
    const top = (f) => gecerli.filter(f).reduce((t, s) => t + s.toplam, 0);
    $('#satis-kpi').innerHTML = [
      ['Toplam ciro', para(top(() => true))], ['Nakit', para(top((s) => s.odeme_tipi === 'NAKIT'))],
      ['Kart', para(top((s) => s.odeme_tipi === 'KART'))], ['Satış sayısı', gecerli.length + (liste.length > gecerli.length ? ` <small class="soluk">(+${liste.length - gecerli.length} iptal)</small>` : '')],
    ].map(([k, v]) => `<div class="kart kpi"><small>${k}</small><b>${v}</b></div>`).join('');
    $('#satis-tablo').innerHTML = liste.length ? `<table>
      <thead><tr><th>Fiş no</th><th>Tarih</th><th class="sag">Kalem</th><th>Ödeme</th><th class="sag">İskonto</th><th class="sag">Toplam</th><th></th></tr></thead>
      <tbody>${liste.map((s) => `<tr data-id="${s.id}" style="cursor:pointer;${s.iptal ? 'opacity:.5;text-decoration:line-through' : ''}">
        <td class="mono">${kac(s.fis_no)}</td><td>${tarihFmt(s.tarih)}</td><td class="sag">${s.kalem_sayisi}</td>
        <td>${{ NAKIT: '💵 Nakit', KART: '💳 Kart', DIGER: '🔁 Diğer' }[s.odeme_tipi]}</td>
        <td class="sag soluk">${s.iskonto ? para(s.iskonto) : ''}</td><td class="sag"><b>${para(s.toplam)}</b></td>
        <td class="sag">${s.iptal ? '<span class="rozet kirmizi">İptal</span>' : ''}</td></tr>`).join('')}</tbody></table>`
      : '<div class="bos">Bu aralıkta satış yok.</div>';
  };
  $$('[data-aralik]').forEach((b) => (b.onclick = () => {
    const d = new Date(); d.setDate(d.getDate() - Number(b.dataset.aralik));
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $('#bas').value = d.toISOString().slice(0, 10); $('#bit').value = bugunStr(); yukle();
  }));
  $('#bas').onchange = yukle; $('#bit').onchange = yukle;
  $('#satis-tablo').onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) satisDetayAc(tr.dataset.id, yukle); };
  await yukle();
}

async function satisDetayAc(id, yenile) {
  const s = await api('GET', '/api/satislar/' + id);
  const k = modalAc(`
    <h2>${kac(s.fis_no)} ${s.iptal ? '<span class="rozet kirmizi">İptal edildi</span>' : ''}</h2>
    <p class="soluk">${tarihFmt(s.tarih)} · ${{ NAKIT: 'Nakit', KART: 'Kart', DIGER: 'Diğer' }[s.odeme_tipi]}</p>
    <table><thead><tr><th>Ürün</th><th class="sag">Miktar</th><th class="sag">Fiyat</th><th class="sag">Tutar</th></tr></thead>
    <tbody>${s.kalemler.map((x) => `<tr><td>${kac(x.ad)}<br><small class="mono soluk">${kac(x.barkod)}</small></td><td class="sag">${sayiFmt(x.miktar)}</td><td class="sag">${para(x.birim_fiyat)}</td><td class="sag">${para(x.tutar)}</td></tr>`).join('')}</tbody></table>
    ${s.iskonto ? `<div class="ozet-satir"><span>İskonto</span><b>-${para(s.iskonto)}</b></div>` : ''}
    <div class="ozet-satir"><span>Toplam</span><b style="font-size:20px">${para(s.toplam)}</b></div>
    <div class="modal-alt">
      ${s.iptal ? '' : '<button class="btn kirmizi" id="iptal-et">Satışı iptal et (stoğa geri al)</button>'}
      <button class="btn" id="fis">🖨️ Fiş yazdır</button>
      <button class="btn ana" id="kapat">Kapat</button>
    </div>`, true);
  $('#kapat', k).onclick = modalKapat;
  $('#fis', k).onclick = () => { modalKapat(); fisYazdir(s); };
  if ($('#iptal-et', k)) $('#iptal-et', k).onclick = async () => {
    if (!(await onayla(`${s.fis_no} iptal edilsin mi? Ürünler stoğa geri eklenecek.`, 'İptal et'))) return;
    try { await api('POST', `/api/satislar/${s.id}/iptal`); await urunleriYukle(); toast('Satış iptal edildi, stok geri alındı', 'basari'); yenile?.(); }
    catch (err) { toast(err.message, 'hata'); }
  };
}

// ================= HAREKETLER =================
let hareketFiltre = { urun_id: '', tip: '', bas: '', bit: '' };
const TIP_AD = { GIRIS: ['Giriş', 'yesil'], SATIS: ['Satış', 'gri'], CIKIS: ['Çıkış', 'kirmizi'], IADE: ['İade', 'sari'], SAYIM: ['Sayım', 'sari'] };
async function hareketlerSayfa() {
  const el = $('#icerik');
  const f = hareketFiltre;
  el.innerHTML = `
    <h1>↕️ Stok Hareketleri</h1>
    <div class="kart" style="margin-bottom:14px"><div class="satir">
      <div><label>Ürün</label><select id="h-urun"><option value="">Tümü</option>${durum.urunler.map((u) => `<option value="${u.id}" ${String(f.urun_id) === String(u.id) ? 'selected' : ''}>${kac(u.ad)}</option>`).join('')}</select></div>
      <div><label>Tip</label><select id="h-tip"><option value="">Tümü</option>${Object.entries(TIP_AD).map(([k, [a]]) => `<option value="${k}" ${f.tip === k ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <div><label>Başlangıç</label><input type="date" id="h-bas" value="${f.bas}"></div>
      <div><label>Bitiş</label><input type="date" id="h-bit" value="${f.bit}"></div>
    </div></div>
    <div class="kart tablo-kap" id="h-tablo"><div class="bos">Yükleniyor…</div></div>`;
  aktifOdak = null;
  const yukle = async () => {
    hareketFiltre = { urun_id: $('#h-urun').value, tip: $('#h-tip').value, bas: $('#h-bas').value, bit: $('#h-bit').value };
    const liste = await api('GET', '/api/hareketler?' + new URLSearchParams(hareketFiltre));
    $('#h-tablo').innerHTML = liste.length ? `<table>
      <thead><tr><th>Tarih</th><th>Ürün</th><th>Tip</th><th class="sag">Miktar</th><th class="sag">Önceki</th><th class="sag">Sonraki</th><th class="sag">Birim fiyat</th><th>Açıklama</th></tr></thead>
      <tbody>${liste.map((h) => `<tr><td>${tarihFmt(h.tarih)}</td><td><b>${kac(h.ad)}</b><br><small class="mono soluk">${kac(h.barkod)}</small></td>
        <td><span class="rozet ${TIP_AD[h.tip]?.[1] || 'gri'}">${TIP_AD[h.tip]?.[0] || h.tip}</span></td>
        <td class="sag" style="color:${h.miktar >= 0 ? 'var(--yesil)' : 'var(--kirmizi)'}"><b>${h.miktar > 0 ? '+' : ''}${sayiFmt(h.miktar)}</b></td>
        <td class="sag soluk">${sayiFmt(h.onceki)}</td><td class="sag">${sayiFmt(h.sonraki)}</td>
        <td class="sag soluk">${para(h.birim_fiyat)}</td><td class="soluk">${kac(h.aciklama)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="bos">Kayıt yok.</div>';
  };
  $$('#h-urun, #h-tip, #h-bas, #h-bit').forEach((i) => (i.onchange = yukle));
  await yukle();
}

// ================= ÖZET =================
async function ozetSayfa() {
  const o = await api('GET', '/api/ozet');
  const kritik = durum.urunler.filter((u) => u.stok <= u.min_stok).sort((a, b) => a.stok - b.stok);
  $('#icerik').innerHTML = `
    <h1>📊 Özet</h1>
    <div class="kpi-izgara">
      ${[['Bugünkü ciro', para(o.bugun.ciro)], ['Bugünkü satış', o.bugun.adet], ['Nakit / Kart', `${para(o.bugun.nakit)}<small class="soluk" style="font-size:14px"> / ${para(o.bugun.kart)}</small>`],
        ['Ürün çeşidi', o.stok.urun_sayisi], ['Stok maliyet değeri', para(o.stok.maliyet_degeri)], ['Stok satış değeri', para(o.stok.satis_degeri)], ['Kritik stoktaki ürün', o.stok.kritik || 0]]
        .map(([k, v]) => `<div class="kart kpi"><small>${k}</small><b>${v}</b></div>`).join('')}
    </div>
    <div class="izgara" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <div class="kart"><h2>⚠️ Kritik / biten stok</h2>${kritik.length ? `<table><tbody>${kritik.slice(0, 20).map((u) => `<tr><td>${kac(u.ad)}</td><td class="sag">${stokRozet(u)}</td><td class="sag soluk">min ${sayiFmt(u.min_stok)}</td></tr>`).join('')}</tbody></table>` : '<div class="bos">Kritik ürün yok 👍</div>'}</div>
      <div class="kart"><h2>🏆 Bugün en çok satanlar</h2>${o.enCok.length ? `<table><tbody>${o.enCok.map((x) => `<tr><td>${kac(x.ad)}</td><td class="sag">${sayiFmt(x.miktar)}</td><td class="sag"><b>${para(x.tutar)}</b></td></tr>`).join('')}</tbody></table>` : '<div class="bos">Bugün henüz satış yok.</div>'}</div>
    </div>`;
  aktifOdak = null;
}

// ================= AYARLAR =================
function ayarlarSayfa() {
  const a = durum.ayarlar;
  $('#icerik').innerHTML = `
    <h1>⚙️ Ayarlar</h1>
    <form class="kart" id="ayar-form" style="max-width:640px">
      <div class="alan"><label>İşletme adı (fiş ve etiket başlığı)</label><input name="isletme_adi" value="${kac(a.isletme_adi || '')}"></div>
      <div class="alan"><label>Fiş üst bilgisi (adres, telefon…)</label><input name="fis_ust" value="${kac(a.fis_ust || '')}"></div>
      <div class="alan"><label>Fiş alt yazısı</label><input name="fis_alt" value="${kac(a.fis_alt || '')}" placeholder="Teşekkür ederiz"></div>
      <label style="display:flex;gap:8px;align-items:center;color:var(--yazi);font-size:14px;margin-bottom:8px"><input type="checkbox" name="otomatik_fis" style="width:auto" ${a.otomatik_fis === '1' ? 'checked' : ''}> Satış bitince fişi otomatik yazdır</label>
      <label style="display:flex;gap:8px;align-items:center;color:var(--yazi);font-size:14px"><input type="checkbox" name="eksi_stok" style="width:auto" ${a.eksi_stok === '1' ? 'checked' : ''}> Stok yetersizken sormadan satışa izin ver (stok eksiye düşebilir)</label>
      <div class="modal-alt"><button class="btn ana">Kaydet</button></div>
    </form>
    <div class="kart" style="max-width:640px;margin-top:14px">
      <h2>Barkod okuyucu</h2>
      <p class="soluk" style="margin:0">USB / Bluetooth barkod okuyucular klavye gibi çalışır — ek ayar gerekmez. Okuyucunun okuma sonunda <b>Enter</b> göndermesi (fabrika ayarı genelde budur) yeterli.
      Klavye kısayolları: <b>F1</b> Satış · <b>F2</b> Stok · <b>F3</b> Ürünler · <b>F4</b> Etiket · <b>F9</b> Satışı tamamla.</p>
    </div>`;
  aktifOdak = null;
  $('#ayar-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const g = {
      isletme_adi: f.isletme_adi.value, fis_ust: f.fis_ust.value, fis_alt: f.fis_alt.value,
      otomatik_fis: f.otomatik_fis.checked ? '1' : '0', eksi_stok: f.eksi_stok.checked ? '1' : '0',
    };
    try { await api('PUT', '/api/ayarlar', g); durum.ayarlar = { ...durum.ayarlar, ...g }; toast('Ayarlar kaydedildi', 'basari'); }
    catch (err) { toast(err.message, 'hata'); }
  };
}

// ================= Yönlendirme =================
const SAYFALAR = { satis: satisSayfa, stok: stokSayfa, urunler: urunlerSayfa, etiket: etiketSayfa, satislar: satislarSayfa, hareketler: hareketlerSayfa, ozet: ozetSayfa, ayarlar: ayarlarSayfa };
async function yonlendir() {
  const ad = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'satis';
  const sayfa = SAYFALAR[ad] || satisSayfa;
  $$('.kenar a').forEach((a) => a.classList.toggle('aktif', a.dataset.sayfa === ad));
  if (modalAcik()) modalKapat();
  try { await sayfa(); } catch (err) { $('#icerik').innerHTML = `<div class="kart bos">Hata: ${kac(err.message)}</div>`; }
}
window.addEventListener('hashchange', yonlendir);

document.addEventListener('keydown', (e) => {
  const kisayol = { F1: 'satis', F2: 'stok', F3: 'urunler', F4: 'etiket' }[e.key];
  if (kisayol) { e.preventDefault(); location.hash = '#/' + kisayol; return; }
  if (e.key === 'F9' && location.hash.startsWith('#/satis')) { e.preventDefault(); satisTamamla(); return; }
  if (e.key === 'Escape' && modalAcik()) { modalKapat(); return; }
  // Odak bir alanda değilken okuyucu okutursa → okutma kutusuna yönlendir
  const t = e.target;
  if (aktifOdak && !modalAcik() && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t.tagName) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    aktifOdak.focus();
  }
});

setInterval(() => { $('#saat').textContent = new Date().toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }); }, 1000);

(async function baslat() {
  try {
    [durum.ayarlar] = await Promise.all([api('GET', '/api/ayarlar'), urunleriYukle()]);
  } catch (err) {
    toast('Sunucuya bağlanılamadı: ' + err.message, 'hata');
  }
  yonlendir();
})();
