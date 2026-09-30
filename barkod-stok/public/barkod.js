// Barkod → SVG üretici (EAN-13 ve Code128). Harici kütüphane gerektirmez, çevrimdışı çalışır.
(function (global) {
  // ---------- EAN-13 ----------
  const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  const R = L.map((k) => k.replace(/./g, (b) => (b === '0' ? '1' : '0')));
  const G = R.map((k) => k.split('').reverse().join(''));
  const PARITE = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

  function ean13Kontrol(ilk12) {
    let t = 0;
    for (let i = 0; i < 12; i++) t += Number(ilk12[i]) * (i % 2 ? 3 : 1);
    return String((10 - (t % 10)) % 10);
  }
  const ean13Gecerli = (k) => /^\d{13}$/.test(k) && ean13Kontrol(k.slice(0, 12)) === k[12];

  // Modül dizisi ("1" = siyah çubuk) + uzun çubuk (koruma) işaretleri
  function ean13Moduller(kod) {
    const p = PARITE[Number(kod[0])];
    let bit = '101';
    for (let i = 1; i <= 6; i++) bit += (p[i - 1] === 'L' ? L : G)[Number(kod[i])];
    bit += '01010';
    for (let i = 7; i <= 12; i++) bit += R[Number(kod[i])];
    bit += '101';
    const uzun = new Set();
    [0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94].forEach((i) => uzun.add(i));
    return { bit, uzun };
  }

  // ---------- Code128 ----------
  const C128 = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
  ];
  const START_B = 104, START_C = 105, KOD_C = 99, KOD_B = 100, STOP = 106;

  function code128Degerler(metin) {
    const degerler = [];
    let i = 0;
    const rakamKosusu = (j) => { let n = 0; while (j + n < metin.length && /\d/.test(metin[j + n])) n++; return n; };
    let mod = rakamKosusu(0) >= 4 ? 'C' : 'B';
    degerler.push(mod === 'C' ? START_C : START_B);
    while (i < metin.length) {
      if (mod === 'C') {
        if (rakamKosusu(i) >= 2) { degerler.push(Number(metin.substr(i, 2))); i += 2; continue; }
        degerler.push(KOD_B); mod = 'B';
      }
      // B modunda uzun rakam dizisi (çift sayıda) gelirse C'ye geç
      const n = rakamKosusu(i);
      if (n >= 6 && n % 2 === 0) { degerler.push(KOD_C); mod = 'C'; continue; }
      const c = metin.charCodeAt(i);
      if (c < 32 || c > 126) throw new Error(`Barkodda desteklenmeyen karakter: "${metin[i]}"`);
      degerler.push(c - 32); i++;
    }
    let toplam = degerler[0];
    for (let k = 1; k < degerler.length; k++) toplam += degerler[k] * k;
    degerler.push(toplam % 103, STOP);
    return degerler;
  }

  function code128Moduller(metin) {
    let bit = '';
    for (const d of code128Degerler(metin)) {
      const w = C128[d];
      for (let k = 0; k < w.length; k++) bit += (k % 2 ? '0' : '1').repeat(Number(w[k]));
    }
    return { bit, uzun: new Set() };
  }

  // ---------- SVG ----------
  // secenek: { yukseklik (modül cinsinden), yaziGoster, bosluk (sessiz bölge) }
  function svg(kod, secenek = {}) {
    kod = String(kod || '').trim();
    if (!kod) return '';
    const ean = ean13Gecerli(kod);
    const { bit, uzun } = ean ? ean13Moduller(kod) : code128Moduller(kod);
    const yaziGoster = secenek.yaziGoster !== false;
    const bosluk = secenek.bosluk ?? (ean ? 11 : 10);
    const cubukH = secenek.yukseklik ?? 50;
    const yaziH = yaziGoster ? 11 : 0;
    const genislik = bit.length + bosluk * 2;
    const yukseklik = cubukH + yaziH + 2;
    let yol = '';
    for (let i = 0; i < bit.length;) {
      if (bit[i] !== '1') { i++; continue; }
      let n = 1;
      while (bit[i + n] === '1' && uzun.has(i + n) === uzun.has(i)) n++;
      const h = ean && yaziGoster ? (uzun.has(i) ? cubukH + 5 : cubukH) : cubukH;
      yol += `M${bosluk + i} 1h${n}v${h}h-${n}z`;
      i += n;
    }
    let yazi = '';
    if (yaziGoster) {
      const y = cubukH + yaziH;
      const st = 'font-family="OCR-B, Consolas, monospace" font-size="10" fill="#000"';
      if (ean) {
        yazi = `<text x="${bosluk - 2}" y="${y}" text-anchor="end" ${st}>${kod[0]}</text>` +
          `<text x="${bosluk + 24}" y="${y}" text-anchor="middle" letter-spacing="1.5" ${st}>${kod.slice(1, 7)}</text>` +
          `<text x="${bosluk + 71}" y="${y}" text-anchor="middle" letter-spacing="1.5" ${st}>${kod.slice(7)}</text>`;
      } else {
        const kacis = kod.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        yazi = `<text x="${genislik / 2}" y="${y}" text-anchor="middle" ${st}>${kacis}</text>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${genislik} ${yukseklik}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${yol}" fill="#000"/>${yazi}</svg>`;
  }

  global.Barkod = { svg, ean13Gecerli, ean13Kontrol, _code128Degerler: code128Degerler, _C128: C128 };
})(typeof window !== 'undefined' ? window : globalThis);
