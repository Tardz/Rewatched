/** App module. */
// Top-level navigation, filters, banner controls, and startup.

const COLLECTION_SCROLL_KEY = 'rerun-collection-scroll-position';
let collectionScrollPosition = Number(sessionStorage.getItem(COLLECTION_SCROLL_KEY)) || 0;

const themeToggle = $('.dashboard-theme-button');
const navButtonFor = (iconId) => document.getElementById(iconId);
const navThemeToggle = navButtonFor('nav-theme-button');
const navbarPageButtonSelector = '.navbar-vertical-layout > .nav-group-container > button, .navbar-vertical-layout > .nav-group-container > .nav-folder-menu .folder-menu-trigger-option';
$('.dashboard-settings-button')?.addEventListener('click', openSettings);
$('.dashboard-storage-button')?.addEventListener('click', openSettings);
const collectionFiltersSelector = '.workspace-control-group:has(> .workspace-filter-layout)';
const collectionFiltersReturnAnchor = $(collectionFiltersSelector).nextElementSibling;

/** Switches between the Logged page and its statistics panel. */
function setDashboardSection(section) {
  const showStatistics = section === 'statistics';
  const dashboard = document.querySelector('.default-layout, .dashboard-layout');
  const collectionFilters = $(collectionFiltersSelector);
  const loggedButton = $('.logged-page-button');
  const statisticsButton = $('.stats-page-button, .section-statistics');

  $('.workspace-section').hidden = showStatistics;
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
  document.documentElement.dataset.dashboardSection = showStatistics ? 'statistics' : 'logged';

  loggedButton.classList.toggle('is-active', !showStatistics);
  statisticsButton.classList.toggle('is-active', showStatistics);
  loggedButton.toggleAttribute('aria-current', !showStatistics);
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

/** Switches the visible app page while keeping the collection workspace shared. */
let appPageBackdropFrame = 0;
function transitionAppPageBackdrop(appPage) {
  const root = document.documentElement;
  const previousPage = root.dataset.appPage;
  const currentColor = getComputedStyle(root).getPropertyValue('--app-page-backdrop-render-color').trim()
    || getComputedStyle(root).getPropertyValue('--app-page-backdrop-color').trim()
    || 'transparent';
  if (previousPage === appPage) return;

  cancelAnimationFrame(appPageBackdropFrame);
  root.style.removeProperty('--app-page-backdrop-render-color');
  root.dataset.appPage = appPage;
  const nextColor = getComputedStyle(root).getPropertyValue('--app-page-backdrop-color').trim() || 'transparent';
  if (root.dataset.reduceAnimations === 'on' || currentColor === nextColor) return;

  const startTime = performance.now();
  const duration = 480;
  const updateColor = (time) => {
    const linearProgress = Math.min(1, (time - startTime) / duration);
    const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);
    root.style.setProperty(
      '--app-page-backdrop-render-color',
      `color-mix(in srgb, ${currentColor} ${100 - progress * 100}%, ${nextColor} ${progress * 100}%)`,
    );
    if (linearProgress < 1) {
      appPageBackdropFrame = requestAnimationFrame(updateColor);
    } else {
      root.style.removeProperty('--app-page-backdrop-render-color');
      appPageBackdropFrame = 0;
    }
  };
  appPageBackdropFrame = requestAnimationFrame(updateColor);
}

function setAppPage(page) {
  const previousPage = document.documentElement.dataset.appPage || 'home';
  const appPage = ['home', 'logged', 'backlogged', 'folders', 'statistics'].includes(page)
    ? page
    : 'home';
  const isCollectionPage = ['logged', 'backlogged', 'folders'].includes(appPage);

  transitionAppPageBackdrop(appPage);
  $('.overview-layout').hidden = isCollectionPage;
  setDashboardSection(appPage === 'statistics' ? 'statistics' : 'logged');

  if (previousPage !== appPage) {
    cancelAnimationFrame(appPageLayoutRefreshFrame);
    appPageLayoutRefreshFrame = requestAnimationFrame(() => {
      appPageLayoutRefreshFrame = requestAnimationFrame(() => {
        appPageLayoutRefreshFrame = 0;
        handleCollectionResize();
      });
    });
  }
}

let appPageLayoutRefreshFrame = 0;

$('.logged-page-button').addEventListener('click', () => {
  showNavbarCollectionView('logged', navButtonFor('nav-logged-button'));
});
$('.stats-page-button, .section-statistics').addEventListener('click', () => {
  setAppPage('statistics');
  setNavbarPage(navButtonFor('nav-stats-button'));
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
    $('.nav-context-text-container').hidden = true;
    pageContainer.classList.remove('has-page-context', 'is-concealing');
    pageContainer.style.removeProperty('--nav-context-duration');
    pageContainer.style.removeProperty('--nav-context-delay');
    updateNavbarContextStyling();
  } else {
    pageContainer.classList.remove('is-revealing');
  }
});

let navbarPageNameAnimationTimeout;
let navbarContextNameAnimationTimeout;

/** Keeps the top-level navbar selection in sync with the current page. */
function setNavbarPage(activeButton) {
  if (!activeButton) return;

  document.querySelectorAll(navbarPageButtonSelector).forEach((button) => {
    const active = button === activeButton;
    button.classList.toggle('is-active', active);
    button.toggleAttribute('aria-current', active);
  });

  const pageContainer = $('.nav-pagination-container');
  const pageName = $('.nav-page-text-container');
  const activeLabel = activeButton.dataset.pageName;
  if (pageName && activeLabel) {
    const nextPageName = activeLabel.trim();
    const previousPageName = pageName.dataset.pageName || pageName.textContent.trim();
    if (nextPageName !== previousPageName) {
      const currentContainerWidth = pageName.getBoundingClientRect().width;
      pageName.dataset.pageName = nextPageName;
      clearTimeout(navbarPageNameAnimationTimeout);
      pageName.classList.remove('is-rolling');
      delete pageName.dataset.widthShrinking;
      pageName.style.removeProperty('width');
      pageName.style.removeProperty('--page-name-roll-total-duration');
      pageName.style.removeProperty('--page-name-roll-width-delay');

      if (reduceAnimationsEnabled) {
        pageName.textContent = nextPageName;
      } else {
        const measureNameWidth = (text) => {
          const measuredName = document.createElement('span');
          measuredName.style.position = 'absolute';
          measuredName.style.visibility = 'hidden';
          measuredName.style.whiteSpace = 'pre';
          measuredName.textContent = text;
          pageName.append(measuredName);
          const width = measuredName.getBoundingClientRect().width;
          measuredName.remove();
          return width;
        };
        const pageNameStyles = getComputedStyle(pageName);
        const numberOf = (property) => Number.parseFloat(pageNameStyles[property]) || 0;
        const contentLeft = numberOf('paddingLeft');
        const horizontalEdges = numberOf('borderLeftWidth') + numberOf('paddingLeft') + numberOf('paddingRight') + numberOf('borderRightWidth');
        const previousWidth = measureNameWidth(previousPageName);
        const nextWidth = measureNameWidth(nextPageName);
        const targetContainerWidth = nextWidth + horizontalEdges;
        pageName.style.width = `${currentContainerWidth || previousWidth + horizontalEdges}px`;
        const previousLetters = Array.from(previousPageName);
        const nextLetters = Array.from(nextPageName);
        const letterCount = Math.max(previousLetters.length, nextLetters.length);
        const letterDelayStep = 45;
        const changingIndices = Array.from({ length: letterCount }, (_, index) => index)
          .filter((index) => previousLetters[index] !== nextLetters[index])
          .map((index) => ({
            index,
            width: Math.max(
              previousLetters[index] ? measureNameWidth(previousLetters[index]) : 0,
              nextLetters[index] ? measureNameWidth(nextLetters[index]) : 0,
            ),
            tieBreaker: Math.random(),
          }))
          .sort((first, second) => second.width - first.width || first.tieBreaker - second.tieBreaker)
          .map(({ index }) => index);
        const staggerOrder = new Map(changingIndices.map((index, order) => [index, order]));
        const accessibleName = document.createElement('span');
        accessibleName.className = 'nav-page-character-accessible';
        accessibleName.textContent = nextPageName;
        const animatedLetters = document.createDocumentFragment();
        const positionLetter = (letter, sourceLetters, index) => {
          letter.style.left = `${contentLeft + measureNameWidth(sourceLetters.slice(0, index).join(''))}px`;
        };
        for (let index = 0; index < letterCount; index += 1) {
          const previousLetter = previousLetters[index];
          const nextLetter = nextLetters[index];

          if (previousLetter === nextLetter) {
            const stableLetter = document.createElement('span');
            stableLetter.className = 'nav-page-character-static';
            stableLetter.textContent = nextLetter;
            positionLetter(stableLetter, nextLetters, index);
            animatedLetters.append(stableLetter);
          } else {
            if (previousLetter !== undefined) {
              const oldLetter = document.createElement('span');
              oldLetter.className = 'nav-page-character-old';
              oldLetter.textContent = previousLetter;
              positionLetter(oldLetter, previousLetters, index);
              oldLetter.style.setProperty('--page-name-letter-delay', `${staggerOrder.get(index) * letterDelayStep}ms`);
              animatedLetters.append(oldLetter);
            }
            if (nextLetter !== undefined) {
              const newLetter = document.createElement('span');
              newLetter.className = 'nav-page-character-new';
              newLetter.textContent = nextLetter;
              positionLetter(newLetter, nextLetters, index);
              newLetter.style.setProperty('--page-name-letter-delay', `${staggerOrder.get(index) * letterDelayStep}ms`);
              animatedLetters.append(newLetter);
            }
          }
        }
        pageName.replaceChildren(accessibleName, animatedLetters);
        void pageName.offsetWidth;
        pageName.classList.add('is-rolling');
        const animationDuration = Number.parseFloat(
          getComputedStyle(pageName).getPropertyValue('--page-name-roll-duration'),
        ) || 240;
        const totalAnimationDuration = animationDuration + Math.max(0, changingIndices.length - 1) * letterDelayStep;
        const isShrinking = targetContainerWidth < currentContainerWidth;
        pageName.dataset.widthShrinking = String(isShrinking);
        const widthAnimationDuration = isShrinking ? 240 : totalAnimationDuration;
        const widthAnimationDelay = isShrinking ? 100 : 0;
        pageName.style.setProperty('--page-name-roll-total-duration', `${totalAnimationDuration}ms`);
        pageName.style.setProperty('--page-name-roll-width-duration', `${widthAnimationDuration}ms`);
        pageName.style.setProperty('--page-name-roll-width-delay', `${widthAnimationDelay}ms`);
        void pageName.offsetWidth;
        pageName.style.width = `${targetContainerWidth}px`;
        navbarPageNameAnimationTimeout = window.setTimeout(() => {
          if (pageName.dataset.pageName !== nextPageName) return;
          pageName.textContent = nextPageName;
          pageName.classList.remove('is-rolling');
          delete pageName.dataset.widthShrinking;
          pageName.style.removeProperty('width');
          pageName.style.removeProperty('--page-name-roll-total-duration');
          pageName.style.removeProperty('--page-name-roll-width-duration');
          pageName.style.removeProperty('--page-name-roll-width-delay');
        }, Math.max(totalAnimationDuration, widthAnimationDelay + widthAnimationDuration) + 30);
      }
    } else {
      pageName.dataset.pageName = nextPageName;
    }
    const colorTokens = {
      Home: '--color-icon-home',
      Logged: '--color-icon-logged',
      Backlogged: '--color-backlog',
      Folders: '--color-icon-folder',
      Stats: '--color-icon-stats',
      Timeline: '--color-icon-timeline',
      Activity: '--color-icon-activity',
      Settings: '--color-icon-settings',
    };
    const colorToken = colorTokens[nextPageName];
    if (colorToken) pageContainer.style.setProperty('--nav-page-text-container-color', `var(${colorToken})`);
  }
  updateNavbarPageContext();
}

setNavbarPage(navButtonFor('nav-home-button'));
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

navButtonFor('nav-settings-button')?.addEventListener('click', () => {
  const dialog = $('.settings-container');
  if (dialog.open) {
    dialog.close();
    return;
  }
  openSettings();
});

$('.navbar-vertical-layout')?.addEventListener('click', (event) => {
  const pageButton = event.target.closest(
    '.navbar-vertical-layout button[data-page-name="Home"], .navbar-vertical-layout button[data-page-name="Logged"], .navbar-vertical-layout button[data-page-name="Backlogged"], .navbar-vertical-layout button[data-page-name="Folders"], .navbar-vertical-layout button[data-page-name="Progress"], .navbar-vertical-layout button[data-page-name="Stats"], .navbar-vertical-layout button[data-page-name="Timeline"]',
  );
  if (!pageButton) return;
  const dialog = $('.settings-container');
  if (dialog?.open) {
    navbarPageBeforeSettings = null;
    navbarPageContextBeforeSettings = '';
    dialog.close();
  }
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

$('.nav-storage-button')?.addEventListener('click', () => toggleSettingsCategoryFromNavigation('storage'));
navButtonFor('nav-profile-button')?.addEventListener('click', () => toggleSettingsCategoryFromNavigation('account'));

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
  const contextName = $('.nav-context-text-container');
  const activeCategory = $('.settings-category-button.active');
  if (!pageContainer || !context || !contextName) return;
  const animateContextName = (label) => {
    const previousLabel = contextName.dataset.contextLabel ?? contextName.textContent;
    if (previousLabel === label) return;
    clearTimeout(navbarContextNameAnimationTimeout);
    const currentWidth = contextName.getBoundingClientRect().width;
    contextName.classList.remove('is-rolling');
    contextName.style.removeProperty('--page-name-roll-total-duration');
    contextName.style.width = `${currentWidth}px`;
    contextName.dataset.contextLabel = label;

    if (reduceAnimationsEnabled || contextName.hidden) {
      contextName.textContent = label;
      contextName.classList.remove('is-rolling');
      contextName.style.removeProperty('width');
      return;
    }

    const measureTextWidth = (text) => {
      const measuredText = document.createElement('span');
      measuredText.style.position = 'absolute';
      measuredText.style.visibility = 'hidden';
      measuredText.style.whiteSpace = 'pre';
      measuredText.textContent = text;
      contextName.append(measuredText);
      const width = measuredText.getBoundingClientRect().width;
      measuredText.remove();
      return width;
    };
    const contextStyles = getComputedStyle(contextName);
    const numberOf = (property) => Number.parseFloat(contextStyles[property]) || 0;
    const contentLeft = numberOf('paddingLeft');
    const horizontalEdges = numberOf('borderLeftWidth') + numberOf('paddingLeft')
      + numberOf('paddingRight') + numberOf('borderRightWidth');
    const previousLetters = Array.from(previousLabel);
    const nextLetters = Array.from(label);
    const letterCount = Math.max(previousLetters.length, nextLetters.length);
    const letterDelayStep = 45;
    const changingIndices = Array.from({ length: letterCount }, (_, index) => index)
      .filter((index) => previousLetters[index] !== nextLetters[index])
      .map((index) => ({
        index,
        width: Math.max(
          previousLetters[index] ? measureTextWidth(previousLetters[index]) : 0,
          nextLetters[index] ? measureTextWidth(nextLetters[index]) : 0,
        ),
        tieBreaker: Math.random(),
      }))
      .sort((first, second) => second.width - first.width || first.tieBreaker - second.tieBreaker)
      .map(({ index }) => index);
    const staggerOrder = new Map(changingIndices.map((index, order) => [index, order]));
    const accessibleName = document.createElement('span');
    accessibleName.className = 'nav-page-character-accessible';
    accessibleName.textContent = label;
    const animatedLetters = document.createDocumentFragment();
    const positionLetter = (letter, sourceLetters, index) => {
      letter.style.left = `${contentLeft + measureTextWidth(sourceLetters.slice(0, index).join(''))}px`;
    };

    for (let index = 0; index < letterCount; index += 1) {
      const previousLetter = previousLetters[index];
      const nextLetter = nextLetters[index];
      if (previousLetter === nextLetter) {
        const stableLetter = document.createElement('span');
        stableLetter.className = 'nav-page-character-static';
        stableLetter.textContent = nextLetter;
        positionLetter(stableLetter, nextLetters, index);
        animatedLetters.append(stableLetter);
        continue;
      }

      if (previousLetter !== undefined) {
        const oldLetter = document.createElement('span');
        oldLetter.className = 'nav-page-character-old';
        oldLetter.textContent = previousLetter;
        positionLetter(oldLetter, previousLetters, index);
        oldLetter.style.setProperty('--page-name-letter-delay', `${staggerOrder.get(index) * letterDelayStep}ms`);
        animatedLetters.append(oldLetter);
      }
      if (nextLetter !== undefined) {
        const newLetter = document.createElement('span');
        newLetter.className = 'nav-page-character-new';
        newLetter.textContent = nextLetter;
        positionLetter(newLetter, nextLetters, index);
        newLetter.style.setProperty('--page-name-letter-delay', `${staggerOrder.get(index) * letterDelayStep}ms`);
        animatedLetters.append(newLetter);
      }
    }

    const targetWidth = measureTextWidth(label) + horizontalEdges;
    contextName.style.width = `${currentWidth}px`;
    contextName.replaceChildren(accessibleName, animatedLetters);
    void contextName.offsetWidth;
    contextName.classList.add('is-rolling');
    const animationDuration = Number.parseFloat(
      getComputedStyle(contextName).getPropertyValue('--page-name-roll-duration'),
    ) || 140;
    const totalAnimationDuration = animationDuration + Math.max(0, changingIndices.length - 1) * letterDelayStep;
    const isShrinking = targetWidth < currentWidth;
    const widthAnimationDuration = isShrinking ? 240 : totalAnimationDuration;
    const widthAnimationDelay = isShrinking ? Math.max(0, totalAnimationDuration - 180) : 0;
    contextName.style.setProperty('--page-name-roll-total-duration', `${totalAnimationDuration}ms`);
    contextName.style.setProperty('--page-name-roll-width-duration', `${widthAnimationDuration}ms`);
    contextName.style.setProperty('--page-name-roll-width-delay', `${widthAnimationDelay}ms`);
    void contextName.offsetWidth;
    contextName.style.width = `${targetWidth}px`;
    navbarContextNameAnimationTimeout = window.setTimeout(() => {
      if (contextName.dataset.contextLabel === label) {
        contextName.textContent = label;
        contextName.classList.remove('is-rolling');
        contextName.style.removeProperty('width');
        contextName.style.removeProperty('--page-name-roll-total-duration');
        contextName.style.removeProperty('--page-name-roll-width-duration');
        contextName.style.removeProperty('--page-name-roll-width-delay');
      }
    }, Math.max(totalAnimationDuration, widthAnimationDelay + widthAnimationDuration) + 30);
  };
  const setPageContext = (label = '') => {
    const hasContext = Boolean(label);
    if (!hasContext) {
      if (contextName.hidden || pageContainer.classList.contains('is-concealing')) return;
      const expandedWidth = pageContainer.getBoundingClientRect().width;
      pageContainer.style.setProperty('--nav-context-text-container-width', `${contextName.getBoundingClientRect().width}px`);
      pageContainer.classList.remove('is-revealing');
      contextName.hidden = true;
      pageContainer.classList.remove('has-page-context');
      updateNavbarContextStyling();
      let collapsedWidth = pageContainer.getBoundingClientRect().width;
      contextName.hidden = false;
      pageContainer.classList.add('has-page-context');
      updateNavbarContextStyling();
      if (pageName?.classList.contains('is-rolling')) {
        const targetPageWidth = Number.parseFloat(pageName.style.width);
        if (Number.isFinite(targetPageWidth)) {
          collapsedWidth += targetPageWidth - pageName.getBoundingClientRect().width;
        }
      }
      pageContainer.style.setProperty('--nav-context-start-width', `${expandedWidth}px`);
      pageContainer.style.setProperty('--nav-context-end-width', `${collapsedWidth}px`);
      const pageNameStyles = pageName && getComputedStyle(pageName);
      const isPageNameShrinking = pageName?.classList.contains('is-rolling')
        && pageName.dataset.widthShrinking === 'true';
      pageContainer.style.setProperty(
        '--nav-context-duration',
        isPageNameShrinking
          ? pageNameStyles.getPropertyValue('--page-name-roll-width-duration').trim() || '240ms'
          : 'var(--ui-expand-duration)',
      );
      pageContainer.style.setProperty(
        '--nav-context-delay',
        isPageNameShrinking
          ? pageNameStyles.getPropertyValue('--page-name-roll-width-delay').trim() || '0ms'
          : '0ms',
      );
      void pageContainer.offsetWidth;
      pageContainer.classList.add('is-concealing');
      return;
    }

    pageContainer.classList.remove('is-concealing');
    const contextWasHidden = contextName.hidden;
    const collapsedWidth = contextWasHidden ? pageContainer.getBoundingClientRect().width : 0;
    animateContextName(label);
    contextName.hidden = false;
    pageContainer.classList.add('has-page-context');
    updateNavbarContextStyling();
    if (contextWasHidden) {
      let expandedWidth = pageContainer.getBoundingClientRect().width;
      pageContainer.style.setProperty(
        '--nav-context-text-container-width',
        contextName.style.width || `${contextName.getBoundingClientRect().width}px`,
      );
      if (pageName?.classList.contains('is-rolling')) {
        const targetPageWidth = Number.parseFloat(pageName.style.width);
        if (Number.isFinite(targetPageWidth)) {
          expandedWidth += targetPageWidth - pageName.getBoundingClientRect().width;
        }
      }
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
  const selectedFolder = !dialog?.open && $('.nav-folders-button')?.hasAttribute('aria-current')
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

navButtonFor('nav-home-button')?.addEventListener('click', () => {
  setAppPage('home');
  renderCollection();
  setNavbarPage(navButtonFor('nav-home-button'));
  $('.app-content-container').scrollTo({ top: 0, behavior: 'smooth' });
});

navButtonFor('nav-logged-button')?.addEventListener('click', (event) => {
  showNavbarCollectionView('logged', event.currentTarget);
});

navButtonFor('nav-backlogged-button')?.addEventListener('click', (event) => {
  showNavbarCollectionView('watchlist', event.currentTarget);
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

  const targetPage = view === 'watchlist' ? 'backlogged' : 'logged';
  const pageChanged = document.documentElement.dataset.appPage !== targetPage;
  setAppPage(targetPage);
  if (activeCollectionView === view && activeCollectionId === 'all') {
    if (pageChanged) renderCollection();
  } else {
    selectNavbarCollectionView(view);
  }
  setNavbarPage(button);
  if (scroller && scrollTop !== undefined) scroller.scrollTop = scrollTop;

  requestAnimationFrame(() => {
    if (!scroller || scrollTop === undefined) return;
    scroller.scrollTop = scrollTop;
    scroller.style.scrollSnapType = snapType;
  });
}

navButtonFor('nav-stats-button')?.addEventListener('click', () => {
  setAppPage('statistics');
  setNavbarPage(navButtonFor('nav-stats-button'));
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
    const iconMarkup = appIconMarkup(switchTo === 'dark' ? 'dark_mode' : 'light_mode');
    if (button === navThemeToggle) $('#nav-theme-button').innerHTML = iconMarkup;
    else button.innerHTML = iconMarkup;
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
function rememberCollectionScrollPosition() {
  collectionScrollPosition = window.scrollY;
  sessionStorage.setItem(COLLECTION_SCROLL_KEY, String(collectionScrollPosition));
}

/** Restores the saved collection scroll position. */
function restoreCollectionScrollPosition() {
  requestAnimationFrame(() => {
    window.scrollTo(0, collectionScrollPosition);
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
    navbarPageBeforeSettings = [...document.querySelectorAll(navbarPageButtonSelector)].find((button) => button.classList.contains('is-active')) || navButtonFor('nav-home-button');
    navbarPageContextBeforeSettings = navbarPageContextOverride;
    navbarPageContextOverride = '';
    setNavbarPage(navButtonFor('nav-settings-button'));
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
$('.dashboard-back-button').addEventListener('click', () => { location.hash = '#logged'; });
$('#detail-close').addEventListener('click', () => { location.hash = '#logged'; });
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
    location.hash = '#logged';
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
    location.hash = '#logged';
  }
});
const collectionSearch = $('.collection-search-container > .search-input');
const collectionSearchToggle = $('.collection-search-container > .search-button > .icon-button');

/** Switches the search action between focusing the field and clearing its query. */
function updateCollectionSearchAction() {
  const hasQuery = collectionSearch.value.length > 0;
  const icon = collectionSearchToggle.querySelector('[data-icon]');
  const iconName = hasQuery ? 'close' : 'search';
  if (icon.dataset.icon !== iconName) {
    icon.dataset.icon = iconName;
    refreshAppIcons();
  }
  collectionSearchToggle.setAttribute('aria-label', hasQuery ? 'Clear search' : 'Search');
  collectionSearchToggle.title = hasQuery ? 'Clear search' : 'Search';
}

updateCollectionSearchAction();

document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'l'
    || location.hash.startsWith('#entry/')
    || document.querySelector('dialog[open]')) return;

  event.preventDefault();
  event.stopPropagation();
  collectionSearch.focus();
}, true);

collectionSearchToggle.addEventListener('click', () => {
  if (collectionSearch.value) {
    collectionSearch.value = '';
    collectionSearch.dispatchEvent(new Event('input', { bubbles: true }));
  }
  collectionSearch.focus();
});
collectionSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  if (collectionSearch.value) {
    collectionSearch.value = '';
    collectionSearch.dispatchEvent(new Event('input', { bubbles: true }));
  }
  collectionSearch.blur();
});

collectionSearch.addEventListener('input', () => {
  updateCollectionSearchAction();
  collectionPage = 0;
  render();
});

$('.create-folder-option, #add-collection')?.addEventListener('click', () => {
  setFolderMenuOpen(false);
  createCollection();
});
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
$('.workspace-controls-container > .workspace-control-group > .pagination-container > .pagination-prev-button').addEventListener('click', () => changeCollectionPage(-1));
$('.workspace-controls-container > .workspace-control-group > .pagination-container > .pagination-next-button').addEventListener('click', () => changeCollectionPage(1));
$('#workspace-reset-button').addEventListener('click', () => {
  releaseYearFilter = [];
  ratingFilter = [100, 0];
  priorityFilter = [];
  collectionSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
  activeFilters = [...workspaceMediaTypes];
  collectionPage = 0;
  collectionSearch.value = '';
  render();
});
window.addEventListener('hashchange', (event) => {
  const previousHash = new URL(event.oldURL).hash;
  const wasViewingEntry = isEntryHash(previousHash);
  const isViewingEntry = isEntryHash(location.hash);
  const wasFullscreen = isFullscreenEntryHash(previousHash);
  const isFullscreen = isFullscreenEntryHash(location.hash);

  if (isViewingEntry && !wasViewingEntry) rememberCollectionScrollPosition();
  // Do not rebuild the collection when opening or closing a hover entry.
  // Replacing its cards is what resets the collection's own scrollTop.
  if (isViewingEntry || wasViewingEntry) renderDetail();
  else render();
  if (isFullscreen) window.scrollTo(0, 0);
  else if (wasViewingEntry && (!isViewingEntry || wasFullscreen)) restoreCollectionScrollPosition();
});

document.querySelectorAll('.workspace-controls-container .collection-view-switcher > [data-view]').forEach((button) => {
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
    if (document.documentElement.dataset.appPage !== 'statistics') {
      const targetPage = activeCollectionView === 'watchlist' ? 'backlogged' : 'logged';
      setAppPage(targetPage);
      setNavbarPage(navButtonFor(activeCollectionView === 'watchlist' ? 'nav-backlogged-button' : 'nav-logged-button'));
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
