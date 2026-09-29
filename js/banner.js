/** Banner module. */
// The rotating spotlight banner.

const posterPaletteCache = new Map();

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
    updateBannerPalette(entry.poster, {
      updatePage: !location.hash.endsWith('/full')
        && !$('.section-statistics')?.classList.contains('is-active'),
    });
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

/** Returns cached left/right poster colors for the banner and app background. */
function getPosterPalette(source) {
  if (posterPaletteCache.has(source)) return posterPaletteCache.get(source);

  const palettePromise = new Promise((resolve) => {
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
        const sample = (start, end, favorColor = false) => {
          let red = 0; let green = 0; let blue = 0; let totalWeight = 0;
          const candidates = [];
          for (let y = 0; y < 16; y += 1) {
            for (let x = start; x < end; x += 1) {
              const offset = (y * 16 + x) * 4;
              const pixelRed = pixels[offset];
              const pixelGreen = pixels[offset + 1];
              const pixelBlue = pixels[offset + 2];
              const brightest = Math.max(pixelRed, pixelGreen, pixelBlue);
              const darkest = Math.min(pixelRed, pixelGreen, pixelBlue);
              const chroma = brightest - darkest;
              const brightness = pixelRed * 0.2126 + pixelGreen * 0.7152 + pixelBlue * 0.0722;

              if (favorColor) {
                // Ignore most near-black pixels so a dark background cannot drown out poster accents.
                const colorScore = chroma * (0.4 + brightness / 255)
                  + Math.max(0, brightness - 35) * 0.08;
                candidates.push({ pixelRed, pixelGreen, pixelBlue, chroma, colorScore });
                continue;
              }

              red += pixelRed;
              green += pixelGreen;
              blue += pixelBlue;
              totalWeight += 1;
            }
          }

          if (favorColor) {
            const strongestColor = Math.max(...candidates.map((pixel) => pixel.colorScore));
            const accents = candidates.filter((pixel) =>
              pixel.chroma >= 18 && pixel.colorScore >= strongestColor * 0.42);
            const selectedPixels = accents.length ? accents : candidates;

            selectedPixels.forEach((pixel) => {
              const weight = 0.2 + (pixel.colorScore / Math.max(1, strongestColor)) ** 1.5;
              red += pixel.pixelRed * weight;
              green += pixel.pixelGreen * weight;
              blue += pixel.pixelBlue * weight;
              totalWeight += weight;
            });

            const average = [red, green, blue].map((value) => value / totalWeight);
            const luminance = average[0] * 0.2126 + average[1] * 0.7152 + average[2] * 0.0722;
            const saturated = average.map((value) =>
              Math.max(0, Math.min(255, luminance + (value - luminance) * 1.4)));
            const saturatedLuminance = saturated[0] * 0.2126
              + saturated[1] * 0.7152 + saturated[2] * 0.0722;
            const lift = Math.min(0.3, Math.max(0, (108 - saturatedLuminance) / 320));
            return saturated.map((value) => Math.round(value + (255 - value) * lift));
          }

          return [red, green, blue].map((value) => Math.round(value / totalWeight));
        };

        resolve({
          bannerOne: sample(0, 8),
          bannerTwo: sample(8, 16),
          pageOne: sample(0, 8, true),
          pageTwo: sample(8, 16, true),
        });
      } catch (error) {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });

  if (posterPaletteCache.size >= 128) {
    posterPaletteCache.delete(posterPaletteCache.keys().next().value);
  }
  posterPaletteCache.set(source, palettePromise);
  return palettePromise;
}

/** Extracts and applies colors from the banner poster. */
function updateBannerPalette(source, { updatePage = true } = {}) {
  const banner = $('#banner');
  const root = document.documentElement;
  banner.dataset.paletteSource = source;
  if (updatePage) root.dataset.pagePaletteSource = source;

  getPosterPalette(source).then((palette) => {
    if (banner.dataset.paletteSource !== source) return;
    if (!palette) {
      banner.style.removeProperty('--poster-color-one');
      banner.style.removeProperty('--poster-color-two');
      if (updatePage && root.dataset.pagePaletteSource === source) resetPagePalette();
      return;
    }

    const colorString = (color) => `rgb(${color.join(', ')})`;
    banner.style.setProperty('--poster-color-one', colorString(palette.bannerOne));
    banner.style.setProperty('--poster-color-two', colorString(palette.bannerTwo));
    if (updatePage && root.dataset.pagePaletteSource === source) {
      root.style.setProperty('--app-poster-color-one', colorString(palette.pageOne));
      root.style.setProperty('--app-poster-color-two', colorString(palette.pageTwo));
    }
  });
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
