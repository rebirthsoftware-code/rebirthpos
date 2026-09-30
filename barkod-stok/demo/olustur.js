// Tek dosyalık demo üretir: demo/barkod-stok-demo.html (sunucusuz, tarayıcıda çalışır)
const fs = require('node:fs');
const path = require('node:path');
const oku = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const govde = oku('public/index.html').match(/<body>([\s\S]*?)<script/)[1]
  .replace('<div class="saat" id="saat"></div>', `<div class="demo-not">
        <span><b>Demo:</b> veriler bu tarayıcıda saklanır. Barkod okuyucu klavye gibi çalışır; elle yazıp Enter da basabilirsiniz.</span>
        <button class="btn kucuk" onclick="demoSifirla()">Örnek verilere dön</button>
      </div>
      <div class="saat" id="saat"></div>`);

const html = `<title>Barkod Stok Satış</title>
<style>
${oku('public/style.css')}
.demo-not { margin-top: auto; font-size: 12px; line-height: 1.45; color: #cbd5e1; background: #1f2937; border-radius: 8px; padding: 10px; display: grid; gap: 8px; }
.demo-not + .saat { margin-top: 0; }
.demo-not .btn { color: var(--yazi); }
@media (max-width: 1000px) { .demo-not { display: none; } }
@media (max-width: 600px) { main { padding: 16px; } .toplam-rakam { font-size: 32px; } }
</style>
${govde}
<script>${oku('public/barkod.js')}</script>
<script>${oku('demo/demo-api.js')}</script>
<script>${oku('public/app.js')}</script>
`;
fs.writeFileSync(path.join(__dirname, 'barkod-stok-demo.html'), html);
console.log('demo/barkod-stok-demo.html oluşturuldu (' + Math.round(html.length / 1024) + ' KB)');
