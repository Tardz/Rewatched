/** Banner module. */
// The rotating spotlight banner.

/** Renders the active featured entry and its banner details. */
function renderBanner() {
  const source = bannerEntries();
  const recent = source.slice(0, 7);
  const banner = $('#banner');
  banner.hidden = !recent.length;
  if (!recent.length) return;

  bannerIndex = (bannerIndex + recent.length) % recent.length;
  const entry = recent[bannerIndex];
  const watch = activeView === 'watchlist'
    ? { score: Number(entry.priority || 3) * 2, date: '' }
    : latest(entry);

  $('#banner-label').textContent = activeView === 'watchlist'
    ? `${entry.type.toUpperCase()} · WATCHLIST${entry.year ? ` · ${entry.year}` : ''}`
    : `${entry.type.toUpperCase()} · RECENTLY RATED${entry.year ? ` · ${entry.year}` : ''}`;
  $('#banner-title').textContent = entry.title;
  const director = $('#banner-director');
  director.textContent = entry.director ? `by ${entry.director}` : '';
  director.hidden = !entry.director;
  const bannerScore = $('#banner-score');
  const scoreFill = `${Number(watch.score) * 10}%`;
  const priority = Math.min(5, Math.max(1, Number(entry.priority) || 3));
  const scoreColor = activeView === 'watchlist'
    ? priority <= 2 ? '#7edb9a' : priority === 3 ? '#8fc9ff' : '#ff7970'
    : ratingColorForScore(watch.score);
  bannerScore.textContent = `${Number(watch.score) * 10}%`;
  bannerScore.classList.toggle('banner-priority-rating', activeView === 'watchlist');
  $('#banner-score').dataset.priority = priority;
  if (activeView !== 'watchlist') bannerScore.append(createRatingMeter(scoreFill, scoreColor));
  bannerScore.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
  $('#banner-year').textContent = '';
  $('#banner-year').hidden = true;
  $('#banner-date').textContent = activeView === 'watchlist' ? '' : formatDate(watch.date);
  $('#banner-date').classList.toggle('banner-priority-date', activeView === 'watchlist');
  $('#banner-count').textContent = `${bannerIndex + 1} / ${recent.length}`;

  const hasPoster = Boolean(entry.poster);
  $('#banner-image').hidden = !hasPoster;
  $('#banner-placeholder').hidden = hasPoster;
  $('#banner-backdrop').hidden = !hasPoster;
  banner.classList.toggle('has-poster', hasPoster);

  if (hasPoster) {
    $('#banner-image').src = entry.poster;
    $('#banner-image').alt = `${entry.title} poster`;
    $('#banner-backdrop-image').src = entry.poster;
    updateBannerPalette(entry.poster, { updatePage: !location.hash.endsWith('/full') });
  } else {
    $('#banner-image').removeAttribute('src');
    $('#banner-backdrop-image').removeAttribute('src');
    resetBannerPalette({ updatePage: !location.hash.endsWith('/full') });
  }
}

/** Clears poster-derived banner colors and optionally the page palette. */
function resetBannerPalette({ updatePage = false } = {}) {
  const banner = $('#banner');
  delete banner.dataset.paletteSource;
  banner.style.removeProperty('--poster-color-one');
  banner.style.removeProperty('--poster-color-two');
  if (updatePage) resetPagePalette();
}

/** Clears the poster-derived colors from the page background. */
function resetPagePalette() {
  const root = document.documentElement;
  delete root.dataset.pagePaletteSource;
  root.style.removeProperty('--app-poster-color-one');
  root.style.removeProperty('--app-poster-color-two');
}

/** Extracts and applies colors from the banner poster. */
function updateBannerPalette(source, { updatePage = true } = {}) {
  const banner = $('#banner');
  banner.dataset.paletteSource = source;
  if (updatePage) document.documentElement.dataset.pagePaletteSource = source;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 16, 16);
      const pixels = context.getImageData(0, 0, 16, 16).data;
      const sample = (start, end) => {
        let red = 0; let green = 0; let blue = 0; let count = 0;
        for (let y = 0; y < 16; y += 1) {
          for (let x = start; x < end; x += 1) {
            const offset = (y * 16 + x) * 4;
            red += pixels[offset]; green += pixels[offset + 1]; blue += pixels[offset + 2]; count += 1;
          }
        }
        return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
      };
      if (banner.dataset.paletteSource !== source) return;
      const firstColor = sample(0, 8);
      const secondColor = sample(8, 16);
      banner.style.setProperty('--poster-color-one', firstColor);
      banner.style.setProperty('--poster-color-two', secondColor);
      if (updatePage && document.documentElement.dataset.pagePaletteSource === source) {
        document.documentElement.style.setProperty('--app-poster-color-one', firstColor);
        document.documentElement.style.setProperty('--app-poster-color-two', secondColor);
      }
    } catch (error) {
      if (banner.dataset.paletteSource === source) {
        banner.style.removeProperty('--poster-color-one');
        banner.style.removeProperty('--poster-color-two');
      }
      if (updatePage && document.documentElement.dataset.pagePaletteSource === source) resetPagePalette();
    }
  };
  image.onerror = () => {
    if (banner.dataset.paletteSource === source) {
      banner.style.removeProperty('--poster-color-one');
      banner.style.removeProperty('--poster-color-two');
    }
    if (updatePage && document.documentElement.dataset.pagePaletteSource === source) resetPagePalette();
  };
  image.src = source;
}

/** Returns the ordered entries eligible for banner rotation. */
function bannerEntries() {
  const isWatchlist = activeView === 'watchlist';
  const source = (isWatchlist ? watchlist : entries).filter((entry) =>
    matchesCollectionSearch(entry, $('#library-search')?.value.trim().toLocaleLowerCase() || '')
    && matchesCollectionFilters(entry, isWatchlist));
  return sortCollectionItems(source, isWatchlist).slice(0, 7);
}

/** Moves the banner to the previous or next eligible entry. */
async function slideBanner(direction) {
  const banner = $('#banner');
  if (bannerSliding || bannerEntries().length < 2 || banner.hidden) return;

  bannerSliding = true;
  const outgoing = banner.cloneNode(true);
  outgoing.classList.add('banner-slide-ghost');
  outgoing.removeAttribute('id');
  outgoing.querySelectorAll('[id]').forEach((part) => part.removeAttribute('id'));
  outgoing.setAttribute('aria-hidden', 'true');
  outgoing.inert = true;
  banner.append(outgoing);

  try {
    bannerIndex += direction;
    renderBanner();
    const travel = banner.clientWidth * Math.sign(direction);
    banner.style.setProperty('--banner-enter-offset', `${travel}px`);
    banner.style.setProperty('--banner-exit-offset', `${-travel}px`);
    banner.classList.add('is-sliding');

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 650);
      outgoing.addEventListener('animationend', (event) => {
        if (event.target !== outgoing) return;
        clearTimeout(timeout);
        resolve();
      });
    });
  } finally {
    banner.classList.remove('is-sliding');
    banner.style.removeProperty('--banner-enter-offset');
    banner.style.removeProperty('--banner-exit-offset');
    outgoing.remove();
    bannerSliding = false;
  }
}

$('#banner-image').addEventListener('error', () => {
  $('#banner-image').hidden = true;
  $('#banner-placeholder').hidden = false;
  $('#banner-backdrop').hidden = true;
  $('#banner').classList.remove('has-poster');
});
/** Renders the featured title banner and manages its palette and rotation. */
