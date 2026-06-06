const desktopBuild = process.env.DESKTOP_BUILD === 'true';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  // Desktop (Electron) build: tam SPA, file:// uyumlu göreceli yollar
  // Web/dev: SSR varsayılan (Windows IPC sorunsuz)
  ssr: desktopBuild ? false : undefined,

  ...(desktopBuild && {
    nitro: { preset: 'static' },
  }),

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  app: {
    baseURL: desktopBuild ? './' : '/',
    buildAssetsDir: '/_nuxt/',
    head: {
      title: 'Rebirth POS',
      htmlAttrs: { lang: 'tr' },
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      // Öncelik: NUXT_PUBLIC_API_BASE env her şeyi geçersiz kılar.
      // - Masaüstü (Electron) build: göreli/localhost olamaz (file:// + yanında backend yok)
      //   → varsayılan CANLI API. Kendi sunucunuza build için NUXT_PUBLIC_API_BASE verin.
      // - Vercel (web): aynı projede /api → göreli yol, CORS yok.
      // - Yerel geliştirme: ayrı NestJS portu.
      apiBase:
        process.env.NUXT_PUBLIC_API_BASE ||
        (desktopBuild
          ? 'https://rebirthpos.vercel.app/api'
          : process.env.VERCEL
            ? '/api'
            : 'http://localhost:3001/api'),
    },
  },

  typescript: { strict: true },
});
