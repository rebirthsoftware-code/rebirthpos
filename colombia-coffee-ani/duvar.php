<?php
// Anı Duvarı — yüklenen anıları herkes görür. ?ekran=1 → kafedeki TV için tam ekran slayt
declare(strict_types=1);
require __DIR__ . '/lib.php';

$ekran = isset($_GET['ekran']);
$paylasUrl = tabanUrl() . '/index.php';

if ($ekran) {
    sayfaBas('Anı Duvarı', 'yok', 'ekran-modu');
    ?>
<div class="slayt" id="slayt" data-paylas="<?= e($paylasUrl) ?>">
  <div class="slayt-sahne" id="slaytSahne"></div>
  <aside class="slayt-qr">
    <div id="qr" class="qr-kutu"></div>
    <div>
      <b>Sen de anını bırak</b>
      <span>Kameranla okut, fotoğrafını paylaş</span>
    </div>
  </aside>
  <div class="slayt-marka"><?= e(ayar('mekan_adi')) ?> · Anı Duvarı</div>
  <div class="slayt-bos" id="slaytBos" hidden>
    <h1>Anı Duvarı</h1>
    <p>İlk anıyı sen bırak: köşedeki kodu okut.</p>
  </div>
</div>
<script src="assets/vendor/qrcode.min.js"></script>
    <?php
    sayfaSon(['assets/duvar.js']);
    exit;
}

sayfaBas('Anı Duvarı', 'duvar');
?>
<?= yapraklar() ?>
<main class="kap genis">
  <section class="duvar-bas">
    <div>
      <p class="ust-yazi"><?= e(ayar('mekan_adi')) ?></p>
      <h1>Anı Duvarı</h1>
      <p class="aciklama">Misafirlerimizin burada bıraktığı anlar. Sen de bir tane bırakmak ister misin?</p>
    </div>
    <a class="gonder kucuk" href="index.php">+ Anı Bırak</a>
  </section>

  <div class="filtreler" role="tablist">
    <button class="aktif" data-tur="">Tümü</button>
    <button data-tur="foto">Fotoğraflar</button>
    <button data-tur="video">Videolar</button>
    <button data-tur="ses">Sesli notlar</button>
    <button data-tur="not">Notlar</button>
  </div>

  <button class="yeni-var" id="yeniVar" hidden></button>
  <div class="duvar" id="duvar" aria-live="polite"></div>
  <div class="duvar-durum" id="duvarDurum">Anılar yükleniyor…</div>
  <button class="metin-btn daha" id="dahaFazla" hidden>Daha fazla anı göster</button>
  <?php if (ayar('instagram')): ?>
    <p class="alt-not">Bizi Instagram'da takip et: <a href="https://instagram.com/<?= e(ayar('instagram')) ?>" target="_blank" rel="noopener">@<?= e(ayar('instagram')) ?></a></p>
  <?php endif; ?>
</main>

<div class="isik-kutusu" id="isikKutusu" hidden>
  <button class="ik-kapat" id="ikKapat" aria-label="Kapat">×</button>
  <button class="ik-ok sol" id="ikSol" aria-label="Önceki">‹</button>
  <figure id="ikIcerik"></figure>
  <button class="ik-ok sag" id="ikSag" aria-label="Sonraki">›</button>
</div>
<?php sayfaSon(['assets/duvar.js']);
