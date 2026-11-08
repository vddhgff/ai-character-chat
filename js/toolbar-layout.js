// Same width-measured progressive collapse order as the original Perchance toolbar.
export const TOOLBAR_DROP_ORDER = ['threadNarratorStatusEl','threadImaginationStatusEl','threadMindStatusEl','threadWebStatusEl','threadNeedsStatusEl','threadFreeWillStatusEl','threadWebLabelText','threadNarratorStyleSelector','threadImaginationFlavorSelector','threadArtStyleSelector','threadWebSettingsBtn','threadNarratorSettingsBtn','threadImaginationSettingsBtn','threadImaginationSparkBtn','threadMindThinkBtn','threadArtStyleRandomBtn','threadMindCtn','threadNeedsCtn','threadNarratorCtn','threadImaginationCtn','threadArtStyleCtn','threadWebCtn','threadFreeWillCtn'];
export function fitFeatureToolbar(bar, toolbar, availableWidth = bar?.clientWidth) {
  if (!bar || !toolbar || !(bar.clientWidth > 0)) return;
  toolbar.hidden = false;
  const room = Math.max(0, Math.min(bar.clientWidth, availableWidth));
  const occupied = () => toolbar.scrollWidth + Math.max(0, (toolbar.offsetWidth || 0) - (toolbar.clientWidth || 0));
  const find = id => toolbar.querySelector(`#${id}`);
  const candidates = TOOLBAR_DROP_ORDER.map(find).filter(Boolean);
  const groups = [...toolbar.querySelectorAll('.threadFeatureGroup')];
  const separators = [...toolbar.querySelectorAll('.threadFeatureSep')];
  const syncSeparators = () => {
    separators.forEach(s => s.hidden = true);
    groups.filter(g => !g.hidden).slice(1).forEach(g => { const sep = g.previousElementSibling; if (sep?.classList.contains('threadFeatureSep')) sep.hidden = false; });
  };
  candidates.forEach(el => el.hidden = false); syncSeparators();
  for (const el of candidates) { if (occupied() <= room + 1) break; el.hidden = true; syncSeparators(); }
  toolbar.hidden = !groups.some(g => !g.hidden);
}
