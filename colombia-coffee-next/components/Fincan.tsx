// Yükleme göstergesi: yükleme ilerledikçe kahve fincanı dolar, üstünden buhar tüter
export default function Fincan({ oran }: { oran: number }) {
  const y = 98 - 68 * Math.max(0, Math.min(1, oran));
  return (
    <svg className="fincan" viewBox="0 0 120 110" aria-hidden="true">
      <defs>
        <clipPath id="fincanIc"><path d="M14 30h76l-8 56a14 14 0 0 1-14 12H36a14 14 0 0 1-14-12z" /></clipPath>
      </defs>
      <g className="buhar"><path d="M40 22c-6-8 6-10 0-18" /><path d="M56 22c-6-8 6-10 0-18" /><path d="M72 22c-6-8 6-10 0-18" /></g>
      <g clipPath="url(#fincanIc)">
        <rect className="kahve" x="0" y={y} width="120" height="80" fill="var(--kahve)" />
        <path className="kahve-dalga" d={`M0 ${y} q15 -4 30 0 t30 0 t30 0 t30 0 v6 h-120z`} fill="#8a5a35" />
      </g>
      <path d="M14 30h76l-8 56a14 14 0 0 1-14 12H36a14 14 0 0 1-14-12z" fill="none" stroke="var(--krem)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M88 42h8a12 12 0 0 1 0 24h-11" fill="none" stroke="var(--krem)" strokeWidth="4" />
    </svg>
  );
}
