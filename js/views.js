/** Views module. */
// Central render cycle. Feature rendering lives in banner.js,
// collection.js, and detail.js.

/** Renders the application’s currently active view. */
function render() {
  renderBanner();
  renderStatsbar();
  renderCollection();
  renderStatisticsPanel();
  renderDetail();
}
/** Chooses and renders the active application view. */
