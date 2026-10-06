<?php
// Yönetim: giriş, anıları onayla / gizle / sil, onay modu, QR kartı
declare(strict_types=1);
require __DIR__ . '/lib.php';
oturumBaslat();

// ---------- İşlemler (JSON) ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $islem = $_POST['islem'] ?? '';

    if ($islem === 'giris') {
        // Kaba kuvvet denemelerini yavaşlat
        $_SESSION['deneme'] = ($_SESSION['deneme'] ?? 0) + 1;
        if ($_SESSION['deneme'] > 5) sleep(2);
        if (sifreDogru((string) ($_POST['sifre'] ?? ''))) {
            session_regenerate_id(true);
            $_SESSION['yonetici'] = true;
            $_SESSION['deneme'] = 0;
            header('Location: yonetim.php');
            exit;
        }
        header('Location: yonetim.php?hata=1');
        exit;
    }

    if (!yoneticiMi()) json(['ok' => false, 'mesaj' => 'Giriş gerekli'], 401);
    csrfKontrol();

    if ($islem === 'cikis') {
        session_destroy();
        json(['ok' => true]);
    }

    if ($islem === 'durum') {
        $durum = $_POST['durum'] ?? '';
        if (!in_array($durum, ['yayinda', 'gizli', 'bekliyor'], true)) json(['ok' => false, 'mesaj' => 'Geçersiz durum'], 400);
        db()->prepare('UPDATE anilar SET durum = ? WHERE id = ?')->execute([$durum, (int) $_POST['id']]);
        json(['ok' => true]);
    }

    if ($islem === 'sil') {
        $id = (int) $_POST['id'];
        $st = db()->prepare('SELECT dosya, onizleme FROM medyalar WHERE ani_id = ?');
        $st->execute([$id]);
        foreach ($st->fetchAll() as $m) {
            foreach ([$m['dosya'], $m['onizleme']] as $d) {
                $yol = realpath(YUKLEME_KLASORU . '/' . $d);
                if ($d && $yol && str_starts_with($yol, realpath(YUKLEME_KLASORU) . DIRECTORY_SEPARATOR)) @unlink($yol);
            }
        }
        db()->prepare('DELETE FROM anilar WHERE id = ?')->execute([$id]);
        json(['ok' => true]);
    }

    if ($islem === 'onay_modu') {
        canliAyarYaz('onay_gerekli', ($_POST['acik'] ?? '') === '1' ? '1' : '0');
        json(['ok' => true]);
    }

    if ($islem === 'tumunu_onayla') {
        db()->exec("UPDATE anilar SET durum = 'yayinda' WHERE durum = 'bekliyor'");
        json(['ok' => true]);
    }

    json(['ok' => false, 'mesaj' => 'Bilinmeyen işlem'], 400);
}

if (($_GET['islem'] ?? '') === 'liste') {
    if (!yoneticiMi()) json(['ok' => false], 401);
    $durum = $_GET['durum'] ?? '';
    $kosul = []; $param = [];
    if (in_array($durum, ['yayinda', 'gizli', 'bekliyor'], true)) { $kosul[] = 'durum = ?'; $param[] = $durum; }
    if (isset($_GET['once'])) { $kosul[] = 'id < ?'; $param[] = (int) $_GET['once']; }
    $anilar = anilariGetir($kosul, $param, 40);
    json(['ok' => true, 'anilar' => $anilar, 'devami' => count($anilar) === 40]);
}

// ---------- Giriş ekranı ----------
if (!yoneticiMi()) {
    sayfaBas('Yönetim', 'yok', 'yonetim-giris');
    ?>
<?= yapraklar() ?>
<main class="kap dar">
  <form method="post" class="kart giris-kart">
    <h1>Yönetim</h1>
    <p class="aciklama"><?= e(ayar('mekan_adi')) ?> · Anı Duvarı</p>
    <input type="hidden" name="islem" value="giris">
    <input type="password" name="sifre" placeholder="Şifre" autofocus required autocomplete="current-password">
    <?php if (isset($_GET['hata'])): ?><p class="hata-kutu">Şifre yanlış.</p><?php endif; ?>
    <button class="gonder">Giriş yap</button>
  </form>
</main>
    <?php
    sayfaSon();
    exit;
}

// ---------- Panel ----------
$say = db()->query("SELECT durum, COUNT(*) n FROM anilar GROUP BY durum")->fetchAll(PDO::FETCH_KEY_PAIR);
$medyaSay = db()->query("SELECT tur, COUNT(*) n FROM medyalar GROUP BY tur")->fetchAll(PDO::FETCH_KEY_PAIR);
$disk = 0;
if (is_dir(YUKLEME_KLASORU)) {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(YUKLEME_KLASORU, FilesystemIterator::SKIP_DOTS)) as $f) $disk += $f->getSize();
}
$varsayilanSifre = ayar('yonetici_sifre') === 'degistir-beni';
$paylasUrl = tabanUrl() . '/index.php';

sayfaBas('Yönetim', 'yok', 'yonetim');
?>
<main class="kap genis" id="panel" data-csrf="<?= e(csrf()) ?>">
  <section class="duvar-bas">
    <div>
      <p class="ust-yazi"><?= e(ayar('mekan_adi')) ?></p>
      <h1>Anı Duvarı · Yönetim</h1>
    </div>
    <div class="satir-butonlar">
      <a class="metin-btn" href="duvar.php" target="_blank">Duvarı aç ↗</a>
      <a class="metin-btn" href="duvar.php?ekran=1" target="_blank">TV ekran modu ↗</a>
      <button class="metin-btn" id="cikis">Çıkış</button>
    </div>
  </section>

  <?php if ($varsayilanSifre): ?>
    <p class="hata-kutu">Yönetim şifresi hâlâ varsayılan (<code>degistir-beni</code>). <code>config.php</code> dosyasından değiştirin.</p>
  <?php endif; ?>

  <div class="istatistik">
    <div class="kart"><small>Yayında</small><b><?= (int) ($say['yayinda'] ?? 0) ?></b></div>
    <div class="kart"><small>Onay bekleyen</small><b><?= (int) ($say['bekliyor'] ?? 0) ?></b></div>
    <div class="kart"><small>Gizlenen</small><b><?= (int) ($say['gizli'] ?? 0) ?></b></div>
    <div class="kart"><small>Fotoğraf / Video / Ses</small><b><?= (int) ($medyaSay['foto'] ?? 0) ?> / <?= (int) ($medyaSay['video'] ?? 0) ?> / <?= (int) ($medyaSay['ses'] ?? 0) ?></b></div>
    <div class="kart"><small>Kullanılan alan</small><b><?= number_format($disk / 1048576, 1, ',', '.') ?> MB</b></div>
  </div>

  <div class="yonetim-izgara">
    <section>
      <div class="filtreler" id="durumFiltre">
        <button class="aktif" data-durum="">Tümü</button>
        <button data-durum="bekliyor">Onay bekleyen</button>
        <button data-durum="yayinda">Yayında</button>
        <button data-durum="gizli">Gizlenen</button>
        <button class="metin-btn" id="tumunuOnayla" style="margin-left:auto">Bekleyenlerin hepsini onayla</button>
      </div>
      <div class="yonetim-liste" id="liste"></div>
      <button class="metin-btn daha" id="dahaFazla" hidden>Daha fazla</button>
    </section>

    <aside class="kart yan">
      <h2>Ayarlar</h2>
      <label class="anahtar">
        <input type="checkbox" id="onayModu" <?= onayGerekli() ? 'checked' : '' ?>>
        <span>Yayından önce onay iste</span>
      </label>
      <p class="kucuk-yazi">Açıkken yeni anılar siz onaylayana kadar duvarda görünmez.</p>

      <h2>Masa QR kartı</h2>
      <div class="qr-kart" id="qrKart">
        <div class="qr-kart-ust"><?= e(ayar('mekan_adi')) ?></div>
        <div id="qr" class="qr-kutu"></div>
        <div class="qr-kart-alt">Anını bırak 🌿<br><small>Kameranla okut, fotoğrafını paylaş</small></div>
      </div>
      <p class="kucuk-yazi">Bağlantı: <a href="<?= e($paylasUrl) ?>" target="_blank"><?= e($paylasUrl) ?></a></p>
      <button class="gonder kucuk" id="qrYazdir">QR kartını yazdır</button>
    </aside>
  </div>
</main>
<script src="assets/vendor/qrcode.min.js"></script>
<script>
(function () {
  const $ = (id) => document.getElementById(id);
  const csrf = $('panel').dataset.csrf;
  const kac = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DURUM = { yayinda: ['Yayında', 'yesil'], bekliyor: ['Onay bekliyor', 'sari'], gizli: ['Gizli', 'gri'] };
  let durum = '', enEski = null;

  async function post(veri) {
    const fd = new FormData();
    Object.entries({ ...veri, csrf }).forEach(([k, v]) => fd.append(k, v));
    const r = await fetch('yonetim.php', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) { alert(j.mesaj || 'İşlem başarısız'); throw new Error(); }
    return j;
  }

  function satir(a) {
    const medya = a.medya.map((m) => m.tur === 'foto'
      ? `<a href="${kac(m.url)}" target="_blank"><img src="${kac(m.onizleme)}" alt="" loading="lazy"></a>`
      : m.tur === 'video' ? `<video src="${kac(m.url)}#t=0.1" controls preload="metadata"></video>`
      : `<audio src="${kac(m.url)}" controls preload="none"></audio>`).join('');
    const [ad, renk] = DURUM[a.durum];
    return `<article class="kart y-ani" data-id="${a.id}">
      <div class="y-medya">${medya || ''}</div>
      <div class="y-bilgi">
        ${a.not ? `<p class="kart-not">${kac(a.not)}</p>` : ''}
        <p class="kucuk-yazi">#${a.id} · ${kac(a.isim || 'isimsiz')} · ${kac(a.tarih)} · ❤ ${a.begeni}</p>
        <div class="satir-butonlar">
          <span class="rozet ${renk}">${ad}</span>
          ${a.durum !== 'yayinda' ? `<button class="metin-btn" data-durum-yap="yayinda">Yayınla</button>` : ''}
          ${a.durum !== 'gizli' ? `<button class="metin-btn" data-durum-yap="gizli">Gizle</button>` : ''}
          <button class="metin-btn tehlike" data-sil>Kalıcı sil</button>
        </div>
      </div>
    </article>`;
  }

  async function yukle(sifirla) {
    if (sifirla) { $('liste').innerHTML = ''; enEski = null; }
    const p = new URLSearchParams({ islem: 'liste', durum });
    if (enEski) p.set('once', enEski);
    const v = await (await fetch('yonetim.php?' + p)).json();
    $('liste').insertAdjacentHTML('beforeend', v.anilar.map(satir).join(''));
    if (v.anilar.length) enEski = v.anilar[v.anilar.length - 1].id;
    $('dahaFazla').hidden = !v.devami;
    if (!$('liste').children.length) $('liste').innerHTML = '<p class="duvar-durum">Bu filtrede anı yok.</p>';
  }

  $('liste').addEventListener('click', async (e) => {
    const kart = e.target.closest('[data-id]');
    if (!kart) return;
    const id = kart.dataset.id;
    const d = e.target.closest('[data-durum-yap]');
    if (d) { await post({ islem: 'durum', id, durum: d.dataset.durumYap }); location.reload(); }
    if (e.target.closest('[data-sil]') && confirm('Bu anı ve dosyaları kalıcı olarak silinsin mi?')) {
      await post({ islem: 'sil', id }); kart.remove();
    }
  });
  $('durumFiltre').addEventListener('click', (e) => {
    const b = e.target.closest('[data-durum]');
    if (!b) return;
    document.querySelectorAll('[data-durum]').forEach((x) => x.classList.toggle('aktif', x === b));
    durum = b.dataset.durum;
    yukle(true);
  });
  $('tumunuOnayla').onclick = async () => { if (confirm('Onay bekleyen tüm anılar yayınlansın mı?')) { await post({ islem: 'tumunu_onayla' }); location.reload(); } };
  $('dahaFazla').onclick = () => yukle(false);
  $('onayModu').onchange = (e) => post({ islem: 'onay_modu', acik: e.target.checked ? '1' : '0' });
  $('cikis').onclick = async () => { await post({ islem: 'cikis' }); location.reload(); };

  const url = <?= json_encode($paylasUrl) ?>;
  if (window.QRCode) new QRCode($('qr'), { text: url, width: 180, height: 180, colorDark: '#1f3a2b', colorLight: '#ffffff' });
  $('qrYazdir').onclick = () => {
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return alert('Pop-up engellendi');
    const qr = $('qr').querySelector('img')?.src || $('qr').querySelector('canvas')?.toDataURL();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR</title>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Figtree:wght@500&display=swap" rel="stylesheet">
      <style>body{margin:0;display:flex;justify-content:center;font-family:Figtree,Arial,sans-serif}
      .k{width:90mm;border:2px solid #1f3a2b;border-radius:6mm;padding:8mm;text-align:center;color:#1f3a2b;margin-top:10mm}
      h1{font-family:Fraunces,Georgia,serif;margin:0 0 4mm;font-size:22pt}img{width:55mm;height:55mm}
      p{margin:4mm 0 0;font-size:14pt}small{font-size:10pt;color:#5a6b5f}</style></head><body>
      <div class="k"><h1>${kac(<?= json_encode(ayar('mekan_adi')) ?>)}</h1><img src="${qr}"><p>Anını bırak 🌿</p><small>Kameranla okut, fotoğrafını paylaş</small></div>
      <script>window.onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  };

  yukle(true);
})();
</script>
<?php sayfaSon();
