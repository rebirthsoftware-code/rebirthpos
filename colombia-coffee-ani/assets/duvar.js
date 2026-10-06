// Anı Duvarı: liste, filtre, sonsuz kaydırma, yeni anı bildirimi, beğeni, ışık kutusu, TV slayt modu
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const kac = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function goreliZaman(t) {
    const fark = (Date.now() - new Date(t.replace(' ', 'T')).getTime()) / 1000;
    if (fark < 60) return 'az önce';
    if (fark < 3600) return Math.floor(fark / 60) + ' dk önce';
    if (fark < 86400) return Math.floor(fark / 3600) + ' saat önce';
    if (fark < 604800) return Math.floor(fark / 86400) + ' gün önce';
    return new Date(t.replace(' ', 'T')).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  async function liste(param) {
    const r = await fetch('api.php?islem=liste&' + new URLSearchParams(param), { cache: 'no-store' });
    if (!r.ok) throw new Error('Liste alınamadı');
    return r.json();
  }

  let begenilenler = new Set();
  try { begenilenler = new Set(JSON.parse(localStorage.getItem('ani_begeni') || '[]')); } catch { /* gizli sekme */ }

  if (document.body.classList.contains('ekran-modu')) return slaytModu();

  // ======================= DUVAR =======================
  const duvar = $('duvar');
  let tur = '';
  let enEski = null, enYeni = 0, devami = false, yukleniyor = false;
  const anilar = new Map(); // id → anı (ışık kutusu için)

  function kartHtml(a) {
    const foto = a.medya.filter((m) => m.tur === 'foto');
    const video = a.medya.filter((m) => m.tur === 'video');
    const ses = a.medya.filter((m) => m.tur === 'ses');
    const gorsel = [...foto, ...video];
    let medya = '';
    if (gorsel.length) {
      const ilk = gorsel[0];
      const oran = ilk.g && ilk.y ? `style="aspect-ratio:${ilk.g}/${ilk.y}"` : '';
      medya = `<button class="kart-medya" data-ac="${a.id}" aria-label="Büyüt" ${oran}>
        ${ilk.tur === 'foto'
          ? `<img src="${kac(ilk.onizleme)}" alt="" loading="lazy">`
          : `<video src="${kac(ilk.url)}#t=0.1" muted playsinline preload="metadata"></video><span class="oynat">▶</span>`}
        ${gorsel.length > 1 ? `<span class="adet">+${gorsel.length - 1}</span>` : ''}
      </button>`;
    }
    const sesHtml = ses.map((s) => `<audio controls preload="none" src="${kac(s.url)}"></audio>`).join('');
    const begendi = begenilenler.has(a.id);
    return `<article class="ani ${gorsel.length ? '' : 'sadece-not'}" data-id="${a.id}">
      ${medya}
      ${sesHtml ? `<div class="kart-ses"><span class="ikon">🎙️</span>${sesHtml}</div>` : ''}
      ${a.not ? `<p class="kart-not">${kac(a.not)}</p>` : ''}
      <footer>
        <span class="kim">${a.isim ? '— ' + kac(a.isim) : '— bir misafir'}<small>${goreliZaman(a.tarih)}</small></span>
        <button class="begen ${begendi ? 'begendi' : ''}" data-begen="${a.id}" aria-label="Beğen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.8 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>
          <span>${a.begeni || ''}</span>
        </button>
      </footer>
    </article>`;
  }

  function ekle(liste, basa = false) {
    const html = liste.map((a) => { anilar.set(a.id, a); return kartHtml(a); }).join('');
    duvar.insertAdjacentHTML(basa ? 'afterbegin' : 'beforeend', html);
    for (const a of liste) {
      enYeni = Math.max(enYeni, a.id);
      enEski = enEski === null ? a.id : Math.min(enEski, a.id);
    }
  }

  async function yukle(sifirla = false) {
    if (yukleniyor) return;
    yukleniyor = true;
    if (sifirla) { duvar.innerHTML = ''; enEski = null; enYeni = 0; anilar.clear(); $('yeniVar').hidden = true; }
    $('duvarDurum').hidden = false;
    $('duvarDurum').textContent = 'Anılar yükleniyor…';
    try {
      const p = { tur };
      if (enEski !== null) p.once = enEski;
      const v = await liste(p);
      ekle(v.anilar);
      devami = v.devami;
      $('dahaFazla').hidden = !devami;
      if (!anilar.size) {
        $('duvarDurum').innerHTML = tur
          ? 'Bu türde henüz anı yok.'
          : 'Duvar şimdilik boş. <a href="index.php">İlk anıyı sen bırak</a> 🌿';
      } else $('duvarDurum').hidden = true;
    } catch {
      $('duvarDurum').textContent = 'Anılar yüklenemedi. Sayfayı yenilemeyi dene.';
    } finally {
      yukleniyor = false;
    }
  }

  // Yeni gelen anıları 20 sn'de bir kontrol et
  let bekleyen = [];
  setInterval(async () => {
    if (document.hidden || !enYeni) return;
    try {
      const v = await liste({ tur, sonra: Math.max(enYeni, ...bekleyen.map((a) => a.id)), limit: 30 });
      if (!v.anilar.length) return;
      bekleyen = [...v.anilar, ...bekleyen];
      const b = $('yeniVar');
      b.textContent = `${bekleyen.length} yeni anı · göster`;
      b.hidden = false;
    } catch { /* sessizce geç */ }
  }, 20000);
  $('yeniVar').onclick = () => {
    ekle(bekleyen.sort((a, b) => a.id - b.id).reverse(), true);
    bekleyen = [];
    $('yeniVar').hidden = true;
    window.scrollTo({ top: duvar.offsetTop - 120, behavior: 'smooth' });
  };

  document.querySelectorAll('.filtreler button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.filtreler button').forEach((x) => x.classList.toggle('aktif', x === b));
    tur = b.dataset.tur;
    bekleyen = [];
    yukle(true);
  }));
  $('dahaFazla').onclick = () => yukle();
  new IntersectionObserver((g) => { if (g[0].isIntersecting && devami) yukle(); }, { rootMargin: '600px' }).observe($('dahaFazla'));

  // Beğeni
  duvar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-begen]');
    if (b) {
      const id = Number(b.dataset.begen);
      if (begenilenler.has(id)) return;
      b.classList.add('begendi', 'atim');
      begenilenler.add(id);
      try { localStorage.setItem('ani_begeni', JSON.stringify([...begenilenler].slice(-500))); } catch { /* */ }
      const fd = new FormData(); fd.append('id', id);
      try {
        const v = await (await fetch('api.php?islem=begen', { method: 'POST', body: fd })).json();
        if (v.ok) b.querySelector('span').textContent = v.begeni;
      } catch { /* */ }
      return;
    }
    const ac = e.target.closest('[data-ac]');
    if (ac) isikKutusuAc(Number(ac.dataset.ac), 0);
  });

  // Işık kutusu
  let ikAni = null, ikSira = 0;
  function isikKutusuAc(id, sira) {
    ikAni = anilar.get(id);
    ikSira = sira;
    ikCiz();
    $('isikKutusu').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function ikCiz() {
    const g = ikAni.medya.filter((m) => m.tur !== 'ses');
    const m = g[ikSira];
    $('ikIcerik').innerHTML = (m.tur === 'foto'
      ? `<img src="${kac(m.url)}" alt="">`
      : `<video src="${kac(m.url)}" controls autoplay playsinline></video>`)
      + `<figcaption>${ikAni.not ? `<span class="ik-not">${kac(ikAni.not)}</span>` : ''}<span>${ikAni.isim ? '— ' + kac(ikAni.isim) : ''} ${g.length > 1 ? `· ${ikSira + 1}/${g.length}` : ''}</span></figcaption>`;
    $('ikSol').hidden = $('ikSag').hidden = g.length < 2;
  }
  function ikGit(d) {
    const n = ikAni.medya.filter((m) => m.tur !== 'ses').length;
    ikSira = (ikSira + d + n) % n;
    ikCiz();
  }
  function ikKapat() { $('isikKutusu').hidden = true; $('ikIcerik').innerHTML = ''; document.body.style.overflow = ''; }
  $('ikKapat').onclick = ikKapat;
  $('ikSol').onclick = () => ikGit(-1);
  $('ikSag').onclick = () => ikGit(1);
  $('isikKutusu').addEventListener('click', (e) => { if (e.target.id === 'isikKutusu') ikKapat(); });
  document.addEventListener('keydown', (e) => {
    if ($('isikKutusu').hidden) return;
    if (e.key === 'Escape') ikKapat();
    if (e.key === 'ArrowLeft') ikGit(-1);
    if (e.key === 'ArrowRight') ikGit(1);
  });
  // Mobilde kaydırarak geçiş
  let dokunX = null;
  $('isikKutusu').addEventListener('touchstart', (e) => { dokunX = e.touches[0].clientX; }, { passive: true });
  $('isikKutusu').addEventListener('touchend', (e) => {
    if (dokunX === null) return;
    const fark = e.changedTouches[0].clientX - dokunX;
    if (Math.abs(fark) > 50) ikGit(fark > 0 ? -1 : 1);
    dokunX = null;
  });

  yukle(true);

  // ======================= TV SLAYT MODU =======================
  function slaytModu() {
    const sahne = $('slaytSahne');
    const paylas = $('slayt').dataset.paylas;
    if (window.QRCode) new QRCode($('qr'), { text: paylas, width: 168, height: 168, colorDark: '#1f3a2b', colorLight: '#fbf6ec' });

    let kuyruk = [], sira = 0, enYeniId = 0;
    async function tazele() {
      try {
        const v = await liste({ limit: 60 });
        const yeniler = v.anilar.filter((a) => a.id > enYeniId);
        if (yeniler.length && enYeniId) {
          // Yeni gelen anı hemen sıradaki slayt olsun
          kuyruk.splice(sira, 0, ...yeniler);
        } else if (!enYeniId) kuyruk = v.anilar;
        enYeniId = Math.max(enYeniId, ...v.anilar.map((a) => a.id), 0);
        $('slaytBos').hidden = kuyruk.length > 0;
      } catch { /* bağlantı yoksa mevcut kuyrukla devam */ }
    }

    function goster() {
      if (!kuyruk.length) return setTimeout(goster, 5000);
      if (sira >= kuyruk.length) sira = 0;
      const a = kuyruk[sira++];
      const gorsel = a.medya.find((m) => m.tur === 'foto') || a.medya.find((m) => m.tur === 'video');
      const s = document.createElement('div');
      s.className = 'slayt-kart';
      const yazi = a.not ? kac(a.not) : (a.medya.some((m) => m.tur === 'ses') ? '🎙️ Bir sesli not bırakıldı' : '');
      const imza = `${a.isim ? '— ' + kac(a.isim) : '— bir misafir'} · ${goreliZaman(a.tarih)}`;
      s.innerHTML = gorsel
        ? `${gorsel.tur === 'foto' ? `<div class="slayt-bg" style="background-image:url('${kac(gorsel.url)}')"></div>` : ''}
           <figure class="slayt-polaroid">
             ${gorsel.tur === 'foto'
               ? `<img src="${kac(gorsel.url)}" alt="">`
               : `<video src="${kac(gorsel.url)}" muted autoplay playsinline></video>`}
             <figcaption>${yazi ? `<p>${yazi}</p>` : ''}<span>${imza}</span></figcaption>
           </figure>`
        : `<div class="slayt-not"><p>${yazi}</p><span>${imza}</span></div>`;
      sahne.appendChild(s);
      requestAnimationFrame(() => s.classList.add('gorunur'));
      [...sahne.children].slice(0, -1).forEach((eski) => { eski.classList.remove('gorunur'); setTimeout(() => eski.remove(), 1500); });
      const video = s.querySelector('video');
      const sure = gorsel?.tur === 'video' ? null : (a.not && a.not.length > 120 ? 11000 : 8000);
      if (video) {
        let bitti = false;
        const sonraki = () => { if (!bitti) { bitti = true; goster(); } };
        video.onended = sonraki;
        video.onerror = sonraki;
        setTimeout(sonraki, 30000);
      } else setTimeout(goster, sure);
    }

    tazele().then(goster);
    setInterval(tazele, 30000);
  }
})();
