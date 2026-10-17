/** Views module. */
// Central render cycle. Feature rendering lives in banner.js,
// collection.js, and detail.js.

/** Renders the application’s currently active view. */
function render() {
  const isReworkedView = document.documentElement.dataset.cssReworkPreview === 'true';
  if (!isReworkedView) renderBanner();
  renderStatsbar();
  renderCollection();
  if (!$('#statistics-panel').hidden) renderStatisticsPanel();
  renderDetail();
}
/** Chooses and renders the active application view. */
