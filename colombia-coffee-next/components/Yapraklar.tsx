// Sayfa kenarlarında hafifçe sallanan dekoratif yapraklar (monstera / kahve yaprağı siluetleri)
export default function Yapraklar() {
  return (
    <div className="yapraklar" aria-hidden="true">
      <svg className="y y1" viewBox="0 0 200 200"><path d="M100 190C40 150 20 90 60 20c30 40 70 60 80 110 5 30-10 50-40 60z" fill="var(--yaprak-1)" /><path d="M100 190C90 130 80 80 60 20" stroke="var(--yaprak-damar)" strokeWidth="3" fill="none" /></svg>
      <svg className="y y2" viewBox="0 0 200 200"><path d="M20 180C30 100 90 40 180 30c-20 70-60 140-160 150z" fill="var(--yaprak-2)" /><path d="M20 180C70 120 120 70 180 30" stroke="var(--yaprak-damar)" strokeWidth="3" fill="none" /></svg>
      <svg className="y y3" viewBox="0 0 200 200"><path d="M100 10c50 30 70 90 40 160-10-50-60-70-70-110C66 40 80 20 100 10z" fill="var(--yaprak-3)" /><path d="M100 10c10 60 30 100 40 160" stroke="var(--yaprak-damar)" strokeWidth="3" fill="none" /></svg>
      <svg className="y y4" viewBox="0 0 200 200"><path d="M180 180C120 170 40 120 30 30c70 10 140 60 150 150z" fill="var(--yaprak-1)" /><path d="M180 180C130 120 80 70 30 30" stroke="var(--yaprak-damar)" strokeWidth="3" fill="none" /></svg>
    </div>
  );
}
