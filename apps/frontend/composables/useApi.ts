/**
 * Backend API'yi authorization header'ı ile çağırmak için yardımcı.
 * Token süresi dolarsa otomatik refresh deneme yapar.
 */
export async function apiFetch<T>(
  url: string,
  options: any = {},
): Promise<T> {
  const config = useRuntimeConfig();
  const auth = useAuthStore();

  const yap = (token: string) =>
    $fetch<T>(url, {
      baseURL: config.public.apiBase,
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

  try {
    return await yap(auth.accessToken);
  } catch (e: any) {
    if (e?.status === 401 && auth.refreshToken) {
      const yenilendi = await auth.tokenYenile();
      if (yenilendi) return yap(auth.accessToken);
      auth.cikis();
      await navigateTo('/login');
    }
    throw e;
  }
}
