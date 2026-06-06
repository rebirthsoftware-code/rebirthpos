<script setup lang="ts">
// /qr (şube/masa kodu olmadan) → bilgilendirme. Asıl menü /qr/<subeId> rotasında.
definePageMeta({ layout: false });
</script>

<template>
  <Html lang="tr"><Head><Title>QR Menü</Title></Head></Html>

  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="glass-card p-8 max-w-md w-full text-center">
      <div class="w-16 h-16 rounded-2xl bg-gold-primary/15 flex items-center justify-center text-gold-primary text-3xl mx-auto mb-5">
        <i class="fas fa-qrcode" />
      </div>
      <h1 class="text-xl font-bold gold-text mb-2">QR Menü</h1>
      <p class="text-pearl-60 text-sm leading-relaxed mb-4">
        Bu sayfaya doğrudan girilmez. Menüye ulaşmak için masanızdaki
        <b class="text-pearl-90">QR kodu</b> telefon kameranızla okutun.
      </p>
      <div class="text-left bg-pearl-5 border border-pearl-10 rounded-xl p-4 text-xs text-pearl-60 space-y-1.5">
        <div class="text-pearl-80 font-semibold uppercase tracking-wider text-[10px] mb-1">Doğru bağlantı biçimi</div>
        <div class="font-mono break-all">/qr/&lt;şubeId&gt;</div>
        <div class="font-mono break-all">/qr/&lt;şubeId&gt;?masa=&lt;masaId&gt;</div>
      </div>
      <p class="text-pearl-50 text-xs mt-4">
        İşletme yöneticisiyseniz QR kodlarını panelde
        <b class="text-pearl-70">Masalar → (masa) QR</b> veya <b class="text-pearl-70">Menü QR</b>
        üzerinden üretip yazdırabilirsiniz.
      </p>
    </div>
  </div>
</template>
