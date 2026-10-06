<?php
// Anı Bırak — misafirlerin fotoğraf / video / ses / not yüklediği sayfa
declare(strict_types=1);
require __DIR__ . '/lib.php';

$sayi = (int) db()->query("SELECT COUNT(*) FROM anilar WHERE durum = 'yayinda'")->fetchColumn();
$sinirlar = [
    'foto' => (int) ayar('max_foto_mb'), 'video' => (int) ayar('max_video_mb'), 'ses' => (int) ayar('max_ses_mb'),
    'dosya' => (int) ayar('max_dosya'), 'not' => (int) ayar('max_not'),
];

sayfaBas('Anı Bırak', 'paylas');
?>
<?= yapraklar() ?>
<main class="kap">
  <section class="giris">
    <p class="ust-yazi">Hoş geldin<?= ayar('konum') ? ' · ' . e(ayar('konum')) : '' ?></p>
    <h1><?= e(ayar('mekan_adi')) ?></h1>
    <p class="slogan"><?= e(ayar('slogan')) ?></p>
    <p class="aciklama">Burada yaşadığın anı bizimle paylaş. Fotoğrafın, videon ya da sesli notun
      <a href="duvar.php">Anı Duvarı</a>'nda herkesle buluşsun.</p>
    <?php if ($sayi > 0): ?>
      <a class="duvar-rozet" href="duvar.php"><span><?= $sayi ?></span> anı duvarda seni bekliyor →</a>
    <?php endif; ?>
  </section>

  <form id="aniFormu" class="form" novalidate
        data-sinir='<?= e(json_encode($sinirlar)) ?>'>
    <div class="kart">
      <h2><span class="ikon">📸</span> Fotoğraf</h2>
      <label class="birak" id="fotoAlan">
        <input type="file" id="fotoInput" accept="image/*" multiple>
        <span class="birak-ic">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
          <b class="birak-yazi">Fotoğraf seçmek için dokun</b>
          <small>Birden fazla seçebilirsin · en fazla <?= $sinirlar['foto'] ?> MB</small>
        </span>
      </label>
      <div class="onizlemeler" id="fotoOnizleme"></div>
    </div>

    <div class="kart">
      <h2><span class="ikon">🎥</span> Video</h2>
      <label class="birak" id="videoAlan">
        <input type="file" id="videoInput" accept="video/*,.mov,.qt" multiple>
        <span class="birak-ic">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M16 10l5-3v10l-5-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          <b class="birak-yazi">Video seçmek için dokun</b>
          <small>MP4, MOV ve diğerleri · en fazla <?= $sinirlar['video'] ?> MB</small>
        </span>
      </label>
      <div class="onizlemeler" id="videoOnizleme"></div>
    </div>

    <div class="kart">
      <h2><span class="ikon">🎙️</span> Sesli Not</h2>
      <div class="ses" id="sesAlan">
        <button type="button" class="ses-btn" id="sesBasla">
          <span class="nokta"></span> Kayda Başla
        </button>
        <div class="ses-kayit" id="sesKayit" hidden>
          <span class="dalga"><i></i><i></i><i></i><i></i><i></i></span>
          <span class="sure" id="sesSure">0:00</span>
          <button type="button" class="ses-btn dur" id="sesDur">Durdur</button>
        </div>
        <div class="ses-hazir" id="sesHazir" hidden>
          <audio id="sesOynat" controls></audio>
          <button type="button" class="metin-btn" id="sesSil">Sil</button>
        </div>
        <p class="ipucu" id="sesIpucu">Bir dilek, bir teşekkür ya da sadece "merhaba"… (en fazla 3 dakika)</p>
      </div>
    </div>

    <div class="kart kagit">
      <h2><span class="ikon">📝</span> Not</h2>
      <textarea id="not" maxlength="<?= $sinirlar['not'] ?>" rows="4" placeholder="Bugün burada…"></textarea>
      <div class="sayac"><span id="notSayac">0</span>/<?= $sinirlar['not'] ?></div>
    </div>

    <div class="kart">
      <h2><span class="ikon">✍️</span> İsmin</h2>
      <input type="text" id="isim" maxlength="60" placeholder="Adını yazabilirsin (isteğe bağlı)" autocomplete="name">
      <input type="text" id="webSitesi" class="tuzak" tabindex="-1" autocomplete="off" aria-hidden="true">
    </div>

    <p class="hata-kutu" id="hataKutu" role="alert" hidden></p>
    <button type="submit" class="gonder" id="gonderBtn">Anımı Duvara As</button>
    <p class="kucuk-yazi">Gönderdiğin anı <?= onayGerekli() ? 'onaylandıktan sonra' : 'hemen' ?> Anı Duvarı'nda herkese açık olarak görünür.
      Fotoğraflardaki konum bilgisi otomatik silinir.</p>
  </form>
</main>

<!-- Yükleniyor: fincan dolarken -->
<div class="perde" id="yukleniyor" hidden>
  <div class="perde-ic">
    <svg class="fincan" viewBox="0 0 120 110" aria-hidden="true">
      <defs><clipPath id="fincanIc"><path d="M14 30h76l-8 56a14 14 0 0 1-14 12H36a14 14 0 0 1-14-12z"/></clipPath></defs>
      <g class="buhar"><path d="M40 22c-6-8 6-10 0-18"/><path d="M56 22c-6-8 6-10 0-18"/><path d="M72 22c-6-8 6-10 0-18"/></g>
      <rect id="kahve" x="0" y="98" width="120" height="80" clip-path="url(#fincanIc)" fill="var(--kahve)"/>
      <path d="M14 30h76l-8 56a14 14 0 0 1-14 12H36a14 14 0 0 1-14-12z" fill="none" stroke="var(--krem)" stroke-width="4" stroke-linejoin="round"/>
      <path d="M88 42h8a12 12 0 0 1 0 24h-11" fill="none" stroke="var(--krem)" stroke-width="4"/>
    </svg>
    <div class="yuzde" id="yuzde">%0</div>
    <p>Anın demleniyor…<br><small>Lütfen sayfayı kapatma</small></p>
    <button type="button" class="metin-btn acik" id="iptalBtn">İptal et</button>
  </div>
</div>

<!-- Başarılı -->
<div class="perde" id="basarili" hidden>
  <div class="perde-ic">
    <div class="tamam">🌿</div>
    <h2 id="basariBaslik">Anın duvara asıldı!</h2>
    <p id="basariMetin">Paylaştığın için teşekkürler.</p>
    <div class="perde-butonlar">
      <a class="gonder" href="duvar.php">Anı Duvarına Git</a>
      <button type="button" class="metin-btn acik" id="yeniAni">Bir anı daha bırak</button>
    </div>
  </div>
</div>
<?php sayfaSon(['assets/yukle.js']);
