<?php
// Anı yükleme: fotoğraf[] / video[] / ses + not + isim → JSON
declare(strict_types=1);
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json(['ok' => false, 'mesaj' => 'Geçersiz istek'], 405);

// post_max_size aşılırsa PHP $_POST ve $_FILES'ı boş bırakır
if (empty($_POST) && empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    json(['ok' => false, 'mesaj' => 'Dosyalar çok büyük. Daha az ya da daha küçük dosya seçip tekrar dene.'], 413);
}

// Bot tuzağı: gerçek kullanıcı bu gizli alanı doldurmaz
if (!empty($_POST['web_sitesi'])) json(['ok' => true, 'durum' => 'yayinda', 'mesaj' => 'Teşekkürler!']);

@ini_set('memory_limit', '512M');
@set_time_limit(300);

$ipOzet = ipOzet();
$st = db()->prepare("SELECT COUNT(*) FROM anilar WHERE ip_ozet = ? AND tarih >= ?");
$st->execute([$ipOzet, date('Y-m-d H:i:s', time() - 3600)]);
if ((int) $st->fetchColumn() >= (int) ayar('saatlik_limit', 20)) {
    json(['ok' => false, 'mesaj' => 'Kısa sürede çok fazla anı gönderildi. Biraz sonra tekrar dene.'], 429);
}

$isim = trim(mb_substr(strip_tags((string) ($_POST['isim'] ?? '')), 0, 60));
$not = trim(mb_substr(strip_tags((string) ($_POST['not'] ?? '')), 0, (int) ayar('max_not', 500)));

// Gelen dosyaları düz listeye çevir
function dosyaListesi(string $alan): array
{
    if (empty($_FILES[$alan])) return [];
    $f = $_FILES[$alan];
    if (!is_array($f['name'])) return [$f];
    $liste = [];
    foreach ($f['name'] as $i => $ad) {
        $liste[] = ['name' => $ad, 'type' => $f['type'][$i], 'tmp_name' => $f['tmp_name'][$i], 'error' => $f['error'][$i], 'size' => $f['size'][$i]];
    }
    return $liste;
}

const IZINLI = [
    'foto'  => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/heic' => 'heic', 'image/heif' => 'heic'],
    'video' => ['video/mp4' => 'mp4', 'video/quicktime' => 'mov', 'video/webm' => 'webm', 'video/3gpp' => '3gp', 'video/x-m4v' => 'm4v', 'video/mpeg' => 'mpg'],
    'ses'   => ['audio/webm' => 'webm', 'video/webm' => 'webm', 'audio/ogg' => 'ogg', 'audio/mp4' => 'm4a', 'video/mp4' => 'm4a', 'audio/x-m4a' => 'm4a',
                'audio/mpeg' => 'mp3', 'audio/wav' => 'wav', 'audio/x-wav' => 'wav', 'audio/aac' => 'aac'],
];

$gelen = [];
foreach (['foto' => 'foto', 'video' => 'video', 'ses' => 'ses'] as $alan => $tur) {
    foreach (dosyaListesi($alan) as $d) {
        if ($d['error'] === UPLOAD_ERR_NO_FILE) continue;
        $gelen[] = [$tur, $d];
    }
}

if (!$gelen && $not === '') json(['ok' => false, 'mesaj' => 'Paylaşmak için bir fotoğraf, video, ses kaydı ya da not ekle.'], 400);
if (count($gelen) > (int) ayar('max_dosya', 10)) {
    json(['ok' => false, 'mesaj' => 'Bir seferde en fazla ' . ayar('max_dosya', 10) . ' dosya gönderebilirsin.'], 400);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$alt = date('Y/m');
$hedefKlasor = YUKLEME_KLASORU . '/' . $alt;
klasorHazirla(YUKLEME_KLASORU, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|php\\d|phar|pl|py|cgi|sh)$\">\n  Require all denied\n  Deny from all\n</FilesMatch>\nRemoveHandler .php .phtml\nAddType text/plain .php .phtml\n");
if (!is_dir($hedefKlasor)) mkdir($hedefKlasor, 0755, true);

$kaydedilen = [];   // [tur, dosya, onizleme, mime, g, y]
$yazilanlar = [];   // hata olursa silinecekler
$temizle = function () use (&$yazilanlar) { foreach ($yazilanlar as $y) @unlink($y); };

try {
    foreach ($gelen as $sira => [$tur, $d]) {
        if ($d['error'] !== UPLOAD_ERR_OK) {
            $buyuk = in_array($d['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
            throw new RuntimeException(($buyuk ? 'Dosya çok büyük: ' : 'Dosya yüklenemedi: ') . $d['name']);
        }
        if (!is_uploaded_file($d['tmp_name'])) throw new RuntimeException('Geçersiz dosya');
        $mime = $finfo->file($d['tmp_name']) ?: '';
        // Bazı tarayıcıların ses kaydı "application/octet-stream" görünebilir
        if ($tur === 'ses' && $mime === 'application/octet-stream') $mime = 'audio/webm';
        if (!isset(IZINLI[$tur][$mime])) throw new RuntimeException('Desteklenmeyen dosya türü: ' . $d['name']);
        $sinirMb = (int) ayar('max_' . $tur . '_mb', 20);
        if ($d['size'] > $sinirMb * 1024 * 1024) throw new RuntimeException("Dosya {$sinirMb} MB'tan büyük olamaz: " . $d['name']);

        $ad = bin2hex(random_bytes(10));
        $uzanti = IZINLI[$tur][$mime];
        $g = $y = 0;
        $onizleme = '';

        if ($tur === 'foto' && in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) && extension_loaded('gd')) {
            // Yeniden kodla: döndürmeyi düzelt, boyutu küçült, konum (EXIF/GPS) bilgisini sil
            [$asil, $kucuk, $g, $y] = fotoIsle($d['tmp_name'], $mime, "$hedefKlasor/$ad");
            $yazilanlar[] = $asil; $yazilanlar[] = $kucuk;
            $dosya = "$alt/" . basename($asil);
            $onizleme = "$alt/" . basename($kucuk);
            $mime = 'image/jpeg';
        } else {
            $hedef = "$hedefKlasor/$ad.$uzanti";
            if (!move_uploaded_file($d['tmp_name'], $hedef)) throw new RuntimeException('Dosya kaydedilemedi');
            $yazilanlar[] = $hedef;
            $dosya = "$alt/$ad.$uzanti";
            if ($tur === 'foto' && ($bilgi = @getimagesize($hedef))) [$g, $y] = $bilgi;
        }
        $kaydedilen[] = [$tur, $dosya, $onizleme, $mime, $g, $y, $sira];
    }

    $durum = onayGerekli() ? 'bekliyor' : 'yayinda';
    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO anilar(isim, not_metni, durum, ip_ozet, tarih) VALUES(?, ?, ?, ?, ?)')
        ->execute([$isim, $not, $durum, $ipOzet, date('Y-m-d H:i:s')]);
    $aniId = (int) $pdo->lastInsertId();
    $ekle = $pdo->prepare('INSERT INTO medyalar(ani_id, tur, dosya, onizleme, mime, genislik, yukseklik, sira) VALUES(?, ?, ?, ?, ?, ?, ?, ?)');
    foreach ($kaydedilen as $k) $ekle->execute([$aniId, ...$k]);
    $pdo->commit();
} catch (Throwable $ex) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    $temizle();
    $mesaj = $ex instanceof RuntimeException ? $ex->getMessage() : 'Bir şeyler ters gitti, tekrar dene.';
    if (!$ex instanceof RuntimeException) error_log('[ani-duvari] ' . $ex);
    json(['ok' => false, 'mesaj' => $mesaj], 400);
}

json([
    'ok' => true,
    'id' => $aniId,
    'durum' => $durum,
    'mesaj' => $durum === 'yayinda' ? 'Anın duvara asıldı!' : 'Anın alındı, onaylandıktan sonra duvarda görünecek.',
]);

/**
 * Fotoğrafı JPEG olarak yeniden yazar (en uzun kenar 2000px) + 640px önizleme.
 * EXIF yönünü uygular; yeniden kodlama konum dahil tüm üst verileri temizler.
 */
function fotoIsle(string $kaynak, string $mime, string $hedefOnek): array
{
    $img = match ($mime) {
        'image/jpeg' => @imagecreatefromjpeg($kaynak),
        'image/png' => @imagecreatefrompng($kaynak),
        'image/webp' => @imagecreatefromwebp($kaynak),
    };
    if (!$img) throw new RuntimeException('Fotoğraf okunamadı');

    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($kaynak);
        $yon = (int) ($exif['Orientation'] ?? 1);
        $aci = [3 => 180, 6 => -90, 8 => 90][$yon] ?? 0;
        if ($aci) { $d = imagerotate($img, $aci, 0); imagedestroy($img); $img = $d; }
    }
    // PNG şeffaflığı beyaz zemine
    $w = imagesx($img); $h = imagesy($img);
    $zemin = imagecreatetruecolor($w, $h);
    imagefill($zemin, 0, 0, imagecolorallocate($zemin, 255, 255, 255));
    imagecopy($zemin, $img, 0, 0, 0, 0, $w, $h);
    imagedestroy($img);

    $yaz = function (int $maks, string $yol) use ($zemin, $w, $h): array {
        $oran = min(1, $maks / max($w, $h));
        $nw = max(1, (int) round($w * $oran)); $nh = max(1, (int) round($h * $oran));
        $yeni = imagecreatetruecolor($nw, $nh);
        imagecopyresampled($yeni, $zemin, 0, 0, 0, 0, $nw, $nh, $w, $h);
        imageinterlace($yeni, true);
        if (!imagejpeg($yeni, $yol, $maks > 1000 ? 85 : 78)) throw new RuntimeException('Fotoğraf kaydedilemedi');
        imagedestroy($yeni);
        return [$nw, $nh];
    };
    [$nw, $nh] = $yaz(2000, "$hedefOnek.jpg");
    $yaz(640, "{$hedefOnek}_k.jpg");
    imagedestroy($zemin);
    return ["$hedefOnek.jpg", "{$hedefOnek}_k.jpg", $nw, $nh];
}
