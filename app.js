/** App module. */
// Top-level navigation, filters, banner controls, and startup.

const LIBRARY_SCROLL_KEY = 'rerun-library-scroll-position';
let libraryScrollPosition = Number(sessionStorage.getItem(LIBRARY_SCROLL_KEY)) || 0;

const themeToggle = $('.dashboard-theme-button');
const navThemeToggle = $('.nav-toggle-theme');
$('.dashboard-settings-button')?.addEventListener('click', openSettings);
$('.dashboard-storage-button')?.addEventListener('click', openSettings);
const collectionFiltersReturnAnchor = $('.workspace-filter-container, .collection-filter-sort').nextElementSibling;

/** Updates the sidebar's expanded or icon-only state. */
function setSidebarCollapsed(collapsed, persist = false) {
  const appContainer = $('.app-container');
  const sidebarToggle = $('.nav-toggle-sidebar');
  appContainer.classList.toggle('is-sidebar-collapsed', collapsed);
  if (persist) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  sidebarToggle.setAttribute('aria-pressed', String(collapsed));
  sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  sidebarToggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const settingsDialog = $('.settings-container');
  if (settingsDialog?.open) centerSettingsDialog(settingsDialog);
}

if ($('.navbar-vertical-layout')) {
  const savedSidebarState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  setSidebarCollapsed(savedSidebarState === 'true');
  $('.nav-toggle-sidebar').addEventListener('click', () => {
    setSidebarCollapsed(!$('.app-container').classList.contains('is-sidebar-collapsed'), true);
  });
}

/** Switches between the library and its statistics panel. */
function setDashboardSection(section) {
  const showStatistics = section === 'statistics';
  const dashboard = document.querySelector('.default-layout, .dashboard-layout');
  const collectionFilters = $('.workspace-filter-container, .collection-filter-sort');
  const libraryButton = $('.library-page-button, .section-library');
  const statisticsButton = $('.stats-page-button, .section-statistics');

  $('.library-section').hidden = showStatistics;
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
  setNavbarPage($('.nav-library-button'));
});
$('.stats-page-button, .section-statistics').addEventListener('click', () => {
  setDashboardSection('statistics');
  setNavbarPage($('.nav-stats-button'));
});

let navbarPageBeforeSettings = null;
let navbarPageContextBeforeSettings = '';
let navbarPageContextOverride = '';
// Keep the non-modal settings dialog outside the clipped app shell so it can overlay the blur.
document.body.append($('.settings-container'));
function closeSettingsHeadingHelp() {
  document.querySelectorAll('.settings-container .settings-heading-info[aria-controls], .settings-container .settings-heading-important[aria-controls]').forEach((button) => {
    document.getElementById(button.getAttribute('aria-controls')).hidden = true;
    button.setAttribute('aria-expanded', 'false');
  });
}
$('.settings-container')?.addEventListener('click', (event) => {
  const button = event.target.closest('.settings-heading-info[aria-controls], .settings-heading-important[aria-controls]');
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
document.querySelectorAll('.settings-container .settings-option').forEach((option) => {
  option.addEventListener('pointerdown', () => option.classList.add('tooltip-dismissed'));
  option.addEventListener('pointerleave', () => option.classList.remove('tooltip-dismissed'));
});

const omdbKeyInput = $('.omdb-api-key-input');
const omdbKeyVisibilityButton = $('#omdb-key-visibility');
const omdbKeyVisibilityIcon = omdbKeyVisibilityButton?.querySelector('img');
function setOmdbKeyVisible(visible) {
  if (!omdbKeyInput || !omdbKeyVisibilityButton || !omdbKeyVisibilityIcon) return;
  omdbKeyInput.type = visible ? 'text' : 'password';
  omdbKeyVisibilityIcon.src = visible
    ? 'assets/icons/filled/hide-text.png'
    : 'assets/icons/filled/show-text.png';
  omdbKeyVisibilityButton.setAttribute('aria-pressed', String(visible));
  omdbKeyVisibilityButton.setAttribute('aria-label', visible ? 'Release to hide API key' : 'Hold to show API key');
}
omdbKeyVisibilityButton?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  setOmdbKeyVisible(true);
});
['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((eventName) => {
  omdbKeyVisibilityButton?.addEventListener(eventName, () => setOmdbKeyVisible(false));
});
omdbKeyVisibilityButton?.addEventListener('keydown', (event) => {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    setOmdbKeyVisible(true);
  }
});
omdbKeyVisibilityButton?.addEventListener('keyup', (event) => {
  if (event.key === ' ' || event.key === 'Enter') setOmdbKeyVisible(false);
});
const navbarUrlHistory = [location.hash];
let navbarUrlHistoryIndex = 0;
let navbarHistoryTraversalDirection = 0;

/** Apply the context surface level based on available history and page context. */
function updateNavbarContextStyling() {
  const pageContainer = $('.nav-pagination-container');
  const hasPageContext = pageContainer?.classList.contains('has-page-context');
  const isExpanded = pageContainer?.matches(':hover, :focus-within');
  const hasHistory = navbarUrlHistoryIndex > 0 || navbarUrlHistoryIndex < navbarUrlHistory.length - 1;
  const context = $('.nav-page-container');
  const pageName = $('.nav-page-text-container');
  pageContainer?.classList.toggle('level-2-styling', Boolean(isExpanded));
  context?.classList.toggle('level-3-styling', hasHistory);
  context?.classList.toggle('level-2-styling', !hasHistory);
  pageName?.classList.toggle('level-3-styling', hasPageContext && hasHistory);
  pageName?.classList.toggle('level-2-styling', (hasPageContext && !hasHistory) || !hasPageContext);
}

['pointerenter', 'pointerleave', 'focusin', 'focusout'].forEach((eventName) => {
  $('.nav-pagination-container')?.addEventListener(eventName, updateNavbarContextStyling);
});

/** Keep both history arrows visible on hover and disable unavailable directions. */
function updateNavbarHistoryButtons() {
  const previousButton = $('.nav-prev-button');
  const nextButton = $('.nav-next-button');
  const canGoBack = navbarUrlHistoryIndex > 0;
  const canGoForward = navbarUrlHistoryIndex < navbarUrlHistory.length - 1;
  previousButton.disabled = !canGoBack;
  previousButton.hidden = false;
  nextButton.disabled = !canGoForward;
  nextButton.hidden = false;
  updateNavbarContextStyling();
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

  updateNavbarHistoryButtons();
}

window.addEventListener('hashchange', recordNavbarUrlHistory);
updateNavbarHistoryButtons();
$('.nav-pagination-container')?.addEventListener('animationend', (event) => {
  if (event.animationName !== 'nav-context-reveal') return;
  const pageContainer = event.currentTarget;
  if (pageContainer.classList.contains('is-concealing')) {
    $('.nav-context-text').hidden = true;
    pageContainer.classList.remove('has-page-context', 'is-concealing');
    updateNavbarContextStyling();
  } else {
    pageContainer.classList.remove('is-revealing');
  }
});

/** Keeps the top-level navbar selection in sync with the current page. */
function setNavbarPage(activeButton) {
  if (!activeButton) return;

  document.querySelectorAll('.navbar-vertical-layout .nav-button').forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.toggleAttribute('aria-current', active);
  });

  const pageContainer = $('.nav-pagination-container');
  const pageName = $('.nav-page-text-container');
  const activeLabel = activeButton.querySelector('.nav-button-text');
  if (pageName && activeLabel) {
    pageName.textContent = activeLabel.textContent.trim();
    const colorTokens = {
      'nav-home-button': '--color-icon-home',
      'nav-library-button': '--color-icon-library',
      'nav-backlog-button': '--color-backlog',
      'nav-folders-button': '--color-icon-folder',
      'nav-stats-button': '--color-icon-stats',
      'nav-timeline-button': '--color-icon-timeline',
      'nav-activity-button': '--color-icon-activity',
      'nav-settings-button': '--color-icon-settings',
      'nav-about-button': '--palette-white',
    };
    const colorToken = Object.entries(colorTokens).find(([name]) => activeButton.classList.contains(name))?.[1];
    if (colorToken) pageContainer.style.setProperty('--nav-page-text-container-color', `var(${colorToken})`);
  }
  updateNavbarPageContext();
}

setNavbarPage($('.nav-home-button'));
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

/** Match the storage reveal to its current label, including newly loaded file names. */
const navStorageButton = $('.nav-storage-button');
const navStorageText = $('.nav-storage-text');
if (navStorageButton && navStorageText) {
  const updateNavStorageTextWidth = () => {
    const textRange = document.createRange();
    textRange.selectNodeContents(navStorageText);
    navStorageButton.style.setProperty('--nav-storage-text-width', `${Math.ceil(textRange.getBoundingClientRect().width)}px`);
  };
  new MutationObserver(updateNavStorageTextWidth).observe(navStorageText, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  updateNavStorageTextWidth();
}

$('.nav-settings-button')?.addEventListener('click', () => {
  const dialog = $('.settings-container');
  if (dialog.open) {
    dialog.close();
    return;
  }
  openSettings();
});

$('.navbar-vertical-layout')?.addEventListener('click', (event) => {
  const pageButton = event.target.closest(
    '.nav-home-button, .nav-library-button, .nav-backlog-button, .nav-folders-button, .nav-progress-button, .nav-stats-button, .nav-timeline-button',
  );
  if (!pageButton) return;
  const dialog = $('.settings-container');
  if (dialog?.open) dialog.close();
}, true);

function toggleSettingsCategoryFromNavigation(category) {
  const dialog = $('.settings-container');
  if (dialog?.open) {
    dialog.close();
    return;
  }
  setSettingsCategory(category);
  openSettings();
}

$('.nav-about-button')?.addEventListener('click', () => toggleSettingsCategoryFromNavigation('about'));
$('.nav-storage-button')?.addEventListener('click', () => toggleSettingsCategoryFromNavigation('storage'));
$('.nav-profile-button')?.addEventListener('click', () => toggleSettingsCategoryFromNavigation('account'));

$('.settings-container').addEventListener('close', () => {
  closeSettingsHeadingHelp();
  pauseLoadStatusTimer();
  if (navbarPageBeforeSettings) setNavbarPage(navbarPageBeforeSettings);
  navbarPageBeforeSettings = null;
  navbarPageContextOverride = navbarPageContextBeforeSettings;
  navbarPageContextBeforeSettings = '';
  updateNavbarPageContext();
});

$('.app-content-container')?.addEventListener('click', () => {
  const dialog = $('.settings-container');
  if (dialog?.open) dialog.close();
});

/** Activates one settings category and its corresponding content panel. */
function setSettingsCategory(category) {
  document.querySelectorAll('.settings-category-button').forEach((button) => {
    const active = button.dataset.settingsCategory === category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('.settings-subcategory-list').forEach((list) => {
    list.hidden = list.dataset.settingsSubcategories !== category;
  });
  document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.settingsPanel !== category;
  });
  updateNavbarPageContext();
  if (category === 'storage') startLoadStatusTimer();
  else pauseLoadStatusTimer();
  if (document.querySelector(`.settings-subcategory-list[data-settings-subcategories="${category}"]`)) {
    requestAnimationFrame(updateActiveSettingsSubcategory);
  }
}

/** Show the selected settings category beside the navbar page indicator. */
function updateNavbarPageContext() {
  const dialog = $('.settings-container');
  const pageContainer = $('.nav-pagination-container');
  const pageName = $('.nav-page-text-container');
  const context = $('.nav-page-container');
  const contextName = $('.nav-context-text');
  const activeCategory = $('.settings-category-button.active');
  if (!pageContainer || !context || !contextName) return;
  const setPageContext = (label = '') => {
    const hasContext = Boolean(label);
    if (!hasContext) {
      if (contextName.hidden || pageContainer.classList.contains('is-concealing')) return;
      const expandedWidth = pageContainer.getBoundingClientRect().width;
      pageContainer.classList.remove('is-revealing');
      contextName.hidden = true;
      pageContainer.classList.remove('has-page-context');
      updateNavbarContextStyling();
      const collapsedWidth = pageContainer.getBoundingClientRect().width;
      pageContainer.classList.add('has-page-context');
      updateNavbarContextStyling();
      pageContainer.style.setProperty('--nav-context-start-width', `${expandedWidth}px`);
      pageContainer.style.setProperty('--nav-context-end-width', `${collapsedWidth}px`);
      void pageContainer.offsetWidth;
      pageContainer.classList.add('is-concealing');
      return;
    }

    pageContainer.classList.remove('is-concealing');
    const contextWasHidden = contextName.hidden;
    const collapsedWidth = contextWasHidden ? pageContainer.getBoundingClientRect().width : 0;
    contextName.textContent = label;
    contextName.hidden = false;
    pageContainer.classList.add('has-page-context');
    updateNavbarContextStyling();
    if (contextWasHidden) {
      const expandedWidth = pageContainer.getBoundingClientRect().width;
      pageContainer.style.setProperty('--nav-context-start-width', `${collapsedWidth}px`);
      pageContainer.style.setProperty('--nav-context-end-width', `${expandedWidth}px`);
      pageContainer.classList.remove('is-revealing');
      void pageContainer.offsetWidth;
      pageContainer.classList.add('is-revealing');
    }
    context.style.setProperty(
      '--nav-page-context-color',
      'var(--nav-page-text-container-color, var(--color-text-secondary))',
    );
  };
  if (navbarPageContextOverride) {
    setPageContext(navbarPageContextOverride);
    return;
  }
  const selectedFolder = !dialog?.open && $('.nav-folders-button[aria-current]')
    && activeCollectionView === 'logged'
    ? customCollections.find((folder) => folder.id === activeCollectionId)
    : null;
  if (selectedFolder) {
    setPageContext(selectedFolder.name);
    return;
  }
  if (!dialog?.open || !activeCategory) {
    setPageContext();
    return;
  }

  setPageContext(activeCategory.querySelector('.settings-category-text')?.textContent.trim() || '');
}

/** Temporarily show a page-specific label in the navbar context slot. */
function setNavbarPageContextOverride(label = '') {
  navbarPageContextOverride = label.trim();
  updateNavbarPageContext();
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

function setActiveSettingsSubcategory(activeButton) {
  const list = activeButton.parentElement;
  list.querySelectorAll('.settings-subcategory-button').forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
  const branchEnd = activeButton.offsetTop + activeButton.offsetHeight / 2;
  list.style.setProperty('--settings-active-branch-height', `${branchEnd - 4}px`);
}

function updateActiveSettingsSubcategory() {
  const content = $('.settings-content-container');
  const list = document.querySelector('.settings-subcategory-list:not([hidden])');
  const buttons = [...(list?.querySelectorAll('.settings-subcategory-button') ?? [])];
  if (!content || !list || !buttons.length) return;

  const contentTop = content.getBoundingClientRect().top + content.clientTop;
  const activationLine = contentTop + 48;
  let activeButton = buttons[0];
  let nearestDistance = Infinity;

  buttons.forEach((button) => {
    const target = document.getElementById(button.dataset.settingsTarget);
    if (!target) return;
    const distance = Math.abs(target.getBoundingClientRect().top - activationLine);
    if (distance < nearestDistance) {
      activeButton = button;
      nearestDistance = distance;
    }
  });

  if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
    activeButton = buttons[buttons.length - 1];
  }
  setActiveSettingsSubcategory(activeButton);
}

let settingsSubcategoryScrollFrame = 0;
$('.settings-content-container')?.addEventListener('scroll', () => {
  if (settingsSubcategoryScrollFrame) return;
  settingsSubcategoryScrollFrame = requestAnimationFrame(() => {
    settingsSubcategoryScrollFrame = 0;
    updateActiveSettingsSubcategory();
  });
});

document.querySelectorAll('.settings-subcategory-button').forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.settingsTarget);
    const content = $('.settings-content-container');
    if (!target || !content) return;

    setActiveSettingsSubcategory(button);
    const top = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    content.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
  });
});

/** Keep the tab-list orientation in sync with its responsive layout. */
function updateSettingsCategoryOrientation() {
  const categoryNavigation = $('.settings-category-layout');
  if (!categoryNavigation) return;
  categoryNavigation.setAttribute('aria-orientation', window.matchMedia('(max-width: 700px)').matches ? 'horizontal' : 'vertical');
}
updateSettingsCategoryOrientation();

$('.nav-home-button')?.addEventListener('click', () => {
  if (document.documentElement.dataset.dashboardSection === 'statistics') {
    setDashboardSection('library');
  }
  setNavbarPage($('.nav-home-button'));
  $('.app-content-container').scrollTo({ top: 0, behavior: 'smooth' });
});

$('.nav-library-button')?.addEventListener('click', () => {
  showNavbarCollectionView('logged', $('.nav-library-button'));
});

$('.nav-backlog-button')?.addEventListener('click', () => {
  showNavbarCollectionView('watchlist', $('.nav-backlog-button'));
});

$('.nav-folders-button')?.addEventListener('click', () => {
  setDashboardSection('library');
  setNavbarPage($('.nav-folders-button'));
});

/** Change the sidebar collection view without relying on removed workspace controls. */
function selectNavbarCollectionView(view) {
  if (activeCollectionView === view && activeCollectionId === 'all') return;
  activeCollectionView = view;
  activeCollectionId = 'all';
  collectionPage = 0;
  updateViewTabs();
  resetBannerTimer();
  render();
}

/** Switch the sidebar collection view while preserving the app's vertical scroll position. */
function showNavbarCollectionView(view, button) {
  const scroller = $('.app-content-container');
  const scrollTop = scroller?.scrollTop;
  const snapType = scroller?.style.scrollSnapType ?? '';
  if (scroller) scroller.style.scrollSnapType = 'none';

  setDashboardSection('library');
  selectNavbarCollectionView(view);
  setNavbarPage(button);
  if (scroller && scrollTop !== undefined) scroller.scrollTop = scrollTop;

  requestAnimationFrame(() => {
    if (!scroller || scrollTop === undefined) return;
    scroller.scrollTop = scrollTop;
    scroller.style.scrollSnapType = snapType;
  });
}

$('.nav-stats-button')?.addEventListener('click', () => {
  setDashboardSection('statistics');
  setNavbarPage($('.nav-stats-button'));
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
  [themeToggle, navThemeToggle].forEach((button) => {
    if (!button) return;
    button.setAttribute('aria-pressed', String(isLight));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = appIconMarkup(switchTo === 'dark' ? 'dark_mode' : 'light_mode');
  });
}

syncThemeToggle();
function toggleAppTheme() {
  themePreference = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, themePreference);
  applyTheme();
  syncThemeToggle();
  syncAppearanceControls();
}
themeToggle?.addEventListener('click', toggleAppTheme);
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

$('.overview-banner-controls-layout > .pagination-container > .pagination-prev-button').addEventListener('click', (event) => {
  event.stopPropagation();
  slideBanner(-1);
});

$('.overview-banner-controls-layout > .pagination-container > .pagination-next-button').addEventListener('click', (event) => {
  event.stopPropagation();
  slideBanner(1);
});

/** Opens the entry currently featured in the banner. */
function openBannerEntry() {
  if ($('.stats-page-button, .section-statistics').classList.contains('is-active')) return;
  const entry = bannerEntries()[bannerIndex];
  if (entry) location.hash = `#entry/${activeCollectionView}/${encodeURIComponent(entry.id)}`;
}

$('.overview-banner-container').addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  openBannerEntry();
});

$('.overview-banner-container').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target.closest('button')) return;
  event.preventDefault();
  openBannerEntry();
});

$('.overview-banner-container').addEventListener('wheel', (event) => {
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
  const button = $('.overview-banner-media-button');
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

$('.overview-banner-media-button').addEventListener('click', () => setRotation(paused));

/** Opens the settings dialog. */
function openSettings() {
  const dialog = $('.settings-container');
  if (!dialog) return;
  if (!dialog.open) {
    navbarPageBeforeSettings = $('.navbar-vertical-layout .nav-button.is-active') || $('.nav-home-button');
    navbarPageContextBeforeSettings = navbarPageContextOverride;
    navbarPageContextOverride = '';
    setNavbarPage($('.nav-settings-button'));
  }
  const activeCategory = document.querySelector('.settings-category-button.active')?.dataset.settingsCategory || 'general';
  setSettingsCategory(activeCategory);
  centerSettingsDialog(dialog);
  if (!dialog.open) dialog.show();
  updateNavbarPageContext();
  startLoadStatusTimer();

  try {
    syncRotationControls();
    syncAppearanceControls();
    updateBackupSummary();
    updateOmdbCallCount();
    $('.omdb-api-key-input').value = localStorage.getItem(OMDB_API_KEY) || '';
  } catch (error) {
    console.error('Settings opened, but some values could not be refreshed.', error);
  }
}

/** Centers the settings dialog over the visible app content. */
function centerSettingsDialog(dialog) {
  const content = $('.app-content-container');
  if (!content) return;
  const bounds = content.getBoundingClientRect();
  dialog.style.setProperty('--settings-anchor-x', `${bounds.left + bounds.width / 2}px`);
  dialog.style.setProperty('--settings-anchor-y', `${bounds.top + bounds.height / 2}px`);
}

window.addEventListener('resize', () => {
  updateSettingsCategoryOrientation();
  const dialog = $('.settings-container');
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
  $('#hide-rating-chip-percentage').checked = hideRatingChipPercentage;
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
function changeHideRatingChipPercentage(hidden) {
  hideRatingChipPercentage = hidden;
  localStorage.setItem(HIDE_RATING_CHIP_PERCENTAGE_KEY, String(hidden));
  render();
  syncRatingChipPercentages();
  syncAppearanceControls();
}
$('#hide-rating-chip-percentage').addEventListener('change', (event) => changeHideRatingChipPercentage(event.currentTarget.checked));
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
$('.omdb-save-key-button').addEventListener('click', () => {
  const key = $('.omdb-api-key-input').value.trim();
  if (!key) {
    localStorage.removeItem(OMDB_API_KEY);
    $('#omdb-key-status').textContent = 'OMDb lookups are disabled. Previously saved details remain with their entries.';
    return;
  }

  localStorage.setItem(OMDB_API_KEY, key);
  $('#omdb-key-status').textContent = 'Key saved. OMDb is contacted only when you look up details for an entry.';
});
$('.dashboard-back-button').addEventListener('click', () => { location.hash = '#library'; });
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
    $('.dashboard-back-button').click();
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

document.querySelectorAll('.workspace-type-menu-wrapper .menu-option, .media-type-filter').forEach((button) => {
  button.addEventListener('click', () => {
    const selectedType = button.dataset.filter;
    if (selectedType === 'all') activeFilters = [...workspaceMediaTypes];
    else if (activeFilters.includes(selectedType)) {
      if (activeFilters.length === 1) return;
      activeFilters = activeFilters.filter((type) => type !== selectedType);
    } else {
      activeFilters = [...activeFilters, selectedType];
    }
    collectionPage = 0;
    const typeWrapper = button.closest('.workspace-type-menu-wrapper');
    if (typeWrapper) {
      hasPendingWorkspaceMenuChanges = true;
      updateCollectionTools(activeCollectionView === 'watchlist');
    } else {
      render();
    }
    const typeMenu = typeWrapper?.querySelector('.menu-container');
    if (typeMenu) {
      typeMenu.hidden = false;
      typeWrapper.classList.add('is-open');
      typeWrapper.querySelector(':scope > .workspace-type-menu-button')
        ?.setAttribute('aria-expanded', 'true');
    }
  });
});

const librarySearch = $('.library-search-container > .search-input');
const librarySearchToggle = $('.library-search-container > .search-button > .icon-button');

/** Switches the search action between focusing the field and clearing its query. */
function updateLibrarySearchAction() {
  const hasQuery = librarySearch.value.length > 0;
  const icon = librarySearchToggle.querySelector('[data-icon]');
  const iconName = hasQuery ? 'close' : 'search';
  if (icon.dataset.icon !== iconName) {
    icon.dataset.icon = iconName;
    refreshAppIcons();
  }
  librarySearchToggle.setAttribute('aria-label', hasQuery ? 'Clear search' : 'Search');
  librarySearchToggle.title = hasQuery ? 'Clear search' : 'Search';
}

updateLibrarySearchAction();

document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'l'
    || location.hash.startsWith('#entry/')
    || document.querySelector('dialog[open]')) return;

  event.preventDefault();
  event.stopPropagation();
  librarySearch.focus();
}, true);

librarySearchToggle.addEventListener('click', () => {
  if (librarySearch.value) {
    librarySearch.value = '';
    librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
  }
  librarySearch.focus();
});
librarySearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  if (librarySearch.value) {
    librarySearch.value = '';
    librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
  }
  librarySearch.blur();
});

librarySearch.addEventListener('input', () => {
  updateLibrarySearchAction();
  collectionPage = 0;
  render();
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
  collectionResizeObserver.observe($('.workspace-content-layout'));
}
$('.workspace-pagination-container > .pagination-container > .pagination-prev-button').addEventListener('click', () => changeCollectionPage(-1));
$('.workspace-pagination-container > .pagination-container > .pagination-next-button').addEventListener('click', () => changeCollectionPage(1));
$('#release-year-filter').addEventListener('change', (event) => {
  if (event.currentTarget.closest('.workspace-year-menu-wrapper')) return;
  releaseYearFilter = [...event.currentTarget.selectedOptions].map((option) => option.value);
  collectionPage = 0;
  renderCollection();
});
$('#rating-filter')?.addEventListener('change', (event) => {
  ratingFilter = [...event.currentTarget.selectedOptions].map((option) => Number(option.value));
  collectionPage = 0;
  renderCollection();
});
$('#collection-sort').addEventListener('change', (event) => {
  if (event.currentTarget.closest('.workspace-sort-menu-wrapper')) return;
  collectionSort = event.currentTarget.value;
  collectionPage = 0;
  renderCollection();
});
$('.workspace-reset-button').addEventListener('click', () => {
  releaseYearFilter = [];
  ratingFilter = [100, 0];
  priorityFilter = [];
  collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
  activeFilters = [...workspaceMediaTypes];
  collectionPage = 0;
  librarySearch.value = '';
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

document.querySelectorAll('.workspace-controls-container :is(.library-view-switcher, .collection-view-switcher) > [data-view]').forEach((button) => {
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
    if (document.documentElement.dataset.dashboardSection !== 'statistics') {
      setNavbarPage(activeCollectionView === 'watchlist' ? $('.nav-backlog-button') : $('.nav-library-button'));
    }
    resetBannerTimer();
    $('.overview-banner-container').classList.remove('is-sliding');
    render();
    if (appScroller && preservedScrollTop !== undefined) appScroller.scrollTop = preservedScrollTop;
    requestAnimationFrame(() => {
      if (appScroller && preservedScrollTop !== undefined) {
        appScroller.scrollTop = preservedScrollTop;
        appScroller.style.scrollSnapType = previousSnapType;
      }
      $('.overview-banner-container').classList.add('is-sliding');
      setTimeout(() => $('.overview-banner-container').classList.remove('is-sliding'), 600);
    });
  });
});


// Automatic banner rotation and initial render

let bannerTimer;
/** Restarts the banner rotation timer. */
function resetBannerTimer() {
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    if (!paused && !document.hidden && !$('.overview-banner-container').hidden && bannerEntries().length > 1) {
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
