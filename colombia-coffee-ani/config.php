<?php
// Colombia Coffee · Anı Duvarı — ayarlar
// Yayına almadan önce en azından "yonetici_sifre"yi değiştirin.
return [
    'mekan_adi'      => 'Colombia Coffee',
    'slogan'         => 'Her fincanın bir hikâyesi var',
    'konum'          => '', // ör. 'Kadıköy, İstanbul' — başlıkta küçük yazı olarak görünür
    'instagram'      => '', // ör. 'colombiacoffee' — duvar altında görünür

    // Yönetim paneli şifresi. Düz metin ya da password_hash() çıktısı ($2y$...) olabilir.
    'yonetici_sifre' => 'degistir-beni',

    // true: yüklenen anılar yönetici onaylayana kadar duvarda görünmez.
    // (Yönetim panelinden de açılıp kapatılabilir; panel ayarı bunu ezer.)
    'onay_gerekli'   => false,

    // Dosya sınırları (sunucunun upload_max_filesize / post_max_size değerleri de yeterli olmalı)
    'max_foto_mb'    => 15,
    'max_video_mb'   => 200,
    'max_ses_mb'     => 20,
    'max_dosya'      => 10,   // bir gönderide en fazla dosya
    'max_not'        => 500,  // not karakter sınırı

    // Kötüye kullanım koruması: bir cihazdan saatte en fazla kaç gönderi
    'saatlik_limit'  => 20,

    'zaman_dilimi'   => 'Europe/Istanbul',

    // İsteğe bağlı: veritabanını web kökünün dışında tutmak için tam yol (ör. '/home/kullanici/ani-veri')
    // 'veri_klasoru' => '/home/kullanici/ani-veri',
];
