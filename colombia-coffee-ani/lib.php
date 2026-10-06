<?php
// Ortak yardımcılar: ayarlar, veritabanı (SQLite), güvenlik, sayfa iskeleti
declare(strict_types=1);

const KOK = __DIR__;
const YUKLEME_KLASORU = KOK . '/yuklemeler';

$GLOBALS['AYAR'] = require KOK . '/config.php';
define('VERI_KLASORU', rtrim($GLOBALS['AYAR']['veri_klasoru'] ?? (KOK . '/veri'), '/'));
date_default_timezone_set($GLOBALS['AYAR']['zaman_dilimi'] ?? 'Europe/Istanbul');

function ayar(string $anahtar, $varsayilan = null)
{
    return $GLOBALS['AYAR'][$anahtar] ?? $varsayilan;
}

function e($v): string
{
    return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    if (!extension_loaded('pdo_sqlite')) {
        http_response_code(500);
        exit('Sunucuda PDO SQLite eklentisi yok. Hosting panelinden "pdo_sqlite" eklentisini açın.');
    }
    klasorHazirla(VERI_KLASORU, "Require all denied\nDeny from all\n");
    // Dosya adı tahmin edilemez: .htaccess'i okumayan sunucularda (nginx vb.) da indirilemesin.
    // Anahtar .php dosyasında durur; tarayıcıdan açılırsa çalışır ve hiçbir şey göstermez.
    $anahtarDosya = VERI_KLASORU . '/anahtar.php';
    if (!is_file($anahtarDosya)) {
        file_put_contents($anahtarDosya, "<?php return '" . bin2hex(random_bytes(16)) . "';\n", LOCK_EX);
    }
    $anahtar = require $anahtarDosya;
    $pdo = new PDO('sqlite:' . VERI_KLASORU . '/anilar-' . $anahtar . '.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS anilar (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            isim      TEXT NOT NULL DEFAULT '',
            not_metni TEXT NOT NULL DEFAULT '',
            durum     TEXT NOT NULL DEFAULT 'yayinda', -- yayinda | bekliyor | gizli
            begeni    INTEGER NOT NULL DEFAULT 0,
            ip_ozet   TEXT NOT NULL DEFAULT '',
            tarih     TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_ani_durum ON anilar(durum, id);
        CREATE TABLE IF NOT EXISTS medyalar (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            ani_id    INTEGER NOT NULL REFERENCES anilar(id) ON DELETE CASCADE,
            tur       TEXT NOT NULL,              -- foto | video | ses
            dosya     TEXT NOT NULL,
            onizleme  TEXT NOT NULL DEFAULT '',
            mime      TEXT NOT NULL DEFAULT '',
            genislik  INTEGER NOT NULL DEFAULT 0,
            yukseklik INTEGER NOT NULL DEFAULT 0,
            sira      INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS ix_medya_ani ON medyalar(ani_id);
        CREATE TABLE IF NOT EXISTS begeniler (
            ani_id  INTEGER NOT NULL REFERENCES anilar(id) ON DELETE CASCADE,
            ip_ozet TEXT NOT NULL,
            PRIMARY KEY (ani_id, ip_ozet)
        );
        CREATE TABLE IF NOT EXISTS ayarlar (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL);
    ");
    return $pdo;
}

function klasorHazirla(string $yol, string $htaccess): void
{
    if (!is_dir($yol)) mkdir($yol, 0755, true);
    $h = $yol . '/.htaccess';
    if (!is_file($h)) file_put_contents($h, $htaccess);
}

// Panelden değiştirilebilen ayarlar (veritabanında), yoksa config.php
function canliAyar(string $anahtar, $varsayilan = null)
{
    $st = db()->prepare('SELECT deger FROM ayarlar WHERE anahtar = ?');
    $st->execute([$anahtar]);
    $d = $st->fetchColumn();
    return $d === false ? $varsayilan : $d;
}

function canliAyarYaz(string $anahtar, string $deger): void
{
    db()->prepare('INSERT INTO ayarlar(anahtar, deger) VALUES(?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger')
        ->execute([$anahtar, $deger]);
}

function onayGerekli(): bool
{
    return canliAyar('onay_gerekli', ayar('onay_gerekli') ? '1' : '0') === '1';
}

// IP'yi açık saklamayız; sadece limit/beğeni için tuzlu özet tutulur
function ipOzet(): string
{
    $tuz = canliAyar('tuz');
    if (!$tuz) {
        $tuz = bin2hex(random_bytes(16));
        canliAyarYaz('tuz', $tuz);
    }
    return substr(hash('sha256', $tuz . ($_SERVER['REMOTE_ADDR'] ?? '')), 0, 32);
}

function json(array $veri, int $kod = 200): never
{
    http_response_code($kod);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($veri, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function tabanUrl(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $yol = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $yol;
}

// ---------- Yönetici oturumu ----------
function oturumBaslat(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('ccani');
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
    session_start();
}

function yoneticiMi(): bool
{
    oturumBaslat();
    return !empty($_SESSION['yonetici']);
}

function sifreDogru(string $girilen): bool
{
    $kayitli = (string) ayar('yonetici_sifre', '');
    if ($kayitli === '') return false;
    if (str_starts_with($kayitli, '$2y$') || str_starts_with($kayitli, '$argon2')) {
        return password_verify($girilen, $kayitli);
    }
    return hash_equals($kayitli, $girilen);
}

function csrf(): string
{
    oturumBaslat();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

function csrfKontrol(): void
{
    oturumBaslat();
    $gelen = $_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF'] ?? '';
    if (!is_string($gelen) || !hash_equals($_SESSION['csrf'] ?? '', $gelen)) {
        json(['ok' => false, 'mesaj' => 'Oturum süresi doldu, sayfayı yenileyin.'], 403);
    }
}

// ---------- Anı verisi ----------
function medyaUrl(string $dosya): string
{
    return 'yuklemeler/' . $dosya;
}

/** Anıları medyalarıyla birlikte döndürür (duvar ve yönetim için) */
function anilariGetir(array $kosullar, array $param, int $limit = 24): array
{
    $sql = 'SELECT * FROM anilar WHERE ' . implode(' AND ', $kosullar ?: ['1=1']) . ' ORDER BY id DESC LIMIT ' . $limit;
    $st = db()->prepare($sql);
    $st->execute($param);
    $anilar = $st->fetchAll();
    if (!$anilar) return [];
    $idler = array_column($anilar, 'id');
    $yer = implode(',', array_fill(0, count($idler), '?'));
    $st = db()->prepare("SELECT * FROM medyalar WHERE ani_id IN ($yer) ORDER BY sira, id");
    $st->execute($idler);
    $medya = [];
    foreach ($st->fetchAll() as $m) {
        $medya[$m['ani_id']][] = [
            'tur' => $m['tur'],
            'url' => medyaUrl($m['dosya']),
            'onizleme' => $m['onizleme'] ? medyaUrl($m['onizleme']) : medyaUrl($m['dosya']),
            'mime' => $m['mime'],
            'g' => (int) $m['genislik'],
            'y' => (int) $m['yukseklik'],
        ];
    }
    return array_map(fn($a) => [
        'id' => (int) $a['id'],
        'isim' => $a['isim'],
        'not' => $a['not_metni'],
        'durum' => $a['durum'],
        'begeni' => (int) $a['begeni'],
        'tarih' => $a['tarih'],
        'medya' => $medya[$a['id']] ?? [],
    ], $anilar);
}

// ---------- Sayfa iskeleti ----------
function sayfaBas(string $baslik, string $aktif = '', string $govdeSinif = ''): void
{
    $mekan = e(ayar('mekan_adi'));
    $tamBaslik = $baslik ? e($baslik) . ' · ' . $mekan : $mekan;
    $v = @filemtime(KOK . '/assets/stil.css') ?: 1;
    echo <<<HTML
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f3a2b">
<title>{$tamBaslik}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Figtree:wght@400;500;600;700&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/stil.css?v={$v}">
</head>
<body class="{$govdeSinif}">
HTML;
    if ($aktif !== 'yok') {
        $p = $aktif === 'paylas' ? ' class="aktif"' : '';
        $d = $aktif === 'duvar' ? ' class="aktif"' : '';
        echo <<<HTML
<header class="ust">
  <a class="marka" href="index.php">
    <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c6 4 9 9 9 14a9 9 0 0 1-18 0c0-5 3-10 9-14z" fill="currentColor" opacity=".9"/><path d="M16 7v20" stroke="var(--krem)" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>
    <span>{$mekan}</span>
  </a>
  <nav>
    <a href="index.php"{$p}>Anı Bırak</a>
    <a href="duvar.php"{$d}>Anı Duvarı</a>
  </nav>
</header>
HTML;
    }
}

function sayfaSon(array $scriptler = []): void
{
    foreach ($scriptler as $s) {
        $v = @filemtime(KOK . '/' . $s) ?: 1;
        echo '<script src="' . e($s) . '?v=' . $v . '"></script>' . "\n";
    }
    echo "</body>\n</html>";
}

/** Dekoratif yaprak SVG'leri (sayfa kenarları) */
function yapraklar(): string
{
    return <<<SVG
<div class="yapraklar" aria-hidden="true">
  <svg class="y y1" viewBox="0 0 200 200"><path d="M100 190C40 150 20 90 60 20c30 40 70 60 80 110 5 30-10 50-40 60z" fill="var(--yaprak-1)"/><path d="M100 190C90 130 80 80 60 20" stroke="var(--yaprak-damar)" stroke-width="3" fill="none"/></svg>
  <svg class="y y2" viewBox="0 0 200 200"><path d="M20 180C30 100 90 40 180 30c-20 70-60 140-160 150z" fill="var(--yaprak-2)"/><path d="M20 180C70 120 120 70 180 30" stroke="var(--yaprak-damar)" stroke-width="3" fill="none"/></svg>
  <svg class="y y3" viewBox="0 0 200 200"><path d="M100 10c50 30 70 90 40 160-10-50-60-70-70-110C66 40 80 20 100 10z" fill="var(--yaprak-3)"/><path d="M100 10c10 60 30 100 40 160" stroke="var(--yaprak-damar)" stroke-width="3" fill="none"/></svg>
  <svg class="y y4" viewBox="0 0 200 200"><path d="M180 180C120 170 40 120 30 30c70 10 140 60 150 150z" fill="var(--yaprak-1)"/><path d="M180 180C130 120 80 70 30 30" stroke="var(--yaprak-damar)" stroke-width="3" fill="none"/></svg>
</div>
SVG;
}
