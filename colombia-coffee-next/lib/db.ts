import 'server-only';
import postgres from 'postgres';

// Geliştirmede sıcak yeniden yüklemede bağlantı havuzu çoğalmasın
const g = globalThis as unknown as { __sql?: postgres.Sql; __sema?: Promise<void> };

function baglan(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL tanımlı değil (.env.example dosyasına bakın)');
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    prepare: false, // Neon / PgBouncer havuzlayıcılarıyla uyumlu
    onnotice: () => {},
  });
}

// Bağlantı ilk sorguda kurulur (derleme sırasında DATABASE_URL gerekmez)
const gercek = () => g.__sql ?? (g.__sql = baglan());
export const sql = new Proxy(function () {} as unknown as postgres.Sql, {
  apply: (_h, _bu, arg) => (gercek() as unknown as (...a: unknown[]) => unknown)(...arg),
  get: (_h, ad) => Reflect.get(gercek(), ad),
});

/** Tablolar yoksa oluşturur (ilk istekte bir kez). Ayrı migration adımı gerekmez. */
export function semaHazir(): Promise<void> {
  g.__sema ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS ani_anilar (
        id        SERIAL PRIMARY KEY,
        isim      TEXT NOT NULL DEFAULT '',
        not_metni TEXT NOT NULL DEFAULT '',
        durum     TEXT NOT NULL DEFAULT 'yayinda',
        cihaz     TEXT NOT NULL DEFAULT '',
        ip_ozet   TEXT NOT NULL DEFAULT '',
        olusturma TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS ani_anilar_durum_ix ON ani_anilar (durum, id DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS ani_medyalar (
        id        SERIAL PRIMARY KEY,
        ani_id    INTEGER NOT NULL REFERENCES ani_anilar(id) ON DELETE CASCADE,
        tur       TEXT NOT NULL,
        url       TEXT NOT NULL,
        onizleme  TEXT NOT NULL DEFAULT '',
        mime      TEXT NOT NULL DEFAULT '',
        genislik  INTEGER NOT NULL DEFAULT 0,
        yukseklik INTEGER NOT NULL DEFAULT 0,
        sure      REAL NOT NULL DEFAULT 0,
        sira      INTEGER NOT NULL DEFAULT 0
      )`;
    await sql`CREATE INDEX IF NOT EXISTS ani_medyalar_ani_ix ON ani_medyalar (ani_id)`;
    await sql`
      CREATE TABLE IF NOT EXISTS ani_tepkiler (
        ani_id INTEGER NOT NULL REFERENCES ani_anilar(id) ON DELETE CASCADE,
        emoji  TEXT NOT NULL,
        cihaz  TEXT NOT NULL,
        PRIMARY KEY (ani_id, emoji, cihaz)
      )`;
    await sql`CREATE TABLE IF NOT EXISTS ani_ayarlar (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL)`;
  })().catch((e) => {
    g.__sema = undefined; // bir sonraki istekte tekrar denensin
    throw e;
  });
  return g.__sema;
}
