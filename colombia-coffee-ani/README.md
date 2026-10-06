# Colombia Coffee · Anı Duvarı (PHP sürümü)

Misafirlerin fotoğraf, video, sesli not ve not bıraktığı; yüklenen her şeyin herkese açık **Anı Duvarı**'nda göründüğü sistem.
Paylaşımlı PHP hostinge (cPanel vb.) dosyaları atmak yeterlidir. Veritabanı kurulumu gerekmez (SQLite).

## Sayfalar
| Adres | Ne işe yarar |
|---|---|
| `index.php` | **Anı Bırak**: fotoğraf / video / sesli not / not + isim. Yüklenirken fincan dolar. |
| `duvar.php` | **Anı Duvarı**: herkes görür. Filtre, beğeni, büyütme, yeni anı bildirimi. |
| `duvar.php?ekran=1` | **TV modu**: kafedeki ekranda polaroid slayt + "Sen de paylaş" QR'ı. Yeni anı gelince sıradaki slayt olur. |
| `yonetim.php` | Yönetim: gizle / yayınla / sil, "yayından önce onay iste", masa QR kartı yazdırma. |

## Kurulum
1. Klasörü hostinge yükleyin (ör. `public_html/ani/`).
2. `config.php` içindeki **`yonetici_sifre`**'yi değiştirin (mekan adı, slogan, Instagram da buradan).
3. `veri/` ve `yuklemeler/` klasörleri ilk yüklemede otomatik oluşur (klasöre yazma izni olmalı).
4. Gereksinim: PHP 8.1+, `pdo_sqlite`, `gd`, `fileinfo` (cPanel'de genelde açıktır). Büyük videolar için `.user.ini` sınırları yükseltir.

## Güvenlik
- Dosya türü içerikten kontrol edilir (uzantıya güvenilmez), dosya adları rastgeledir, `yuklemeler/` içinde PHP çalışmaz.
- Fotoğraflar yeniden kodlanır: boyut küçülür, **konum (GPS) dahil EXIF bilgisi silinir**.
- IP adresi açık saklanmaz; cihaz başına saatlik gönderi sınırı ve bot tuzağı vardır.
- Veritabanı dosya adı rastgeledir; nginx gibi `.htaccess` okumayan sunucularda da indirilemez.
