/** Banner module. */
// The rotating spotlight banner.

const posterPaletteCache = new Map();
let currentPagePalette = null;

/** Tones down very bright poster gradients and preserves panel contrast. */
function updateGlassOpacityForPagePalette(palette = currentPagePalette) {
  currentPagePalette = palette;
  const averageColor = palette?.pageOne.map((value, index) =>
    (value + palette.pageTwo[index]) / 2);
  const brightness = averageColor
    ? averageColor[0] * 0.2126 + averageColor[1] * 0.7152 + averageColor[2] * 0.0722
    : 0;
  const requestedStrength = posterBackgroundEnabled ? posterBackgroundStrength : 0;
  const brightColorDamping = averageColor
    ? Math.min(0.35, Math.max(0, (brightness - 145) / 200))
    : 0;
  const strength = Math.round(requestedStrength * (1 - brightColorDamping));
  document.documentElement.style.setProperty('--poster-background-strength', `${strength}%`);
  const boost = Math.min(12, Math.max(0, Math.round((brightness - 130) * strength / 350)));
  document.documentElement.style.setProperty('--glass-brightness-boost', `${boost}%`);
}

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

  const bannerLabel = $('#banner-label');
  const mediaIcon = document.createElement('span');
  mediaIcon.className = `banner-media-type-icon is-${entry.type.toLowerCase()}`;
  mediaIcon.setAttribute('role', 'img');
  mediaIcon.setAttribute('aria-label', entry.type);
  mediaIcon.innerHTML = appIconMarkup(entry.type.toLowerCase() === 'movie' ? 'movie' : 'show', 'app-icon banner-media-type-icon-image');
  const labelContext = document.createElement('span');
  labelContext.className = 'banner-label-context';
  labelContext.textContent = activeView === 'watchlist'
    ? `WATCHLIST${entry.year ? ` · ${entry.year}` : ''}`
    : entry.year || '';
  const director = $('#banner-director');
  director.textContent = entry.director || '';
  director.hidden = !entry.director;
  const labelParts = [mediaIcon];
  if (labelContext.textContent) {
    const mediaSeparator = document.createElement('span');
    mediaSeparator.className = 'banner-label-separator';
    mediaSeparator.setAttribute('aria-hidden', 'true');
    mediaSeparator.textContent = '·';
    labelParts.push(mediaSeparator, labelContext);
  }
  if (entry.director) {
    const separator = document.createElement('span');
    separator.className = 'banner-label-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = '·';
    labelParts.push(separator, director);
  }
  bannerLabel.replaceChildren(...labelParts);
  const bannerTitle = $('#banner-title');
  bannerTitle.textContent = entry.title;
  const bannerScore = $('#banner-score');
  const scoreFill = `${Number(watch.score) * 10}%`;
  const priority = Math.min(5, Math.max(1, Number(entry.priority) || 3));
  const scoreColor = activeView === 'watchlist'
    ? priority <= 2 ? '#7edb9a' : priority === 3 ? '#8fc9ff' : '#ff7970'
    : ratingColorForScore(watch.score);
  bannerScore.replaceChildren();
  bannerScore.classList.toggle('banner-priority-rating', activeView === 'watchlist');
  $('#banner-score').dataset.priority = priority;
  if (activeView === 'watchlist') {
    bannerScore.style.setProperty('--priority-color', scoreColor);
    const priorityValue = document.createElement('span');
    priorityValue.className = 'priority-value-chip';
    priorityValue.textContent = `P${priority}`;
    priorityValue.style.setProperty('--priority-color', scoreColor);
    const priorityDots = document.createElement('span');
    priorityDots.className = 'banner-priority-dots';
    priorityDots.setAttribute('aria-hidden', 'true');
    for (let dot = 1; dot <= 5; dot++) {
      const marker = document.createElement('span');
      marker.classList.toggle('is-filled', dot <= priority);
      priorityDots.append(marker);
    }
    bannerScore.append(priorityValue, priorityDots);
    bannerScore.setAttribute('aria-label', `Priority ${priority} out of 5`);
  } else {
    bannerScore.style.removeProperty('--priority-color');
    const ratingValue = document.createElement('span');
    ratingValue.className = 'rating-value-chip';
    ratingValue.textContent = `${Number(watch.score) * 10}%`;
    ratingValue.style.setProperty('--rating-color', scoreColor);
    bannerScore.append(ratingValue, createRatingMeter(scoreFill, scoreColor));
    bannerScore.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
  }
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
  delete root.dataset.pagePaletteFallback;
  root.style.removeProperty('--app-poster-color-one');
  root.style.removeProperty('--app-poster-color-two');
  root.style.removeProperty('--app-poster-image');
  updateGlassOpacityForPagePalette(null);
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
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        const sample = (start, end, favorColor = false) => {
          let red = 0; let green = 0; let blue = 0; let totalWeight = 0;
          const candidates = [];
          for (let y = 0; y < 32; y += 1) {
            for (let x = start; x < end; x += 1) {
              const offset = (y * 32 + x) * 4;
              const pixelRed = pixels[offset];
              const pixelGreen = pixels[offset + 1];
              const pixelBlue = pixels[offset + 2];
              const brightest = Math.max(pixelRed, pixelGreen, pixelBlue);
              const darkest = Math.min(pixelRed, pixelGreen, pixelBlue);
              const chroma = brightest - darkest;
              const brightness = pixelRed * 0.2126 + pixelGreen * 0.7152 + pixelBlue * 0.0722;

              if (favorColor) {
                const bucket = [pixelRed, pixelGreen, pixelBlue]
                  .map((value) => Math.floor(value / 32))
                  .join(':');
                candidates.push({ pixelRed, pixelGreen, pixelBlue, chroma, brightness, bucket });
                continue;
              }

              red += pixelRed;
              green += pixelGreen;
              blue += pixelBlue;
              totalWeight += 1;
            }
          }

          if (favorColor) {
            // Pick the most common visible color groups; only slightly favor brighter, richer bins.
            const buckets = new Map();
            candidates.forEach((pixel) => {
              if (pixel.brightness < 24) return;
              const bucket = buckets.get(pixel.bucket) || { count: 0, chroma: 0, brightness: 0 };
              bucket.count += 1;
              bucket.chroma += pixel.chroma;
              bucket.brightness += pixel.brightness;
              buckets.set(pixel.bucket, bucket);
            });
            const dominantBuckets = [...buckets.entries()]
              .map(([key, bucket]) => ({
                key,
                score: bucket.count * (
                  1 + (bucket.chroma / bucket.count / 255) * 0.12
                    + (bucket.brightness / bucket.count / 255) * 0.1
                ),
              }))
              .sort((a, b) => b.score - a.score)
              .slice(0, 3);
            const dominantKeys = new Set(dominantBuckets.map((bucket) => bucket.key));
            const selectedPixels = candidates.filter((pixel) => dominantKeys.has(pixel.bucket));
            const colorPixels = selectedPixels.length ? selectedPixels : candidates;

            colorPixels.forEach((pixel) => {
              red += pixel.pixelRed;
              green += pixel.pixelGreen;
              blue += pixel.pixelBlue;
              totalWeight += 1;
            });

            const average = [red, green, blue].map((value) => value / totalWeight);
            const luminance = average[0] * 0.2126 + average[1] * 0.7152 + average[2] * 0.0722;
            const averageChroma = colorPixels.reduce((sum, pixel) => sum + pixel.chroma, 0)
              / colorPixels.length;
            const mutedness = Math.max(0, Math.min(1, (90 - averageChroma) / 90));
            const saturationBoost = 1 + mutedness * 0.2;
            const saturated = average.map((value) =>
              Math.max(0, Math.min(255, luminance + (value - luminance) * saturationBoost)));
            const saturatedLuminance = saturated[0] * 0.2126
              + saturated[1] * 0.7152 + saturated[2] * 0.0722;
            const lift = Math.min(0.48, Math.max(0, (132 - saturatedLuminance) / 220));
            return saturated.map((value) => Math.round(value + (255 - value) * lift));
          }

          return [red, green, blue].map((value) => Math.round(value / totalWeight));
        };

        resolve({
          bannerOne: sample(0, 16),
          bannerTwo: sample(16, 32),
          pageOne: sample(0, 16, true),
          pageTwo: sample(16, 32, true),
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
  palettePromise.then((palette) => {
    if (!palette && posterPaletteCache.get(source) === palettePromise) {
      posterPaletteCache.delete(source);
    }
  });
  return palettePromise;
}

/** Extracts and applies colors from the banner poster. */
function updateBannerPalette(source, { updatePage = true } = {}) {
  const banner = $('#banner');
  const root = document.documentElement;
  banner.dataset.paletteSource = source;
  if (updatePage) {
    root.dataset.pagePaletteSource = source;
    delete root.dataset.pagePaletteFallback;
    root.style.setProperty('--app-poster-image', `url(${JSON.stringify(source)})`);
  }

  getPosterPalette(source).then((palette) => {
    if (banner.dataset.paletteSource !== source) return;
    if (!palette) {
      banner.style.removeProperty('--poster-color-one');
      banner.style.removeProperty('--poster-color-two');
      if (updatePage && root.dataset.pagePaletteSource === source) {
        updateGlassOpacityForPagePalette(null);
        root.dataset.pagePaletteFallback = 'image';
        root.style.removeProperty('--app-poster-color-one');
        root.style.removeProperty('--app-poster-color-two');
      }
      return;
    }

    const colorString = (color) => `rgb(${color.join(', ')})`;
    banner.style.setProperty('--poster-color-one', colorString(palette.bannerOne));
    banner.style.setProperty('--poster-color-two', colorString(palette.bannerTwo));
    if (updatePage && root.dataset.pagePaletteSource === source) {
      updateGlassOpacityForPagePalette(palette);
      delete root.dataset.pagePaletteFallback;
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
