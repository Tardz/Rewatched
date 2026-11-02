/* TEMPORARY: dormant sequencing helper for future Settings branch trees.
   This file is intentionally not loaded by index.html. */

/** Set matching per-row elbow delays and trunk progress for a tree reveal. */
function prepareBranchTreeReveal(tree, { duration = 240, reverse = false } = {}) {
  const rows = [...tree.children];
  const totalDuration = Math.max(0, rows.length * duration);
  rows.forEach((row, index) => {
    const order = reverse ? rows.length - index - 1 : index;
    row.style.setProperty('--branch-elbow-progress', reverse ? '0%' : '100%');
    row.style.setProperty('--branch-draw-delay', `${order * duration}ms`);
  });
  tree.style.setProperty('--branch-draw-duration', `${totalDuration}ms`);
  tree.style.setProperty('--branch-progress', reverse ? '0' : '1');
  tree.style.setProperty('--branch-total-duration', `${totalDuration}ms`);
  return totalDuration;
}
