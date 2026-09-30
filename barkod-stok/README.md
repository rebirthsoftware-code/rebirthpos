# Barkodlu Stok & Satış

Ürünlere barkod etiketi basıp **stok girişi**, satarken **otomatik stok çıkışı** yapan,
fiyatı ve eldeki adedi anında gösteren bağımsız kasa/stok sistemi.

Ana Rebirth POS projesinden tamamen ayrıdır — **hiçbir ek paket gerektirmez**
(sadece Node.js 22.5+; veritabanı Node'un dahili SQLite'ı).

## Çalıştırma

```bash
cd barkod-stok
npm start            # ya da: node server.js
```

Tarayıcıda **http://localhost:4100** açın. Windows'ta `baslat.bat` dosyasına çift tıklamanız yeterli.

- Port değiştirmek için: `PORT=5000 npm start`
- Veriler `barkod-stok/veri/barkod-stok.db` dosyasında tutulur (yedek almak için bu dosyayı kopyalayın).
- Aynı ağdaki başka bir bilgisayar/tablet `http://<bu-bilgisayarın-ip>:4100` ile aynı veriye bağlanabilir.

## Ekranlar

| Ekran | Ne yapar |
|---|---|
| **Satış** (F1) | Barkod okut → sepete eklenir, **fiyat** ve **elde kalan stok** anında görünür. `3*barkod` = 3 adet. İskonto, Nakit/Kart, para üstü. **F9** ile satışı tamamla → stok otomatik düşer. |
| **Stok Giriş / Çıkış** (F2) | *Giriş*: gelen malı okut, miktar/alış fiyatı gir, stoğa ekle. Tanımsız barkod okutulursa yeni ürün formu açılır. *Çıkış*: fire/zayi. *Sayım*: sayılan değere eşitle. “Sonra etiket bas” ile girilen adet kadar etiket kuyruğa eklenir. |
| **Ürünler & Stok** (F3) | Tüm ürünler, alış/satış fiyatı, eldeki adet (kritik stok renkli), stok değeri. Excel (CSV) dışa aktarma. |
| **Barkod Etiketi Bas** (F4) | Etiket yazıcısı (rulo, ör. 50×30 mm) veya A4 etiket kâğıdı. Ürün adı, barkod, fiyat. |
| **Satışlar** | Tarih aralığı, ciro/nakit/kart toplamları, fiş detay, **fiş yazdırma**, **satış iptali** (stok geri eklenir). |
| **Stok Hareketleri** | Her giriş/satış/çıkış/iade/sayım kaydı; önceki → sonraki stok. |
| **Özet** | Günlük ciro, stok değeri, kritik stoklar, en çok satanlar. |

## Barkodlar

- Ürünün kendi barkodu varsa (ör. `869…` ile başlayan EAN-13) okutup aynen kullanabilirsiniz.
- Barkodu olmayan ürünlere sistem **`2` ile başlayan mağaza içi EAN-13** üretir (dünya genelinde iç kullanıma ayrılmış aralık, başka ürünle çakışmaz).
- Geçerli 13 haneli kodlar EAN-13, diğer her şey Code128 olarak basılır. Barkod çizimi `public/barkod.js` içindedir, internet gerekmez.
- USB/Bluetooth barkod okuyucular klavye gibi çalışır; okuma sonunda Enter göndermesi yeterlidir (fabrika ayarı).

## Yazdırma ipuçları

- Tarayıcının yazdırma penceresinde **Kenar boşlukları: Yok**, **Ölçek: %100** seçin.
- Etiket yazıcısında (Zebra, TSC, Xprinter vb.) sürücüden kâğıt boyutunu etiket ölçüsüne ayarlayın.
- Fiş 80 mm termal yazıcıya göre hazırlanmıştır. Ayarlar’dan işletme adı ve fiş yazılarını girin; “otomatik fiş” açılabilir.

## Dosyalar

```
barkod-stok/
├── server.js        HTTP sunucu + REST API
├── db.js            SQLite şeması
├── baslat.bat       Windows için çift tıkla başlat
└── public/
    ├── index.html
    ├── app.js       Arayüz (satış, stok, etiket, raporlar)
    ├── barkod.js    EAN-13 / Code128 SVG üretici
    └── style.css
```

## Canlı demo (sunucusuz)

`node barkod-stok/demo/olustur.js` komutu `demo/barkod-stok-demo.html` adında tek dosyalık bir demo üretir. Bu dosya sunucu olmadan tarayıcıda açılır, veriler tarayıcıda saklanır ve örnek ürünlerle gelir.
