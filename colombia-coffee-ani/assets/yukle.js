// Anı Bırak sayfası: dosya seçimi, ses kaydı, ilerlemeli yükleme
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const form = $('aniFormu');
  const sinir = JSON.parse(form.dataset.sinir);
  const secilen = { foto: [], video: [] };
  let sesBlob = null;

  // ---------- Dosya seçimi + önizleme ----------
  function dosyaBagla(tur) {
    const input = $(tur + 'Input');
    input.addEventListener('change', () => {
      for (const f of input.files) {
        if (f.size > sinir[tur] * 1024 * 1024) { hataGoster(`"${f.name}" ${sinir[tur]} MB'tan büyük.`); continue; }
        secilen[tur].push(f);
      }
      input.value = '';
      onizlemeCiz(tur);
    });
  }

  function onizlemeCiz(tur) {
    const kap = $(tur + 'Onizleme');
    kap.querySelectorAll('[data-url]').forEach((el) => URL.revokeObjectURL(el.dataset.url));
    kap.innerHTML = '';
    secilen[tur].forEach((f, i) => {
      const url = URL.createObjectURL(f);
      const oge = document.createElement('div');
      oge.className = 'onizleme';
      oge.dataset.url = url;
      const medya = document.createElement(tur === 'foto' ? 'img' : 'video');
      medya.src = url;
      if (tur === 'video') { medya.muted = true; medya.playsInline = true; medya.preload = 'metadata'; }
      else medya.alt = '';
      const sil = document.createElement('button');
      sil.type = 'button';
      sil.className = 'onizleme-sil';
      sil.setAttribute('aria-label', 'Kaldır');
      sil.textContent = '×';
      sil.onclick = () => { secilen[tur].splice(i, 1); onizlemeCiz(tur); };
      oge.append(medya, sil);
      kap.appendChild(oge);
    });
    const alan = $(tur + 'Alan');
    const n = secilen[tur].length;
    alan.classList.toggle('dolu', n > 0);
    alan.querySelector('.birak-yazi').textContent = n
      ? `${n} ${tur === 'foto' ? 'fotoğraf' : 'video'} seçildi · eklemek için dokun`
      : `${tur === 'foto' ? 'Fotoğraf' : 'Video'} seçmek için dokun`;
  }
  dosyaBagla('foto');
  dosyaBagla('video');

  // ---------- Ses kaydı ----------
  let kaydedici = null, parcalar = [], sayacId = null, baslangic = 0;
  const MAKS_SES = 180;

  $('sesBasla').onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return hataGoster('Bu tarayıcı ses kaydını desteklemiyor.');
    }
    try {
      const akis = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tip = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      kaydedici = new MediaRecorder(akis, tip ? { mimeType: tip } : undefined);
      parcalar = [];
      kaydedici.ondataavailable = (e) => e.data.size && parcalar.push(e.data);
      kaydedici.onstop = () => {
        akis.getTracks().forEach((t) => t.stop());
        clearInterval(sayacId);
        sesBlob = new Blob(parcalar, { type: kaydedici.mimeType || 'audio/webm' });
        $('sesOynat').src = URL.createObjectURL(sesBlob);
        sesGorunum('hazir');
      };
      kaydedici.start();
      baslangic = Date.now();
      $('sesSure').textContent = '0:00';
      sayacId = setInterval(() => {
        const s = Math.floor((Date.now() - baslangic) / 1000);
        $('sesSure').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (s >= MAKS_SES) kaydedici.stop();
      }, 250);
      sesGorunum('kayit');
    } catch {
      hataGoster('Mikrofona izin verilmedi. Tarayıcı ayarlarından mikrofon iznini açabilirsin.');
    }
  };
  $('sesDur').onclick = () => kaydedici?.state === 'recording' && kaydedici.stop();
  $('sesSil').onclick = () => { sesBlob = null; $('sesOynat').removeAttribute('src'); sesGorunum('bos'); };

  function sesGorunum(d) {
    $('sesBasla').hidden = d !== 'bos';
    $('sesKayit').hidden = d !== 'kayit';
    $('sesHazir').hidden = d !== 'hazir';
    $('sesIpucu').hidden = d === 'hazir';
  }

  // ---------- Not sayacı ----------
  $('not').addEventListener('input', (e) => { $('notSayac').textContent = e.target.value.length; });

  // ---------- Gönder ----------
  let istek = null;
  function hataGoster(m) {
    const k = $('hataKutu');
    k.textContent = m;
    k.hidden = false;
    k.scrollIntoView({ behavior: 'smooth', block: 'center' });
    clearTimeout(hataGoster.t);
    hataGoster.t = setTimeout(() => { k.hidden = true; }, 7000);
  }

  function fincanDoldur(oran) {
    // Kahve dikdörtgeni aşağıdan yukarı yükselir (y: 98 → 30)
    $('kahve').setAttribute('y', String(98 - 68 * oran));
    $('yuzde').textContent = '%' + Math.round(oran * 100);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const not = $('not').value.trim();
    const dosyaSayisi = secilen.foto.length + secilen.video.length + (sesBlob ? 1 : 0);
    if (!dosyaSayisi && !not) return hataGoster('Paylaşmak için bir fotoğraf, video, ses kaydı ya da not ekle.');
    if (dosyaSayisi > sinir.dosya) return hataGoster(`Bir seferde en fazla ${sinir.dosya} dosya gönderebilirsin.`);

    const fd = new FormData();
    secilen.foto.forEach((f) => fd.append('foto[]', f, f.name));
    secilen.video.forEach((f) => fd.append('video[]', f, f.name));
    if (sesBlob) fd.append('ses', sesBlob, 'ses.' + (sesBlob.type.includes('mp4') ? 'm4a' : sesBlob.type.includes('ogg') ? 'ogg' : 'webm'));
    fd.append('not', not);
    fd.append('isim', $('isim').value.trim());
    fd.append('web_sitesi', $('webSitesi').value);

    fincanDoldur(0);
    $('yukleniyor').hidden = false;
    $('gonderBtn').disabled = true;

    istek = new XMLHttpRequest();
    istek.open('POST', 'yukle.php');
    istek.upload.onprogress = (ev) => ev.lengthComputable && fincanDoldur(Math.min(0.97, ev.loaded / ev.total));
    istek.onload = () => {
      let cevap = {};
      try { cevap = JSON.parse(istek.responseText); } catch { /* sunucu HTML döndürdü */ }
      $('yukleniyor').hidden = true;
      $('gonderBtn').disabled = false;
      if (istek.status === 200 && cevap.ok) {
        fincanDoldur(1);
        $('basariBaslik').textContent = cevap.durum === 'yayinda' ? 'Anın duvara asıldı!' : 'Anın bize ulaştı!';
        $('basariMetin').textContent = cevap.durum === 'yayinda'
          ? 'Paylaştığın için teşekkürler. Şimdi Anı Duvarı\'nda herkes görebilir.'
          : 'Onaylandıktan sonra Anı Duvarı\'nda görünecek. Teşekkürler!';
        $('basarili').hidden = false;
        formuSifirla();
      } else {
        hataGoster(cevap.mesaj || (istek.status === 413 ? 'Dosyalar çok büyük.' : 'Yükleme başarısız oldu, tekrar dene.'));
      }
    };
    istek.onerror = () => {
      $('yukleniyor').hidden = true;
      $('gonderBtn').disabled = false;
      hataGoster('Bağlantı koptu. İnternetini kontrol edip tekrar dene.');
    };
    istek.send(fd);
  });

  $('iptalBtn').onclick = () => {
    istek?.abort();
    $('yukleniyor').hidden = true;
    $('gonderBtn').disabled = false;
  };

  function formuSifirla() {
    secilen.foto = []; secilen.video = [];
    onizlemeCiz('foto'); onizlemeCiz('video');
    sesBlob = null; sesGorunum('bos');
    $('not').value = ''; $('notSayac').textContent = '0';
  }
  $('yeniAni').onclick = () => { $('basarili').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' }); };
})();
