/** App module. */
// Top-level navigation, filters, banner controls, and startup.

const LIBRARY_SCROLL_KEY = 'rerun-library-scroll-position';
let libraryScrollPosition = Number(sessionStorage.getItem(LIBRARY_SCROLL_KEY)) || 0;

const themeToggle = $('#toggle-theme');
const navThemeToggle = $('.nav-toggle-theme');
$('#open-settings')?.addEventListener('click', openSettings);
$('#open-storage-settings')?.addEventListener('click', openSettings);
const collectionFiltersReturnAnchor = $('.collection-filter-sort').nextElementSibling;

/** Updates the sidebar's expanded or icon-only state. */
function setSidebarCollapsed(collapsed) {
  const appContainer = $('.app-container');
  const sidebarToggle = $('.nav-toggle-sidebar');
  appContainer.classList.toggle('is-sidebar-collapsed', collapsed);
  sidebarToggle.setAttribute('aria-pressed', String(collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
}

if ($('.navbar-vertical-layout')) {
  const compactSidebarQuery = window.matchMedia('(max-width: 700px)');
  setSidebarCollapsed(compactSidebarQuery.matches);
  $('.nav-toggle-sidebar').addEventListener('click', () => {
    setSidebarCollapsed(!$('.app-container').classList.contains('is-sidebar-collapsed'));
  });
  compactSidebarQuery.addEventListener('change', (event) => setSidebarCollapsed(event.matches));
}

/** Switches between the library and its statistics panel. */
function setDashboardSection(section) {
  const showStatistics = section === 'statistics';
  const dashboard = document.querySelector('.default-layout, .dashboard-layout');
  const collectionFilters = $('.collection-filter-sort');
  const libraryButton = $('.library-page-button, .section-library');
  const statisticsButton = $('.stats-page-button, .section-statistics');

  $('#library').hidden = showStatistics;
  $('#statistics-panel').hidden = !showStatistics;
  if (showStatistics) {
    $('#statistics-panel').prepend(collectionFilters);
    updateCollectionTools(activeCollectionView === 'watchlist');
  } else {
    // Return the filters to their original position in either page layout.
    collectionFiltersReturnAnchor.before(collectionFilters);
    updateCollectionTools(activeCollectionView === 'watchlist');
  }
  dashboard.classList.toggle('is-statistics-view', showStatistics);
  document.documentElement.dataset.dashboardSection = showStatistics ? 'statistics' : 'library';

  libraryButton.classList.toggle('is-active', !showStatistics);
  statisticsButton.classList.toggle('is-active', showStatistics);
  libraryButton.toggleAttribute('aria-current', !showStatistics);
  statisticsButton.toggleAttribute('aria-current', showStatistics);

  if (showStatistics) {
    clearTimeout(bannerTimer);
    statisticsRequestedPaletteSource = '';
    resetPagePalette();
    renderStatisticsPanel();
  } else {
    renderBanner();
    resetBannerTimer();
  }
}

$('.library-page-button, .section-library').addEventListener('click', () => {
  setDashboardSection('library');
  setNavbarPage($('#nav-library-button'));
});
$('.stats-page-button, .section-statistics').addEventListener('click', () => {
  setDashboardSection('statistics');
  setNavbarPage($('#nav-stats-button'));
});

let navbarPageBeforeSettings = null;
// Keep the non-modal settings dialog outside the clipped app shell so it can overlay the blur.
document.body.append($('#settings-dialog'));
function closeSettingsHeadingHelp() {
  document.querySelectorAll('#settings-dialog .settings-heading-info[aria-controls]').forEach((button) => {
    document.getElementById(button.getAttribute('aria-controls')).hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });
}
$('#settings-dialog')?.addEventListener('click', (event) => {
  const button = event.target.closest('.settings-heading-info[aria-controls]');
  if (button) {
    const help = document.getElementById(button.getAttribute('aria-controls'));
    const shouldOpen = help.hidden;
    closeSettingsHeadingHelp();
    help.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', String(shouldOpen));
  } else if (!event.target.closest('.settings-heading-help')) {
    closeSettingsHeadingHelp();
  }
});
// A click dismisses an option's hover help until the pointer leaves that row.
document.querySelectorAll('#settings-dialog .settings-option').forEach((option) => {
  option.addEventListener('pointerdown', () => option.classList.add('tooltip-dismissed'));
  option.addEventListener('pointerleave', () => option.classList.remove('tooltip-dismissed'));
});
const navbarUrlHistory = [location.hash];
let navbarUrlHistoryIndex = 0;
let navbarHistoryTraversalDirection = 0;

/** Show Back and Forward only when a URL/hash page exists in that direction. */
function updateNavbarHistoryControls() {
  const backButton = $('.nav-prev-button');
  const forwardButton = $('.nav-next-button');
  backButton.hidden = navbarUrlHistoryIndex <= 0;
  forwardButton.hidden = navbarUrlHistoryIndex >= navbarUrlHistory.length - 1;
  $('.nav-pagination-container').classList.toggle('is-history-empty', backButton.hidden && forwardButton.hidden);
}

/** Track actual URL/hash navigation, not navbar tab selection, for arrow history. */
function recordNavbarUrlHistory(event) {
  const nextHash = new URL(event.newURL).hash;
  const previousHash = new URL(event.oldURL).hash;

  if (navbarHistoryTraversalDirection) {
    navbarUrlHistoryIndex = Math.max(0, Math.min(
      navbarUrlHistory.length - 1,
      navbarUrlHistoryIndex + navbarHistoryTraversalDirection,
    ));
    navbarHistoryTraversalDirection = 0;
  } else if (navbarUrlHistory[navbarUrlHistoryIndex - 1] === nextHash) {
    navbarUrlHistoryIndex -= 1;
  } else if (navbarUrlHistory[navbarUrlHistoryIndex + 1] === nextHash) {
    navbarUrlHistoryIndex += 1;
  } else if (nextHash !== previousHash) {
    navbarUrlHistory.splice(navbarUrlHistoryIndex + 1);
    navbarUrlHistory.push(nextHash);
    navbarUrlHistoryIndex = navbarUrlHistory.length - 1;
  }

  updateNavbarHistoryControls();
}

window.addEventListener('hashchange', recordNavbarUrlHistory);
updateNavbarHistoryControls();

/** Keeps the top-level navbar selection in sync with the current page. */
function setNavbarPage(activeButton) {
  if (!activeButton) return;

  document.querySelectorAll('.navbar-vertical-layout .nav-button').forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.toggleAttribute('aria-current', active);
  });

  const pageName = $('.nav-page-name');
  const activeLabel = activeButton.querySelector('.nav-button-text');
  if (pageName && activeLabel) {
    pageName.textContent = activeLabel.textContent.trim();
    pageName.style.setProperty('--nav-page-name-color', getComputedStyle(activeButton).getPropertyValue('--nav-item-color').trim());
  }
}

setNavbarPage($('#nav-home-button'));
$('.nav-prev-button')?.addEventListener('click', () => {
  if (navbarUrlHistoryIndex <= 0) return;
  navbarHistoryTraversalDirection = -1;
  window.history.back();
});
$('.nav-next-button')?.addEventListener('click', () => {
  if (navbarUrlHistoryIndex >= navbarUrlHistory.length - 1) return;
  navbarHistoryTraversalDirection = 1;
  window.history.forward();
});

$('#nav-settings-button')?.addEventListener('click', () => {
  const dialog = $('#settings-dialog');
  if (dialog.open) {
    dialog.close();
    return;
  }
  navbarPageBeforeSettings = $('.navbar-vertical-layout .nav-button.is-active') || $('#nav-home-button');
  setNavbarPage($('#nav-settings-button'));
  openSettings();
});

function openStorageSettingsFromNavigation() {
  const dialog = $('#settings-dialog');
  if (!dialog.open) {
    navbarPageBeforeSettings = $('.navbar-vertical-layout .nav-button.is-active') || $('#nav-home-button');
    setNavbarPage($('#nav-settings-button'));
  }
  setSettingsCategory('storage');
  openSettings();
}

$('#nav-storage-button')?.addEventListener('click', openStorageSettingsFromNavigation);
$('#nav-save-button')?.addEventListener('click', openStorageSettingsFromNavigation);

$('#settings-dialog').addEventListener('close', () => {
  closeSettingsHeadingHelp();
  pauseLoadStatusTimer();
  if (navbarPageBeforeSettings) setNavbarPage(navbarPageBeforeSettings);
  navbarPageBeforeSettings = null;
});

$('.app-content-frame')?.addEventListener('click', () => {
  const dialog = $('#settings-dialog');
  if (dialog?.open) dialog.close();
});

/** Activates one settings category and its corresponding content panel. */
function setSettingsCategory(category) {
  document.querySelectorAll('.settings-category-button').forEach((button) => {
    const active = button.dataset.settingsCategory === category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== category;
  });
  if (category === 'storage') startLoadStatusTimer();
  else pauseLoadStatusTimer();
}

document.querySelectorAll('.settings-category-button').forEach((button, index, buttons) => {
  button.addEventListener('click', () => setSettingsCategory(button.dataset.settingsCategory));
  button.addEventListener('keydown', (event) => {
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1
        : event.key === 'Home' ? -index
          : event.key === 'End' ? buttons.length - index - 1
            : 0;
    if (!direction) return;
    event.preventDefault();
    const nextIndex = (index + direction + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
    setSettingsCategory(buttons[nextIndex].dataset.settingsCategory);
  });
});

/** Keep the tab-list orientation in sync with its responsive layout. */
function updateSettingsCategoryOrientation() {
  const categoryNavigation = $('.settings-category-container');
  if (!categoryNavigation) return;
  categoryNavigation.setAttribute('aria-orientation', window.matchMedia('(max-width: 700px)').matches ? 'horizontal' : 'vertical');
}
updateSettingsCategoryOrientation();

$('#nav-home-button')?.addEventListener('click', () => {
  if (document.documentElement.dataset.dashboardSection === 'statistics') {
    setDashboardSection('library');
  }
  setNavbarPage($('#nav-home-button'));
  $('.app-content-container').scrollTo({ top: 0, behavior: 'smooth' });
});

$('#nav-library-button')?.addEventListener('click', () => {
  setDashboardSection('library');
  setNavbarPage($('#nav-library-button'));
  $('#library').scrollIntoView({ block: 'start', behavior: 'smooth' });
});

$('#nav-folders-button')?.addEventListener('click', () => {
  setDashboardSection('library');
  setNavbarPage($('#nav-library-button'));
  $('#library-folder-button')?.click();
});

$('#nav-stats-button')?.addEventListener('click', () => {
  setDashboardSection('statistics');
  setNavbarPage($('#nav-stats-button'));
  $('#statistics-panel').scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// Retain focus rings for keyboard use, but avoid persistent rings after pointer clicks.
document.addEventListener('pointerdown', () => {
  document.documentElement.dataset.inputModality = 'pointer';
});
document.addEventListener('keydown', (event) => {
  if (['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    && !event.metaKey && !event.ctrlKey && !event.altKey) {
    document.documentElement.dataset.inputModality = 'keyboard';
  }
});

/** Updates the theme toggle to reflect the active theme. */
function syncThemeToggle() {
  const isLight = document.documentElement.dataset.theme === 'light';
  const switchTo = isLight ? 'dark' : 'light';
  const label = `Switch to ${switchTo} mode`;
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  themeToggle.innerHTML = appIconMarkup(switchTo === 'dark' ? 'dark_mode' : 'light_mode');
  if (navThemeToggle) {
    navThemeToggle.setAttribute('aria-pressed', String(isLight));
    navThemeToggle.setAttribute('aria-label', label);
    navThemeToggle.title = label;
    navThemeToggle.innerHTML = appIconMarkup(switchTo === 'dark' ? 'dark_mode' : 'light_mode');
  }
  refreshAppIcons();
}

syncThemeToggle();
function toggleAppTheme() {
  themePreference = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, themePreference);
  applyTheme();
  syncThemeToggle();
  syncAppearanceControls();
}
themeToggle.addEventListener('click', toggleAppTheme);
navThemeToggle?.addEventListener('click', toggleAppTheme);
systemTheme.addEventListener?.('change', syncThemeToggle);
if (!systemTheme.addEventListener) systemTheme.addListener(syncThemeToggle);

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/** Returns whether a URL hash points to an entry view. */
function isEntryHash(hash) {
  return hash.startsWith('#entry/');
}

/** Returns whether a URL hash points to a fullscreen entry page. */
function isFullscreenEntryHash(hash) {
  return isEntryHash(hash) && hash.endsWith('/full');
}

/** Stores the current collection scroll position for navigation. */
function rememberLibraryScrollPosition() {
  libraryScrollPosition = window.scrollY;
  sessionStorage.setItem(LIBRARY_SCROLL_KEY, String(libraryScrollPosition));
}

/** Restores the saved collection scroll position. */
function restoreLibraryScrollPosition() {
  requestAnimationFrame(() => {
    window.scrollTo(0, libraryScrollPosition);
  });
}

// Banner controls

$('#previous').addEventListener('click', (event) => {
  event.stopPropagation();
  slideBanner(-1);
});

$('#next').addEventListener('click', (event) => {
  event.stopPropagation();
  slideBanner(1);
});

/** Opens the entry currently featured in the banner. */
function openBannerEntry() {
  if ($('.stats-page-button, .section-statistics').classList.contains('is-active')) return;
  const entry = bannerEntries()[bannerIndex];
  if (entry) location.hash = `#entry/${activeCollectionView}/${encodeURIComponent(entry.id)}`;
}

$('#banner').addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  openBannerEntry();
});

$('#banner').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target.closest('button')) return;
  event.preventDefault();
  openBannerEntry();
});

$('#banner').addEventListener('wheel', (event) => {
  if ($('.stats-page-button, .section-statistics').classList.contains('is-active')
    || event.target.closest('#statistics-timeline')) return;
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || bannerEntries().length < 2) return;
  event.preventDefault();

  if (Date.now() - lastSwipeAt < 550 || bannerSliding) return;
  swipeDistance += event.deltaX;
  if (Math.abs(swipeDistance) < 55) return;

  const direction = Math.sign(swipeDistance);
  swipeDistance = 0;
  lastSwipeAt = Date.now();
  slideBanner(direction);
}, { passive: false });

/** Synchronizes banner rotation controls with the current setting. */
function syncRotationControls() {
  const button = $('#pause');
  if (button) {
    button.dataset.rotationState = paused ? 'paused' : 'playing';
    const pauseIcon = button.querySelector('.pause-icon');
    const playIcon = button.querySelector('.play-icon');
    if (pauseIcon) {
      pauseIcon.hidden = paused;
      pauseIcon.style.display = paused ? 'none' : '';
    }
    if (playIcon) {
      playIcon.hidden = !paused;
      playIcon.style.display = paused ? '' : 'none';
    }
    button.setAttribute('aria-label', paused ? 'Resume rotation' : 'Pause rotation');
    button.title = paused ? 'Resume rotation' : 'Pause rotation';
  }
  const autoRotate = $('#auto-rotate');
  if (autoRotate) autoRotate.checked = !paused;
}

/** Enables or disables automatic banner rotation. */
function setRotation(enabled) {
  paused = !enabled;
  localStorage.setItem(ROTATION_KEY, String(enabled));
  syncRotationControls();
}

$('#pause').addEventListener('click', () => setRotation(paused));

/** Opens the settings dialog. */
function openSettings() {
  const dialog = $('#settings-dialog');
  if (!dialog) return;
  centerSettingsDialog(dialog);
  if (!dialog.open) dialog.show();
  startLoadStatusTimer();

  try {
    syncRotationControls();
    syncAppearanceControls();
    updateBackupSummary();
    updateOmdbCallCount();
    $('#omdb-api-key').value = localStorage.getItem(OMDB_API_KEY) || '';
  } catch (error) {
    console.error('Settings opened, but some values could not be refreshed.', error);
  }
}

/** Centers the settings dialog over the visible app-content frame. */
function centerSettingsDialog(dialog) {
  const frame = $('.app-content-frame');
  if (!frame) return;
  const bounds = frame.getBoundingClientRect();
  dialog.style.setProperty('--settings-anchor-x', `${bounds.left + bounds.width / 2}px`);
  dialog.style.setProperty('--settings-anchor-y', `${bounds.top + bounds.height / 2}px`);
}

window.addEventListener('resize', () => {
  updateSettingsCategoryOrientation();
  const dialog = $('#settings-dialog');
  if (dialog?.open) centerSettingsDialog(dialog);
});

/** Keep custom slider tracks filled to each control's current value. */
function syncSettingsRangeTrack(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const progress = max === min ? 0 : (Number(input.value) - min) / (max - min) * 100;
  input.style.setProperty('--settings-range-progress', `${Math.max(0, Math.min(100, progress))}%`);
}
document.querySelectorAll('.settings-option-range input[type="range"]').forEach((input) => {
  input.addEventListener('input', () => syncSettingsRangeTrack(input));
});

/** Synchronizes appearance options with the settings dialog controls. */
function syncAppearanceControls() {
  $('#theme-mode').value = themePreference;
  $('#reduce-animations').checked = reduceAnimationsEnabled;
  const iconStyleControl = $('#icon-style');
  if (iconStyleControl) iconStyleControl.value = iconStylePreference;
  $('#poster-background').checked = posterBackgroundEnabled;
  $('#entry-poster-backdrop').checked = entryPosterBackdropEnabled;
  $('#poster-background-strength').value = posterBackgroundStrength;
  $('#poster-background-strength-value').value = `${posterBackgroundStrength}%`;
  $('#poster-background-strength').disabled = !posterBackgroundEnabled;
  $('#tactile-dashboard').checked = tactileDashboardEnabled;
  const dashboardModeControl = $('#dashboard-mode');
  if (dashboardModeControl) dashboardModeControl.value = dashboardMode;
  $('#macos-box-borders').checked = macosBoxBordersEnabled;
  $('#colored-value-chips').checked = coloredValueChipsEnabled;
  $('#hide-main-value-chips').checked = hideMainValueChipsEnabled;
  $('#corner-radius-scale').value = cornerRadiusScale;
  $('#corner-radius-scale-value').value = `${cornerRadiusScale}%`;
  $('#glass-surface-opacity').value = glassSurfaceOpacity;
  $('#glass-surface-opacity-value').value = `${glassSurfaceOpacity}%`;
  $('#disable-glass-transparency').checked = !glassTransparencyEnabled;
  $('#glass-surface-opacity').disabled = !tactileDashboardEnabled || !glassTransparencyEnabled;
  document.querySelectorAll('.settings-option-range input[type="range"]').forEach(syncSettingsRangeTrack);
}
$('#auto-rotate').addEventListener('change', (event) => setRotation(event.currentTarget.checked));
function changeThemePreference(value) {
  themePreference = value;
  localStorage.setItem(THEME_KEY, themePreference);
  applyTheme();
  syncAppearanceControls();
}
$('#theme-mode').addEventListener('change', (event) => changeThemePreference(event.currentTarget.value));
function changeReduceAnimations(enabled) {
  reduceAnimationsEnabled = enabled;
  localStorage.setItem(REDUCE_ANIMATIONS_KEY, String(enabled));
  document.documentElement.dataset.reduceAnimations = enabled ? 'on' : 'off';
  syncAppearanceControls();
}
$('#reduce-animations').addEventListener('change', (event) => changeReduceAnimations(event.currentTarget.checked));
function changeIconStyle(style) {
  iconStylePreference = style;
  localStorage.setItem(ICON_STYLE_KEY, style);
  refreshAppIcons();
  syncAppearanceControls();
}
$('#icon-style')?.addEventListener('change', (event) => changeIconStyle(event.currentTarget.value));
function changePosterBackground(enabled) {
  posterBackgroundEnabled = enabled;
  localStorage.setItem(POSTER_BACKGROUND_KEY, String(posterBackgroundEnabled));
  document.documentElement.dataset.posterBackground = posterBackgroundEnabled ? 'on' : 'off';
  updateGlassOpacityForPagePalette();
  syncAppearanceControls();
}
$('#poster-background').addEventListener('change', (event) => changePosterBackground(event.currentTarget.checked));
function changeEntryPosterBackdrop(enabled) {
  entryPosterBackdropEnabled = enabled;
  localStorage.setItem(ENTRY_POSTER_BACKDROP_KEY, String(enabled));
  document.documentElement.dataset.entryPosterBackdrop = enabled ? 'on' : 'off';
}
$('#entry-poster-backdrop').addEventListener('change', (event) => changeEntryPosterBackdrop(event.currentTarget.checked));
function changePosterBackgroundStrength(value) {
  posterBackgroundStrength = Number(value);
  document.documentElement.style.setProperty('--poster-background-strength', `${posterBackgroundStrength}%`);
  updateGlassOpacityForPagePalette();
  $('#poster-background-strength').value = posterBackgroundStrength;
  $('#poster-background-strength-value').value = `${posterBackgroundStrength}%`;
  localStorage.setItem(POSTER_BACKGROUND_STRENGTH_KEY, String(posterBackgroundStrength));
}
$('#poster-background-strength').addEventListener('input', (event) => changePosterBackgroundStrength(event.currentTarget.value));
function changeTactileDashboard(enabled) {
  tactileDashboardEnabled = enabled;
  localStorage.setItem(TACTILE_DASHBOARD_KEY, String(tactileDashboardEnabled));
  document.documentElement.dataset.themeGlass = tactileDashboardEnabled ? 'on' : 'off';
  syncAppearanceControls();
}
$('#tactile-dashboard').addEventListener('change', (event) => changeTactileDashboard(event.currentTarget.checked));
$('#dashboard-mode')?.addEventListener('change', (event) => {
  dashboardMode = event.currentTarget.value === 'dashboard' ? 'dashboard' : 'navbar';
  localStorage.setItem(DASHBOARD_MODE_KEY, dashboardMode);
  document.documentElement.dataset.dashboardMode = dashboardMode;
});
function changeMacosBoxBorders(enabled) {
  macosBoxBordersEnabled = enabled;
  localStorage.setItem(MACOS_BOX_BORDERS_KEY, String(enabled));
  document.documentElement.dataset.macosBorders = enabled ? 'on' : 'off';
}
$('#macos-box-borders').addEventListener('change', (event) => changeMacosBoxBorders(event.currentTarget.checked));
function changeColoredValueChips(enabled) {
  coloredValueChipsEnabled = enabled;
  localStorage.setItem(COLORED_VALUE_CHIPS_KEY, String(enabled));
  document.documentElement.dataset.valueChipFill = enabled ? 'on' : 'off';
}
$('#colored-value-chips').addEventListener('change', (event) => changeColoredValueChips(event.currentTarget.checked));
function changeHideMainValueChips(enabled) {
  hideMainValueChipsEnabled = enabled;
  localStorage.setItem(HIDE_MAIN_VALUE_CHIPS_KEY, String(enabled));
  document.documentElement.dataset.mainValueChips = enabled ? 'hidden' : 'visible';
}
$('#hide-main-value-chips').addEventListener('change', (event) => changeHideMainValueChips(event.currentTarget.checked));
function changeCornerRadiusScale(value) {
  cornerRadiusScale = Math.max(50, Math.min(150, Math.round(Number(value) / 5) * 5));
  document.documentElement.style.setProperty('--radius-scale', String(cornerRadiusScale / 100));
  $('#corner-radius-scale').value = cornerRadiusScale;
  $('#corner-radius-scale-value').value = `${cornerRadiusScale}%`;
  localStorage.setItem(CORNER_RADIUS_SCALE_KEY, String(cornerRadiusScale));
}
$('#corner-radius-scale').addEventListener('input', (event) => changeCornerRadiusScale(event.currentTarget.value));
function changeGlassSurfaceOpacity(value) {
  glassSurfaceOpacity = Math.max(60, Math.min(100, Math.round(Number(value) / 5) * 5));
  document.documentElement.style.setProperty('--glass-surface-opacity', `${glassSurfaceOpacity}%`);
  document.documentElement.dataset.glassOpaque = !glassTransparencyEnabled || glassSurfaceOpacity === 100 ? 'on' : 'off';
  $('#glass-surface-opacity').value = glassSurfaceOpacity;
  $('#glass-surface-opacity-value').value = `${glassSurfaceOpacity}%`;
  localStorage.setItem(GLASS_SURFACE_OPACITY_KEY, String(glassSurfaceOpacity));
}
$('#glass-surface-opacity').addEventListener('input', (event) => changeGlassSurfaceOpacity(event.currentTarget.value));
function changeGlassTransparency(enabled) {
  glassTransparencyEnabled = enabled;
  localStorage.setItem(GLASS_TRANSPARENCY_KEY, String(enabled));
  document.documentElement.dataset.glassTransparency = enabled ? 'on' : 'off';
  document.documentElement.dataset.glassOpaque = !enabled || glassSurfaceOpacity === 100 ? 'on' : 'off';
  syncAppearanceControls();
}
$('#disable-glass-transparency').addEventListener('change', (event) => changeGlassTransparency(!event.currentTarget.checked));
$('#save-omdb-key').addEventListener('click', () => {
  const key = $('#omdb-api-key').value.trim();
  if (!key) {
    localStorage.removeItem(OMDB_API_KEY);
    $('#omdb-key-status').textContent = 'OMDb lookups are disabled. Previously saved details remain with their entries.';
    return;
  }

  localStorage.setItem(OMDB_API_KEY, key);
  $('#omdb-key-status').textContent = 'Key saved. OMDb is contacted only when you look up details for an entry.';
});
$('#detail-back').addEventListener('click', () => { location.hash = '#library'; });
$('#detail-close').addEventListener('click', () => { location.hash = '#library'; });
$('#detail-expand').addEventListener('click', () => {
  if (location.hash.startsWith('#entry/') && !location.hash.endsWith('/full')) {
    const detail = $('#detail');
    detail.classList.remove('is-expanding');
    // Reflow so the transition can be replayed when opening another entry.
    void detail.offsetWidth;
    detail.classList.add('is-expanding');
    location.hash = `${location.hash}/full`;
    window.setTimeout(() => detail.classList.remove('is-expanding'), 300);
  }
});
let fullscreenBackSwipe = 0;
let fullscreenBackSwipeTimer;
document.addEventListener('wheel', (event) => {
  if (!location.hash.endsWith('/full')) {
    fullscreenBackSwipe = 0;
    return;
  }

  if (event.deltaX >= 0 || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 1.2) {
    fullscreenBackSwipe = 0;
    return;
  }

  fullscreenBackSwipe += event.deltaX;
  clearTimeout(fullscreenBackSwipeTimer);
  fullscreenBackSwipeTimer = setTimeout(() => { fullscreenBackSwipe = 0; }, 220);
  if (fullscreenBackSwipe <= -90) {
    fullscreenBackSwipe = 0;
    $('#detail-back').click();
  }
}, { passive: true });
$('#detail').addEventListener('click', (event) => {
  if (event.target === event.currentTarget && !event.currentTarget.classList.contains('is-fullscreen')) {
    location.hash = '#library';
  }
});

// Escape closes whichever popup is currently open, or leaves an entry page.
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    openDialog();
    return;
  }
  if (event.key !== 'Escape') return;

  const openDialogs = [...document.querySelectorAll('dialog[open]')];
  if (openDialogs.length) {
    event.preventDefault();
    openDialogs.at(-1).close();
    return;
  }

  if (location.hash.startsWith('#entry/')) {
    event.preventDefault();
    location.hash = '#library';
  }
});
// Filters and view tabs

document.querySelectorAll('.type-switch-option, .media-type-filter').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    collectionPage = 0;

    document.querySelectorAll('.type-switch-option, .media-type-filter').forEach((item) => {
      item.classList.toggle('active', item === button);
    });

    render();
  });
});

document.querySelectorAll('.library-view-switcher, .collection-view-switcher, .workspace-type-expandable').forEach((group) => {
  group.addEventListener('pointerleave', () => {
    if (group.contains(document.activeElement)) document.activeElement.blur();
  });
});

const librarySearch = $('#library-search');
const librarySearchBox = $('.library-search');
const librarySearchToggle = $('#library-search-toggle');
const librarySearchClear = $('#library-search-clear');
const isReworkedSearch = document.documentElement.dataset.cssReworkPreview === 'true';

document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'l'
    || location.hash.startsWith('#entry/')
    || document.querySelector('dialog[open]')) return;

  event.preventDefault();
  event.stopPropagation();
  librarySearchBox.classList.remove('is-escape-collapsed');
  librarySearchBox.classList.add('is-keyboard-expanded');
  librarySearch.focus();
  updateLibrarySearchExpandedState();
}, true);

/** Keeps the search control expanded while it contains a query or focus. */
function updateLibrarySearchExpandedState() {
  const hasQuery = librarySearch.value.length > 0;
  librarySearchBox.classList.toggle('has-query', hasQuery);
  const expanded = hasQuery || librarySearchBox.classList.contains('is-keyboard-expanded')
    || (!librarySearchBox.classList.contains('is-escape-collapsed') && librarySearchBox.matches(':focus-within'));
  if (isReworkedSearch) librarySearchToggle.classList.toggle('level-4-styling', expanded);
  librarySearchClear.hidden = isReworkedSearch ? !expanded : !hasQuery;
  librarySearchToggle.setAttribute('aria-expanded', String(expanded));
  librarySearchToggle.setAttribute('aria-label', 'Focus search field');
  librarySearchToggle.title = 'Search titles';
}

/** Clears the reworked search and returns its control to the compact state. */
function closeReworkedSearch() {
  librarySearch.value = '';
  librarySearchBox.classList.remove('is-keyboard-expanded');
  librarySearchBox.classList.add('is-escape-collapsed');
  librarySearch.blur();
  librarySearchClear.blur();
  librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
  updateLibrarySearchExpandedState();
}

librarySearchToggle.addEventListener('click', () => {
  librarySearchBox.classList.remove('is-escape-collapsed');
  librarySearchBox.classList.add('is-keyboard-expanded');
  librarySearch.focus();
  updateLibrarySearchExpandedState();
});
librarySearchBox.addEventListener('focusin', updateLibrarySearchExpandedState);
librarySearchBox.addEventListener('focusout', () => {
  librarySearchBox.classList.remove('is-keyboard-expanded');
  window.setTimeout(updateLibrarySearchExpandedState);
});
librarySearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  if (isReworkedSearch) {
    closeReworkedSearch();
    return;
  }
  librarySearchBox.classList.add('is-escape-collapsed');
  librarySearch.blur();
  updateLibrarySearchExpandedState();
});

librarySearch.addEventListener('input', () => {
  updateLibrarySearchExpandedState();
  collectionPage = 0;
  render();
});

librarySearchClear.addEventListener('click', () => {
  if (isReworkedSearch) {
    closeReworkedSearch();
    return;
  }
  librarySearch.value = '';
  librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
  librarySearch.focus();
});

$('#add-collection').addEventListener('click', createCollection);
let collectionResizeFrame = 0;
const scheduleCollectionResize = () => {
  cancelAnimationFrame(collectionResizeFrame);
  collectionResizeFrame = requestAnimationFrame(handleCollectionResize);
};
window.addEventListener('resize', scheduleCollectionResize);
if ('ResizeObserver' in window) {
  const collectionResizeObserver = new ResizeObserver(scheduleCollectionResize);
  collectionResizeObserver.observe($('#collection'));
}
$('#collection-page-previous').addEventListener('click', () => changeCollectionPage(-1));
$('#collection-page-next').addEventListener('click', () => changeCollectionPage(1));
$('#watched-year-filter').addEventListener('change', (event) => {
  watchedYearFilter = [...event.currentTarget.selectedOptions].map((option) => option.value);
  collectionPage = 0;
  renderCollection();
});
$('#rating-filter')?.addEventListener('change', (event) => {
  ratingFilter = [...event.currentTarget.selectedOptions].map((option) => Number(option.value));
  collectionPage = 0;
  renderCollection();
});
$('#collection-sort').addEventListener('change', (event) => {
  collectionSort = event.currentTarget.value;
  collectionPage = 0;
  renderCollection();
});
$('#reset-collection-filter-sort').addEventListener('click', () => {
  watchedYearFilter = [];
  ratingFilter = [];
  priorityFilter = [];
  collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
  activeFilter = 'all';
  collectionPage = 0;
  $('#library-search').value = '';
  document.querySelectorAll('.type-switch-option, .media-type-filter').forEach((button) => button.classList.toggle('active', button.dataset.filter === 'all'));
  render();
});
window.addEventListener('hashchange', (event) => {
  const previousHash = new URL(event.oldURL).hash;
  const wasViewingEntry = isEntryHash(previousHash);
  const isViewingEntry = isEntryHash(location.hash);
  const wasFullscreen = isFullscreenEntryHash(previousHash);
  const isFullscreen = isFullscreenEntryHash(location.hash);

  if (isViewingEntry && !wasViewingEntry) rememberLibraryScrollPosition();
  // Do not rebuild the collection when opening or closing a hover entry.
  // Replacing its cards is what resets the collection's own scrollTop.
  if (isViewingEntry || wasViewingEntry) renderDetail();
  else render();
  if (isFullscreen) window.scrollTo(0, 0);
  else if (wasViewingEntry && (!isViewingEntry || wasFullscreen)) restoreLibraryScrollPosition();
});

document.querySelectorAll('#collection-source-controls .library-view-switcher > [data-view], #collection-source-controls .collection-view-switcher > [data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const appScroller = $('.app-content-container');
    const preservedScrollTop = appScroller?.scrollTop;
    const previousSnapType = appScroller?.style.scrollSnapType ?? '';
    if (appScroller) appScroller.style.scrollSnapType = 'none';

    const folderSelected = activeCollectionView === 'logged' && activeCollectionId !== 'all';
    activeCollectionView = folderSelected
      ? button.dataset.view
      : button.dataset.view === activeCollectionView
        ? (activeCollectionView === 'logged' ? 'watchlist' : 'logged')
        : button.dataset.view;
    if (activeCollectionView === 'logged') activeCollectionId = 'all';
    collectionPage = 0;
    updateViewTabs();
    resetBannerTimer();
    $('#banner').classList.remove('is-sliding');
    render();
    if (appScroller && preservedScrollTop !== undefined) appScroller.scrollTop = preservedScrollTop;
    requestAnimationFrame(() => {
      if (appScroller && preservedScrollTop !== undefined) {
        appScroller.scrollTop = preservedScrollTop;
        appScroller.style.scrollSnapType = previousSnapType;
      }
      $('#banner').classList.add('is-sliding');
      setTimeout(() => $('#banner').classList.remove('is-sliding'), 600);
    });
  });
});


// Automatic banner rotation and initial render

let bannerTimer;
/** Restarts the banner rotation timer. */
function resetBannerTimer() {
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    if (!paused && !document.hidden && !$('#banner').hidden && bannerEntries().length > 1) {
      slideBanner(1);
    }
    resetBannerTimer();
  }, 6000);
}
resetBannerTimer();

syncRotationControls();
syncAppearanceControls();

/** Seeds a new web visitor's browser library without replacing saved or linked data. */
async function loadFirstVisitDemo() {
  if (window.rewatchedStorage || !['http:', 'https:'].includes(location.protocol)) return;
  const hasLibrary = () => [STORAGE_KEY, WATCHLIST_KEY, COLLECTIONS_KEY, STORAGE_FILE_NAME_KEY]
    .some((key) => localStorage.getItem(key) !== null);
  if (hasLibrary() || storageFileHandle || useElectronStorage) return;

  try {
    const response = await fetch('assets/demo_vault.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const demo = readBackup(await response.json());
    // A visitor may import or create a library while the demo is downloading.
    if (hasLibrary() || storageFileHandle || useElectronStorage) return;
    entries = demo.entries;
    watchlist = demo.watchlist;
    customCollections = demo.collections;
    save();
  } catch (error) {
    console.warn('Could not load the first-visit demo library.', error);
  }
}

initializeFileStorage()
  .then(loadFirstVisitDemo)
  .catch((error) => console.warn('Could not initialize file storage.', error))
  .finally(render);
/** App entry point: wires UI events, navigation, settings, keyboard shortcuts, and startup behavior. */
