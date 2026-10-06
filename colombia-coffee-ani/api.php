<?php
// Herkese açık duvar API'si: liste + beğeni
declare(strict_types=1);
require __DIR__ . '/lib.php';

$islem = $_GET['islem'] ?? 'liste';

if ($islem === 'liste') {
    $kosul = ["durum = 'yayinda'"];
    $param = [];
    if (isset($_GET['once'])) { $kosul[] = 'id < ?'; $param[] = (int) $_GET['once']; }   // eski sayfalar
    if (isset($_GET['sonra'])) { $kosul[] = 'id > ?'; $param[] = (int) $_GET['sonra']; } // yeni gelenler
    $tur = $_GET['tur'] ?? '';
    if (in_array($tur, ['foto', 'video', 'ses'], true)) {
        $kosul[] = 'EXISTS (SELECT 1 FROM medyalar m WHERE m.ani_id = anilar.id AND m.tur = ?)';
        $param[] = $tur;
    } elseif ($tur === 'not') {
        $kosul[] = "not_metni <> ''";
    }
    $limit = min(60, max(1, (int) ($_GET['limit'] ?? 24)));
    $anilar = anilariGetir($kosul, $param, $limit);
    foreach ($anilar as &$a) unset($a['durum']);
    json(['ok' => true, 'anilar' => $anilar, 'devami' => count($anilar) === $limit]);
}

if ($islem === 'begen' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = (int) ($_POST['id'] ?? 0);
    $pdo = db();
    $st = $pdo->prepare("SELECT id FROM anilar WHERE id = ? AND durum = 'yayinda'");
    $st->execute([$id]);
    if (!$st->fetchColumn()) json(['ok' => false, 'mesaj' => 'Anı bulunamadı'], 404);
    $ekle = $pdo->prepare('INSERT OR IGNORE INTO begeniler(ani_id, ip_ozet) VALUES(?, ?)');
    $ekle->execute([$id, ipOzet()]);
    if ($ekle->rowCount()) $pdo->prepare('UPDATE anilar SET begeni = begeni + 1 WHERE id = ?')->execute([$id]);
    $st = $pdo->prepare('SELECT begeni FROM anilar WHERE id = ?');
    $st->execute([$id]);
    json(['ok' => true, 'begeni' => (int) $st->fetchColumn()]);
}

json(['ok' => false, 'mesaj' => 'Bilinmeyen işlem'], 400);
