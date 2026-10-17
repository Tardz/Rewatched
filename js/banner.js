/** Banner module. */
// The rotating spotlight banner.

const posterPaletteCache = new Map();
let currentPagePalette = null;
const bannerDateElement = $('#banner-date');

/** Keep the director chip available when entries omit a director. */
function ensureBannerDirector() {
  const existing = $('#banner-director');
  if (existing) return existing;
  const director = document.createElement('span');
  director.id = 'banner-director';
  return director;
}

/** Switches the overview details panel between its two information tabs. */
function selectOverviewDetailsTab(tabName) {
  const actorsTab = $('#banner-details-actors-tab');
  const plotTab = $('#banner-details-plot-tab');
  if (!actorsTab || !plotTab) return;

  const showActors = tabName === 'actors';
  actorsTab.classList.toggle('active', showActors);
  plotTab.classList.toggle('active', !showActors);
  actorsTab.setAttribute('aria-selected', String(showActors));
  plotTab.setAttribute('aria-selected', String(!showActors));
  $('#banner-details-actors-content').hidden = !showActors;
  $('#banner-details-plot-content').hidden = showActors;
}

/** Updates the actor and plot text for the currently featured entry. */
function renderOverviewBannerDetails(entry) {
  if (!$('#banner-details')) return;

  const actors = entry?.metadata?.actors?.split(',').map((name) => name.trim()).filter(Boolean) || [];
  const plot = entry?.metadata?.plot?.trim() || '';
  const actorList = $('#banner-details-actors-list');
  const actorItems = actors.map((name) => {
    const actor = document.createElement('div');
    actor.className = 'app-text level-3-styling';
    actor.setAttribute('role', 'listitem');
    actor.textContent = name;
    return actor;
  });
  if (!actorItems.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'app-text';
    emptyMessage.textContent = entry ? 'Cast details have not been saved for this title yet.' : 'No title selected.';
    actorItems.push(emptyMessage);
  }
  actorList.replaceChildren(...actorItems);
  $('#banner-details-plot-text').textContent = entry
    ? plot || 'Plot details have not been saved for this title yet.'
    : 'No title selected.';
}

$('#banner-details-actors-tab')?.addEventListener('click', () => selectOverviewDetailsTab('actors'));
$('#banner-details-plot-tab')?.addEventListener('click', () => selectOverviewDetailsTab('plot'));

/** Fits the featured title on one line, stopping at a readable minimum size. */
function fitReworkedBannerTitle() {
  const title = $('#banner-title');
  title.style.removeProperty('font-size');
  if (!title.clientWidth) return;

  const fitWidth = title.clientWidth - 4;
  const preferredSize = parseFloat(getComputedStyle(title).fontSize);
  if (title.scrollWidth <= fitWidth) return;

  const minimumSize = 38;
  title.style.fontSize = `${minimumSize}px`;
  if (title.scrollWidth > fitWidth) return;

  let fittingSize = minimumSize;
  let overflowingSize = preferredSize;
  for (let step = 0; step < 8; step += 1) {
    const nextSize = (fittingSize + overflowingSize) / 2;
    title.style.fontSize = `${nextSize}px`;
    if (title.scrollWidth <= fitWidth) fittingSize = nextSize;
    else overflowingSize = nextSize;
  }
  title.style.fontSize = `${Math.floor(fittingSize)}px`;
}

if (document.documentElement.dataset.cssReworkPreview === 'true') {
  const titleResizeObserver = new ResizeObserver(() => requestAnimationFrame(fitReworkedBannerTitle));
  titleResizeObserver.observe($('.overview-banner-content-layout'));
  document.fonts?.ready.then(() => requestAnimationFrame(fitReworkedBannerTitle));
}

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
  const isReworkPreview = document.documentElement.dataset.cssReworkPreview === 'true';
  banner.hidden = !isReworkPreview && !recent.length;
  if (!recent.length) {
    if (!isReworkPreview) return;
    const hasEntries = (activeCollectionView === 'watchlist' ? watchlist : entries).length > 0;
    renderOverviewBannerDetails(null);
    banner.classList.remove('is-logged', 'is-backlogged', 'has-poster');
    const director = ensureBannerDirector();
    director.textContent = '';
    director.hidden = true;
    $('#banner-label').replaceChildren(...(isReworkPreview ? [] : [director]));
    $('#banner-label').hidden = true;
    $('#banner-title').textContent = hasEntries ? 'No matching entries' : 'No entries yet';
    $('#banner-title').style.removeProperty('font-size');
    $('#banner-score').replaceChildren();
    $('#banner-score').removeAttribute('aria-label');
    $('#banner-score').parentElement.hidden = true;
    $('.overview-banner-controls-layout').hidden = true;
    $('#banner-image').hidden = true;
    $('#banner-image').removeAttribute('src');
    $('#banner-placeholder').textContent = hasEntries ? 'Adjust search or filters' : 'Add an entry to get started';
    $('#banner-placeholder').hidden = false;
    $('#banner-backdrop').hidden = !isReworkPreview;
    $('#banner-backdrop-image')?.removeAttribute('src');
    $('.overview-banner-container > .banner-poster .banner-type')?.remove();
    resetBannerPalette({ updatePage: !location.hash.endsWith('/full') });
    if (isReworkPreview) fitReworkedBannerTitle();
    return;
  }

  if (isReworkPreview) {
    $('#banner-label').hidden = false;
    $('#banner-score').parentElement.hidden = false;
    $('.overview-banner-controls-layout').hidden = false;
    $('#banner-placeholder').innerHTML = 'Add a poster<br>to see it here';
  }

  bannerIndex = (bannerIndex + recent.length) % recent.length;
  const entry = recent[bannerIndex];
  const isBacklogged = activeCollectionView === 'watchlist';
  if (isReworkPreview) renderOverviewBannerDetails(entry);
  banner.classList.toggle('is-logged', !isBacklogged);
  banner.classList.toggle('is-backlogged', isBacklogged);
  const watch = isBacklogged
    ? { score: Number(entry.priority || 3) * 2, date: '' }
    : latest(entry);

  const bannerLabel = $('#banner-label');
  const mediaType = entry.type.toLowerCase();
  const mediaIcon = document.createElement('span');
  mediaIcon.className = isReworkPreview
    ? `type-chip-styling media-type-icon banner-type is-${mediaType}`
    : `labelChip media-type-icon banner-content-info-label-type banner-media-type-icon is-${mediaType}`;
  mediaIcon.setAttribute('role', 'img');
  mediaIcon.setAttribute('aria-label', entry.type);
  mediaIcon.innerHTML = appIconMarkup(mediaTypeIconName(entry.type), 'icon app-icon banner-media-type-icon-image');
  if (isReworkPreview) {
    const poster = $('.overview-banner-container > .banner-poster');
    poster.querySelector('.banner-type')?.remove();
    poster.append(mediaIcon);
  }
  const labelContext = document.createElement('span');
  labelContext.className = isReworkPreview
    ? 'text-chip-styling banner-release-date-chip'
    : 'labelChip banner-content-info-label-release';
  const releaseText = isBacklogged
    ? `WATCHLIST${entry.year ? ` · ${entry.year}` : ''}`
    : entry.year || '';
  if (isReworkPreview && entry.year) {
    labelContext.innerHTML = appIconMarkup('release', 'icon app-icon banner-release-date-icon');
    const releaseLabel = document.createElement('span');
    releaseLabel.className = 'banner-release-date-label';
    releaseLabel.textContent = releaseText;
    labelContext.append(releaseLabel);
  } else {
    labelContext.textContent = releaseText;
  }
  const director = ensureBannerDirector();
  director.className = isReworkPreview
    ? 'app-text banner-director'
    : 'labelChip banner-content-info-label-director';
  director.textContent = entry.director
    ? isReworkPreview ? `By ${entry.director}` : entry.director
    : '';
  director.hidden = !entry.director;
  const labelParts = [];
  if (isReworkPreview) {
    const tag = document.createElement('span');
    tag.className = 'category-chip-styling banner-category-chip';
    if (entry.category && entry.category.toLowerCase() !== entry.type.toLowerCase()) {
      tag.textContent = entry.category;
      tag.style.setProperty('--category-hue', categoryHueForName(entry.category));
    } else {
      tag.classList.add('is-placeholder');
      tag.setAttribute('aria-hidden', 'true');
      tag.textContent = 'Genre';
    }
    labelParts.push(tag);
  } else {
    labelParts.push(mediaIcon);
  }
  if (labelContext.textContent) {
    labelParts.push(labelContext);
  }
  if (!isReworkPreview) labelParts.push(director);
  bannerLabel.replaceChildren(...labelParts);
  const bannerTitle = $('#banner-title');
  bannerTitle.textContent = entry.title;
  const bannerScore = $('#banner-score');
  const bannerDate = bannerDateElement;
  if (isReworkPreview) {
    bannerDate.className = 'text-chip-styling banner-log-date-chip';
    bannerDate.hidden = isBacklogged;
    bannerDate.innerHTML = appIconMarkup('watched', 'icon app-icon banner-log-date-icon');
    const dateLabel = document.createElement('span');
    dateLabel.className = 'banner-log-date-label';
    dateLabel.textContent = isBacklogged ? '' : formatDate(watch.date);
    bannerDate.append(dateLabel);
    bannerScore.replaceChildren();
    if (!bannerDate.hidden) bannerLabel.append(bannerDate);
  } else {
    bannerDate.textContent = isBacklogged ? '' : `Watched ${formatDate(watch.date)}`;
    bannerScore.replaceChildren();
  }
  const scoreFill = `${Number(watch.score) * 10}%`;
  const priority = Math.min(5, Math.max(1, Number(entry.priority) || 3));
  const scoreColor = isBacklogged
    ? priority <= 2 ? '#7edb9a' : priority === 3 ? '#8fc9ff' : '#ff7970'
    : ratingColorForScore(watch.score);
  $('#banner-score').dataset.priority = priority;
  if (isBacklogged) {
    bannerScore.style.setProperty('--priority-color', scoreColor);
    const priorityValue = document.createElement('span');
    priorityValue.className = isReworkPreview
      ? 'value-chip-styling priority-value-chip banner-priority-chip'
      : 'valueChip priorityValueChip priority-valueChip banner-content-info-meta-value-priorityChip';
    priorityValue.textContent = `P${priority}`;
    priorityValue.style.setProperty('--priority-color', scoreColor);
    const priorityDots = document.createElement('span');
    priorityDots.className = isReworkPreview
      ? 'priority-dots banner-priority-dots'
      : 'priorityDots banner-content-info-meta-value-priorityDots';
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
    ratingValue.className = isReworkPreview
      ? 'value-chip-styling rating-value-chip banner-ratings-chip'
      : 'valueChip ratingValueChip rating-valueChip banner-content-info-meta-value-ratingChip';
    ratingValue.textContent = `${Number(watch.score) * 10}%`;
    ratingValue.style.setProperty('--rating-color', scoreColor);
    bannerScore.append(
      ratingValue,
      createRatingMeter(
        scoreFill,
        scoreColor,
        isReworkPreview
          ? 'ratings-meter ratings-bar'
          : 'ratingsMeter banner-content-info-meta-value-ratingBar'
      )
    );
    bannerScore.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
  }
  $('#banner-count').textContent = `${bannerIndex + 1} / ${recent.length}`;

  const hasPoster = Boolean(entry.poster);
  $('#banner-image').hidden = !hasPoster;
  $('#banner-placeholder').hidden = hasPoster;
  $('#banner-backdrop').hidden = !isReworkPreview && !hasPoster;
  banner.classList.toggle('has-poster', hasPoster);

  if (hasPoster) {
    $('#banner-image').src = entry.poster;
    $('#banner-image').alt = `${entry.title} poster`;
    if (!isReworkPreview) $('#banner-backdrop-image').src = entry.poster;
    updateBannerPalette(entry.poster, {
      updatePage: !location.hash.endsWith('/full')
        && !$('.stats-page-button, .section-statistics')?.classList.contains('is-active'),
    });
  } else {
    $('#banner-image').removeAttribute('src');
    $('#banner-backdrop-image')?.removeAttribute('src');
    resetBannerPalette({ updatePage: !location.hash.endsWith('/full') });
  }
  if (isReworkPreview) fitReworkedBannerTitle();
}

/** Clears poster-derived banner colors and optionally the page palette. */
function resetBannerPalette({ updatePage = false } = {}) {
  const banner = $('#banner');
  delete banner.dataset.paletteSource;
  banner.style.removeProperty('--poster-color-one');
  banner.style.removeProperty('--poster-color-two');
  banner.style.removeProperty('--poster-wash-color-one');
  banner.style.removeProperty('--poster-wash-color-two');
  if (updatePage) resetPagePalette();
}

/** Clears the poster-derived colors from the page background. */
function resetPagePalette() {
  const root = document.documentElement;
  delete root.dataset.pagePaletteSource;
  root.style.removeProperty('--app-poster-color-one');
  root.style.removeProperty('--app-poster-color-two');
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
        canvas.height = 48;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 32, 48);
        const pixels = context.getImageData(0, 0, 32, 48).data;
        const sample = (start, end, brighten = false) => {
          const candidates = [];
          for (let y = 0; y < 48; y += 1) {
            for (let x = start; x < end; x += 1) {
              const offset = (y * 32 + x) * 4;
              const pixelRed = pixels[offset];
              const pixelGreen = pixels[offset + 1];
              const pixelBlue = pixels[offset + 2];
              const brightest = Math.max(pixelRed, pixelGreen, pixelBlue);
              const darkest = Math.min(pixelRed, pixelGreen, pixelBlue);
              const chroma = brightest - darkest;
              const brightness = pixelRed * 0.2126 + pixelGreen * 0.7152 + pixelBlue * 0.0722;
              if (pixels[offset + 3] < 32) continue;
              const bucket = [pixelRed, pixelGreen, pixelBlue]
                .map((value) => Math.floor(value / 24))
                .join(':');
              candidates.push({ pixelRed, pixelGreen, pixelBlue, chroma, brightness, bucket });
            }
          }

          if (!candidates.length) return [38, 49, 47];
          const visiblePixels = candidates.filter((pixel) => pixel.brightness >= 20 && pixel.brightness <= 245);
          const colorfulPixels = visiblePixels.filter((pixel) => pixel.chroma >= 24);
          const colorPixels = colorfulPixels.length >= candidates.length * 0.06
            ? colorfulPixels
            : visiblePixels.length ? visiblePixels : candidates;
          const buckets = new Map();
          colorPixels.forEach((pixel) => {
            const bucket = buckets.get(pixel.bucket) || { count: 0, chroma: 0, brightness: 0 };
            bucket.count += 1;
            bucket.chroma += pixel.chroma;
            bucket.brightness += pixel.brightness;
            buckets.set(pixel.bucket, bucket);
          });
          const dominantKeys = new Set([...buckets.entries()]
            .map(([key, bucket]) => ({
              key,
              score: bucket.count * (1 + (bucket.chroma / bucket.count / 255) * 0.35),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((bucket) => bucket.key));
          const selectedPixels = colorPixels.filter((pixel) => dominantKeys.has(pixel.bucket));
          const average = [0, 1, 2].map((channel) => {
            const key = ['pixelRed', 'pixelGreen', 'pixelBlue'][channel];
            return selectedPixels.reduce((sum, pixel) => sum + pixel[key], 0) / selectedPixels.length;
          });
          const averageChroma = selectedPixels.reduce((sum, pixel) => sum + pixel.chroma, 0)
            / selectedPixels.length;
          const luminance = average[0] * 0.2126 + average[1] * 0.7152 + average[2] * 0.0722;
          const saturationBoost = 1 + Math.max(0, Math.min(1, (100 - averageChroma) / 100)) * 0.28;
          const saturated = average.map((value) =>
            Math.max(0, Math.min(255, luminance + (value - luminance) * saturationBoost)));
          const saturatedLuminance = saturated[0] * 0.2126
            + saturated[1] * 0.7152 + saturated[2] * 0.0722;
          const lift = brighten ? Math.min(0.48, Math.max(0, (132 - saturatedLuminance) / 220)) : 0;
          return saturated.map((value) => Math.round(value + (255 - value) * lift));
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
  }

  getPosterPalette(source).then((palette) => {
    if (banner.dataset.paletteSource !== source) return;
    if (!palette) {
      banner.style.removeProperty('--poster-color-one');
      banner.style.removeProperty('--poster-color-two');
      banner.style.removeProperty('--poster-wash-color-one');
      banner.style.removeProperty('--poster-wash-color-two');
      banner.style.removeProperty('--poster-wash-color-one');
      banner.style.removeProperty('--poster-wash-color-two');
      if (updatePage && root.dataset.pagePaletteSource === source) {
        updateGlassOpacityForPagePalette(null);
        root.style.removeProperty('--app-poster-color-one');
        root.style.removeProperty('--app-poster-color-two');
      }
      return;
    }

    const colorString = (color) => `rgb(${color.join(', ')})`;
    banner.style.setProperty('--poster-color-one', colorString(palette.bannerOne));
    banner.style.setProperty('--poster-color-two', colorString(palette.bannerTwo));
    banner.style.setProperty('--poster-wash-color-one', colorString(palette.pageOne));
    banner.style.setProperty('--poster-wash-color-two', colorString(palette.pageTwo));
    if (updatePage && root.dataset.pagePaletteSource === source) {
      updateGlassOpacityForPagePalette(palette);
      root.style.setProperty('--app-poster-color-one', colorString(palette.pageOne));
      root.style.setProperty('--app-poster-color-two', colorString(palette.pageTwo));
    }
  });
}

/** Returns the ordered entries eligible for banner rotation. */
function bannerEntries() {
  const isBacklogged = activeCollectionView === 'watchlist';
  const source = (isBacklogged ? watchlist : entries).filter((entry) =>
    matchesCollectionSearch(entry, $('#library-search')?.value.trim().toLocaleLowerCase() || '')
    && matchesCollectionFilters(entry, isBacklogged));
  const sorted = sortCollectionItems(source, isBacklogged);
  if (document.documentElement.dataset.cssReworkPreview !== 'true') return sorted.slice(0, 7);

  const pageSize = getCollectionColumnCount() * collectionRowsPerPage;
  return sorted.slice(collectionPage * pageSize, (collectionPage + 1) * pageSize);
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
  $('#banner-backdrop').hidden = document.documentElement.dataset.cssReworkPreview !== 'true';
  $('#banner').classList.remove('has-poster');
});
/** Renders the featured title banner and manages its palette and rotation. */
