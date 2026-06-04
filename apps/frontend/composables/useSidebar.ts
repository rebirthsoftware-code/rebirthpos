export function useSidebar() {
  const acik = useState<boolean>('sidebarAcik', () => true);
  const mobilAcik = useState<boolean>('sidebarMobilAcik', () => false);

  function mobilAc() {
    mobilAcik.value = true;
  }
  function mobilKapat() {
    mobilAcik.value = false;
  }
  function aksamPazarTogglela() {
    acik.value = !acik.value;
  }

  return { acik, mobilAcik, mobilAc, mobilKapat, aksamPazarTogglela };
}
