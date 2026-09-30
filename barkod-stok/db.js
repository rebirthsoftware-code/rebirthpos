// Veritabanı katmanı — Node 22'nin dahili SQLite'ı (ek paket gerekmez)
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const VERI_KLASORU = process.env.BARKOD_VERI || path.join(__dirname, 'veri');
fs.mkdirSync(VERI_KLASORU, { recursive: true });

const db = new DatabaseSync(path.join(VERI_KLASORU, 'barkod-stok.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS urunler (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  barkod      TEXT NOT NULL UNIQUE,
  ad          TEXT NOT NULL,
  kategori    TEXT NOT NULL DEFAULT '',
  birim       TEXT NOT NULL DEFAULT 'Adet',
  alis_fiyat  REAL NOT NULL DEFAULT 0,
  satis_fiyat REAL NOT NULL DEFAULT 0,
  kdv         REAL NOT NULL DEFAULT 20,
  stok        REAL NOT NULL DEFAULT 0,
  min_stok    REAL NOT NULL DEFAULT 0,
  aktif       INTEGER NOT NULL DEFAULT 1,
  olusturma   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  guncelleme  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Her stok değişimi buraya düşer: GIRIS (+), SATIS (-), CIKIS (-), IADE (+), SAYIM (+/-)
CREATE TABLE IF NOT EXISTS hareketler (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  urun_id    INTEGER NOT NULL REFERENCES urunler(id),
  tip        TEXT NOT NULL,
  miktar     REAL NOT NULL,
  onceki     REAL NOT NULL,
  sonraki    REAL NOT NULL,
  birim_fiyat REAL NOT NULL DEFAULT 0,
  aciklama   TEXT NOT NULL DEFAULT '',
  satis_id   INTEGER,
  tarih      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_hareket_urun ON hareketler(urun_id);
CREATE INDEX IF NOT EXISTS ix_hareket_tarih ON hareketler(tarih);

CREATE TABLE IF NOT EXISTS satislar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  fis_no     TEXT NOT NULL UNIQUE,
  toplam     REAL NOT NULL,
  iskonto    REAL NOT NULL DEFAULT 0,
  odeme_tipi TEXT NOT NULL,
  alinan     REAL NOT NULL DEFAULT 0,
  para_ustu  REAL NOT NULL DEFAULT 0,
  iptal      INTEGER NOT NULL DEFAULT 0,
  tarih      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS ix_satis_tarih ON satislar(tarih);

CREATE TABLE IF NOT EXISTS satis_kalemleri (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  satis_id   INTEGER NOT NULL REFERENCES satislar(id),
  urun_id    INTEGER NOT NULL REFERENCES urunler(id),
  barkod     TEXT NOT NULL,
  ad         TEXT NOT NULL,
  miktar     REAL NOT NULL,
  birim_fiyat REAL NOT NULL,
  tutar      REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ayarlar (
  anahtar TEXT PRIMARY KEY,
  deger   TEXT NOT NULL
);
`);

// Tek işlem (transaction) yardımcısı
function islem(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const sonuc = fn();
    db.exec('COMMIT');
    return sonuc;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Düz nesneye çevir (node:sqlite null-prototype döndürür)
const duz = (r) => (r ? { ...r } : r);
const hepsi = (sql, ...p) => db.prepare(sql).all(...p).map(duz);
const tek = (sql, ...p) => duz(db.prepare(sql).get(...p));
const calistir = (sql, ...p) => db.prepare(sql).run(...p);

module.exports = { db, islem, hepsi, tek, calistir };
