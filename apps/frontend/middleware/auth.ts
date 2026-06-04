export default defineNuxtRouteMiddleware((to) => {
  // SSR sırasında çalışma — auth state localStorage'da, SSR erişemez.
  // Yeni pencere (window.open) açılışlarında SSR redirect'i, doğru oturuma
  // rağmen "/login"e atıyordu. Client-only kontrol bunu önler.
  if (import.meta.server) return;
  const auth = useAuthStore();
  auth.yukle();
  if (!auth.girisYapilmis && to.path !== '/login') {
    return navigateTo('/login');
  }
  if (auth.girisYapilmis && to.path === '/login') {
    return navigateTo('/');
  }
});
