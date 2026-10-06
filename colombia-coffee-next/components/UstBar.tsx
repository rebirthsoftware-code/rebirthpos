'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function UstBar({ mekan }: { mekan: string }) {
  const yol = usePathname();
  return (
    <header className="ust">
      <Link className="marka" href="/">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3c6 4 9 9 9 14a9 9 0 0 1-18 0c0-5 3-10 9-14z" fill="currentColor" />
          <path d="M16 7v20" stroke="var(--orman)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </svg>
        <span>{mekan}</span>
      </Link>
      <nav>
        <Link href="/" className={yol === '/' ? 'aktif' : ''}>Anı Bırak</Link>
        <Link href="/duvar" className={yol.startsWith('/duvar') ? 'aktif' : ''}>Anı Duvarı</Link>
      </nav>
    </header>
  );
}
