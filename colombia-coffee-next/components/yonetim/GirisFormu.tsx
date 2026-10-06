'use client';
import { useActionState } from 'react';
import { girisYap } from '@/app/yonetim/islemler';

export default function GirisFormu({ mekan }: { mekan: string }) {
  const [durum, gonder, bekliyor] = useActionState(girisYap, undefined);
  return (
    <form action={gonder} className="kart giris-kart">
      <h1>Yönetim</h1>
      <p className="aciklama">{mekan} · Anı Duvarı</p>
      <input type="password" name="sifre" placeholder="Şifre" autoFocus required autoComplete="current-password" />
      {durum?.hata && <p className="hata-kutu">{durum.hata}</p>}
      <button className="gonder" disabled={bekliyor}>{bekliyor ? 'Kontrol ediliyor…' : 'Giriş yap'}</button>
    </form>
  );
}
