/** Collection module. */
// Collection filtering, cards, view tabs, and entry removal.

let collectionPage = 0;
let collectionPageCount = 1;
let collectionColumnCount = 0;
let collectionRowCount = 0;
let collectionViewportWidth = 0;
let folderReturnView = 'logged';
let collectionSwipeDistance = 0;
let collectionSwipeLastEventAt = 0;
let collectionSwipeLocked = false;
let collectionSwipeLockedDirection = 0;
let collectionSwipeReverseDistance = 0;
let collectionSwipeQuietEvents = 0;
let collectionSwipePeakDelta = 0;
let collectionSwipeReversePeakDelta = 0;
let collectionSwipeSettled = false;
let collectionPageDirection = 0;
let lastRenderedAppPage = document.documentElement.dataset.appPage || 'home';
let lastRenderedWorkspaceEntryCount = 0;
let animateWorkspaceEntryRefresh = false;
const isReworkedCollection = document.documentElement.dataset.cssReworkPreview === 'true';

/** Returns the number of entry-card columns at the current width. */
function getCollectionColumnCount() {
  if (isReworkedCollection) {
    return Number.parseInt(getComputedStyle(collection).getPropertyValue('--workspace-entry-columns'), 10) || 1;
  }
  const columns = getComputedStyle(collection).gridTemplateColumns;
  return columns === 'none' ? 1 : Math.max(1, columns.split(/\s+/).filter(Boolean).length);
}

/** Reads the responsive card-row count from the active workspace layout. */
function getCollectionRowCount() {
  const workspaceOnlyPage = ['logged', 'backlogged', 'folders'].includes(document.documentElement.dataset.appPage);
  if (!workspaceOnlyPage) {
    collection.style.removeProperty('--workspace-entry-rows');
    return Number.parseInt(getComputedStyle(collection).getPropertyValue('--workspace-entry-rows'), 10) || 4;
  }

  const layoutStyles = getComputedStyle(collection);
  const pageStyles = collection.firstElementChild
    ? getComputedStyle(collection.firstElementChild)
    : null;
  const card = collection.querySelector('.entry-container');
  const cardStyles = card ? getComputedStyle(card) : null;
  const spacing = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-level-1')) || 9;
  const posterHeight = Number.parseFloat(layoutStyles.getPropertyValue('--workspace-entry-poster-height')) || 104;
  const configuredRowHeight = Number.parseFloat(layoutStyles.getPropertyValue('--workspace-entry-row-min-height'));
  // offsetHeight reports the card's layout size without entry hover/entrance transforms.
  // Measuring its transformed bounding box during the staggered reveal can make
  // the calculated capacity jump and render too many rows per page.
  const rowHeight = card?.offsetHeight
    || Number.parseFloat(cardStyles?.minHeight)
    || configuredRowHeight
    || posterHeight + spacing * 2 + 2;
  const rowGap = Number.parseFloat(pageStyles?.rowGap)
    || spacing + 4;
  const availableHeight = Math.max(
    0,
    collection.clientHeight
      - (Number.parseFloat(pageStyles?.paddingTop) || 0)
      - (Number.parseFloat(pageStyles?.paddingBottom) || 0),
  );
  const rows = Math.max(1, Math.floor((availableHeight + rowGap) / (rowHeight + rowGap)));
  collection.style.setProperty('--workspace-entry-rows', String(rows));
  return rows;
}

// The sidebar folder picker shares the expanding-menu structure used by the type picker.
const folderDropdown = $('.nav-folder-menu');
const folderMenuOptions = folderDropdown?.querySelector(':scope > .menu-content-layout');
const folderList = folderMenuOptions;
const folderButton = $('.nav-folders-button');
let folderMenuCloseHandler = null;
let folderMenuCloseTimer = 0;
let folderMenuOpenHandler = null;
let folderMenuOpenTimer = 0;

/** Resolve the longest computed transition on the shared expanding-menu surface. */
function getFolderMenuTransitionDuration(element = folderDropdown) {
  const styles = getComputedStyle(element);
  const durations = styles.transitionDuration.split(',').map((value) => value.trim());
  const delays = styles.transitionDelay.split(',').map((value) => value.trim());
  const toMilliseconds = (value) => {
    const amount = Number.parseFloat(value) || 0;
    return value.endsWith('ms') ? amount : amount * 1000;
  };
  return Math.max(0, ...durations.map((duration, index) =>
    toMilliseconds(duration) + toMilliseconds(delays[index % Math.max(delays.length, 1)] || '0s')));
}

/** Size the folder picker with the same expanding surface used by the type menu. */
function updateFolderMenuOpenSize() {
  if (!folderDropdown || !folderMenuOptions) return;
  const options = [...folderMenuOptions.querySelectorAll(':scope > .menu-option:not([hidden])')];
  const rootStyles = getComputedStyle(document.documentElement);
  const menuStyles = getComputedStyle(folderDropdown);
  const optionsStyles = getComputedStyle(folderMenuOptions);
  const visibleRows = Number.parseFloat(menuStyles.getPropertyValue('--folder-menu-visible-rows')) || 5;
  const shadowClearance = Number.parseFloat(menuStyles.getPropertyValue('--folder-menu-shadow-clearance')) || 0;
  const topInset = Number.parseFloat(optionsStyles.paddingTop) || 0;
  const inlineInset = Number.parseFloat(menuStyles.getPropertyValue('--nav-menu-inline-inset')) || 0;
  const menuPadding = Number.parseFloat(rootStyles.getPropertyValue('--spacing-level-2')) || 5;
  const resolvedBottomInset = Number.parseFloat(optionsStyles.paddingBottom);
  const bottomInset = Number.isFinite(resolvedBottomInset)
    ? resolvedBottomInset
    : menuPadding + shadowClearance;
  const closedWidth = Number.parseFloat(menuStyles.getPropertyValue('--nav-inner-box-size')) || 40;
  const borderWidth = (Number.parseFloat(menuStyles.borderLeftWidth) || 0)
    + (Number.parseFloat(menuStyles.borderRightWidth) || 0);
  const borderHeight = (Number.parseFloat(menuStyles.borderTopWidth) || 0)
    + (Number.parseFloat(menuStyles.borderBottomWidth) || 0);
  const textWidth = Math.max(0, ...options.map((option) => {
    const label = option.querySelector('.menu-option-label');
    if (!label) return option.scrollWidth;
    const styles = getComputedStyle(label);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return label.scrollWidth;
    context.font = styles.font;
    const rowStyles = getComputedStyle(option);
    const iconWidth = option.querySelector('.icon-button')?.getBoundingClientRect().width || 0;
    const labelOffset = Number.parseFloat(getComputedStyle(label).marginLeft) || 0;
    return context.measureText(label.textContent.trim()).width
      + iconWidth
      + labelOffset
      + (Number.parseFloat(rowStyles.columnGap) || 0)
      + (Number.parseFloat(rowStyles.paddingLeft) || 0)
      + (Number.parseFloat(rowStyles.paddingRight) || 0)
      + (Number.parseFloat(rowStyles.marginLeft) || 0)
      + (Number.parseFloat(rowStyles.marginRight) || 0);
  }));
  const surfaceLeft = folderDropdown.getBoundingClientRect().left;
  const availableWidth = Math.max(closedWidth, window.innerWidth - surfaceLeft - 12);
  const contentWidth = Math.min(
    Math.max(closedWidth, textWidth),
    availableWidth - menuPadding - inlineInset - borderWidth - shadowClearance,
  );
  const visibleOptionCount = Math.min(options.length, visibleRows);
  const firstVisibleOption = options[0];
  const lastVisibleOption = options[visibleOptionCount - 1];
  const listRect = folderMenuOptions.getBoundingClientRect();
  const lastVisibleRect = lastVisibleOption?.getBoundingClientRect();
  const visibleRowsBottom = firstVisibleOption && lastVisibleRect
    ? lastVisibleRect.bottom - listRect.top + folderMenuOptions.scrollTop
    : 0;
  // Keep the option shadows inside the scroll viewport's trailing edges.
  const listInlineInset = menuPadding + inlineInset + shadowClearance;
  const visibleListHeight = Math.max(0, visibleRowsBottom + bottomInset - 4);
  folderMenuOptions.style.height = `${visibleListHeight}px`;
  folderMenuOptions.style.maxHeight = `${visibleListHeight}px`;
  folderMenuOptions.style.overflowY = options.length > visibleRows ? 'auto' : 'visible';
  folderMenuOptions.style.overflowX = 'hidden';
  folderDropdown.style.setProperty('--menu-expanding-open-width', `${Math.ceil(contentWidth + listInlineInset + borderWidth)}px`);
  // Let the expanded grid lay itself out, then use its full content height.
  folderDropdown.style.setProperty('--menu-expanding-open-height', 'auto');
  void folderDropdown.offsetHeight;
  // Use the scroll viewport's rendered box, not scrollHeight (which includes rows beyond the five-row viewport).
  const openHeight = folderMenuOptions.getBoundingClientRect().height + borderHeight;
  folderDropdown.style.setProperty(
    '--menu-expanding-open-height',
    `${openHeight}px`,
  );
}

/** Capture the surface's actual in-flow position relative to its positioned nav group. */
function syncFolderMenuAnchor() {
  if (!folderDropdown) return;
  const navGroup = folderDropdown.parentElement;
  if (!navGroup) return;

  const surfaceRect = folderDropdown.getBoundingClientRect();
  const groupRect = navGroup.getBoundingClientRect();
  // Absolute offsets are measured from the containing block's padding edge, not
  // its outer border; use rendered geometry so the open surface starts exactly
  // where the centered, in-flow folder button currently sits.
  folderDropdown.style.setProperty(
    '--folder-menu-anchor-top',
    `${surfaceRect.top - groupRect.top - navGroup.clientTop}px`,
  );
  folderDropdown.style.setProperty(
    '--folder-menu-anchor-left',
    `${surfaceRect.left - groupRect.left - navGroup.clientLeft}px`,
  );
  folderDropdown.setAttribute('data-anchor-ready', '');
}

// Measure once while the menu is still in normal flow; after that the nav-group
// spacer preserves its slot and the shared menu surface only animates its size.
syncFolderMenuAnchor();

/** Apply the shared opening cadence used by every expanding menu. */
function setMenuOptionOpenDelays(options, animationScale) {
  options.forEach((option, index) => {
    option.style.setProperty('--menu-option-open-delay', `${(90 + index * 80) * animationScale}ms`);
  });
}

/** Stagger workspace filter choices in the same diagonal wave as entry cards. */
function setWorkspaceMenuOptionOpenDelays(options, columns) {
  options.forEach((option, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    option.style.setProperty('--menu-option-open-delay', `${(row + column) * 78}ms`);
  });
}

/** Keep the anchored folder trigger still and stagger its choices like the type menu. */
function prepareFolderOptionReveal() {
  if (!folderDropdown || !folderMenuOptions) return;
  const styles = getComputedStyle(folderDropdown);
  const animationScale = Number.parseFloat(styles.getPropertyValue('--nav-menu-animation-scale')) || 1;
  const options = [...folderMenuOptions.querySelectorAll(':scope > .menu-option:not(:first-child, [hidden])')];
  setMenuOptionOpenDelays(options, animationScale);
}

/** Reverse the type-menu exit cadence for only the folder rows currently in view. */
function prepareFolderOptionClose() {
  if (!folderDropdown || !folderMenuOptions) return 0;
  const styles = getComputedStyle(folderDropdown);
  const animationScale = Number.parseFloat(styles.getPropertyValue('--nav-menu-animation-scale')) || 1;
  const viewport = folderMenuOptions.getBoundingClientRect();
  const visibleOptions = [...folderMenuOptions.querySelectorAll(':scope > .menu-option:not(:first-child, [hidden])')]
    .filter((option) => {
      const rect = option.getBoundingClientRect();
      return rect.bottom > viewport.top && rect.top < viewport.bottom;
    });
  const allOptions = folderMenuOptions.querySelectorAll(':scope > .menu-option:not(:first-child)');
  allOptions.forEach((option) => {
    option.classList.remove('is-closing-visible');
    option.style.removeProperty('--menu-option-close-delay');
  });
  visibleOptions.forEach((option, index) => {
    option.classList.add('is-closing-visible');
    option.style.setProperty(
      '--menu-option-close-delay',
      `${((visibleOptions.length - 1 - index) * 85 - 8) * animationScale}ms`,
    );
  });
  if (document.documentElement.dataset.reduceAnimations === 'on') return 0;
  // Keep the closing state alive until the last visible folder row finishes fading.
  return Math.max(0, visibleOptions.length * 85 - 8) * animationScale
    + 85 * animationScale;
}

function clearFolderOptionClose() {
  folderMenuOptions?.querySelectorAll(':scope > .menu-option:not(:first-child)').forEach((option) => {
    option.classList.remove('is-closing-visible');
    option.style.removeProperty('--menu-option-close-delay');
  });
}

/** Prime dimensions while closed so the first user-open has real transition endpoints. */
function primeFolderMenuOpenSize() {
  if (!folderDropdown || !folderMenuOptions
    || folderDropdown.classList.contains('is-open')
    || folderDropdown.classList.contains('is-closing')) return null;
  const preserveInlineStyle = (element, property) => ({
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  });
  const restoreInlineStyle = (element, property, previous) => {
    if (previous.value) element.style.setProperty(property, previous.value, previous.priority);
    else element.style.removeProperty(property);
  };
  const previousSurfaceTransition = preserveInlineStyle(folderDropdown, 'transition');
  const previousSurfaceAnimation = preserveInlineStyle(folderDropdown, 'animation');
  const previousOptionsTransition = preserveInlineStyle(folderMenuOptions, 'transition');
  const previousOptionsAnimation = preserveInlineStyle(folderMenuOptions, 'animation');
  const previousOptionsHeight = preserveInlineStyle(folderMenuOptions, 'height');
  const previousOptionAnimations = [...folderMenuOptions.querySelectorAll(':scope > .menu-option')]
    .map((option) => [option, preserveInlineStyle(option, 'animation')]);
  const folderIcon = folderButton?.querySelector('.icon-button');
  const previousIconTransition = folderIcon ? preserveInlineStyle(folderIcon, 'transition') : null;

  // Measure the real open rows without letting the temporary state paint or animate.
  folderDropdown.style.setProperty('transition', 'none', 'important');
  folderDropdown.style.setProperty('animation', 'none', 'important');
  folderMenuOptions.style.setProperty('transition', 'none', 'important');
  folderMenuOptions.style.setProperty('animation', 'none', 'important');
  previousOptionAnimations.forEach(([option]) => option.style.setProperty('animation', 'none', 'important'));
  folderIcon?.style.setProperty('transition', 'none', 'important');
  folderDropdown.classList.add('is-open');
  updateFolderMenuOpenSize();
  const openOptionsHeight = folderMenuOptions.style.height;
  const openOptionsMaxHeight = folderMenuOptions.style.maxHeight;
  const openOptionsOverflowY = folderMenuOptions.style.overflowY;
  void folderDropdown.offsetHeight;
  folderDropdown.classList.remove('is-open');
  folderMenuOptions.style.overflowY = 'visible';
  folderMenuOptions.style.overflowX = 'visible';
  void folderDropdown.offsetHeight;
  restoreInlineStyle(folderDropdown, 'transition', previousSurfaceTransition);
  restoreInlineStyle(folderDropdown, 'animation', previousSurfaceAnimation);
  restoreInlineStyle(folderMenuOptions, 'transition', previousOptionsTransition);
  restoreInlineStyle(folderMenuOptions, 'animation', previousOptionsAnimation);
  restoreInlineStyle(folderMenuOptions, 'height', previousOptionsHeight);
  previousOptionAnimations.forEach(([option, previous]) => restoreInlineStyle(option, 'animation', previous));
  if (folderIcon && previousIconTransition) restoreInlineStyle(folderIcon, 'transition', previousIconTransition);
  return { openOptionsHeight, openOptionsMaxHeight, openOptionsOverflowY };
}

/** Finish the icon shrink while the folder panel continues expanding. */
function finishFolderTriggerShrink() {
  if (!folderDropdown?.classList.contains('is-trigger-shrinking')) return;
  const folderIcon = folderButton?.querySelector('.icon-button');
  if (folderIcon && folderMenuOpenHandler) {
    folderIcon.removeEventListener('transitionend', folderMenuOpenHandler);
  }
  window.clearTimeout(folderMenuOpenTimer);
  folderMenuOpenHandler = null;
  folderMenuOpenTimer = 0;
  folderDropdown.classList.remove('is-trigger-shrinking');
}

/** Open or close the folder menu using the shared expanding-menu surface. */
function setFolderMenuOpen(isOpen) {
  if (!folderDropdown || !folderMenuOptions || !folderButton) return;
  if (isOpen) {
    window.clearTimeout(folderMenuCloseTimer);
    if (folderMenuCloseHandler) {
      folderDropdown.removeEventListener('transitionend', folderMenuCloseHandler);
      folderMenuCloseHandler = null;
    }
    // If reopened mid-close, clear the closing guard before rebuilding active folder rows.
    folderDropdown.classList.remove('is-closing');
    folderDropdown.classList.remove('is-squeezing');
    closeWorkspaceFilterMenus();
    renderCollectionPicker();
    clearFolderOptionClose();
    prepareFolderOptionReveal();
    syncFolderMenuAnchor();
    const openSize = primeFolderMenuOpenSize();
    folderMenuOptions.scrollTop = 0;
    folderDropdown.classList.add('is-open', 'is-trigger-shrinking');
    if (openSize) {
      folderMenuOptions.style.height = openSize.openOptionsHeight;
      folderMenuOptions.style.maxHeight = openSize.openOptionsMaxHeight;
      folderMenuOptions.style.overflowY = openSize.openOptionsOverflowY;
      folderMenuOptions.style.overflowX = 'hidden';
    }
    const folderIcon = folderButton.querySelector('.icon-button');
    folderMenuOpenHandler = (event) => {
      if (event.target !== folderIcon || event.propertyName !== 'width') return;
      finishFolderTriggerShrink();
    };
    folderIcon.addEventListener('transitionend', folderMenuOpenHandler);
    folderMenuOpenTimer = window.setTimeout(
      finishFolderTriggerShrink,
      getFolderMenuTransitionDuration(folderIcon) + 50,
    );
  } else if (folderDropdown.classList.contains('is-open')) {
    const optionCloseDuration = prepareFolderOptionClose();
    const closeStartedAt = performance.now();
    const closeCompletionDuration = Math.max(
      getFolderMenuTransitionDuration(),
      optionCloseDuration,
    );
    folderDropdown.classList.add('is-closing');
    folderDropdown.classList.remove('is-open');
    // Keep the scroll viewport clipped so offscreen folders do not spill out while closing.
    folderMenuOptions.style.overflowY = 'hidden';
    folderMenuOptions.style.overflowX = 'hidden';
    const finishClosing = (event) => {
      if (event && (event.target !== folderDropdown || event.propertyName !== 'height')) return;
      if (event && performance.now() - closeStartedAt < closeCompletionDuration) return;
      if (folderDropdown.classList.contains('is-open')) return;
      folderDropdown.classList.remove('is-closing', 'is-trigger-shrinking');
      folderMenuOptions.style.removeProperty('height');
      folderMenuOptions.style.removeProperty('overflow-y');
      folderMenuOptions.style.removeProperty('overflow-x');
      clearFolderOptionClose();
      folderDropdown.removeEventListener('transitionend', finishClosing);
      window.clearTimeout(folderMenuCloseTimer);
      folderMenuCloseHandler = null;
      renderCollectionPicker();
      folderDropdown.classList.add('is-squeezing');
      document.body.classList.toggle(
        'workspace-filter-menu-open',
        workspaceFilterMenus.some(isWorkspaceFilterMenuOpen),
      );
    };
    folderDropdown.addEventListener('transitionend', finishClosing);
    folderMenuCloseHandler = finishClosing;
    window.clearTimeout(folderMenuCloseTimer);
    folderMenuCloseTimer = window.setTimeout(finishClosing, closeCompletionDuration + 20);
  }
  folderButton.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle(
    'workspace-filter-menu-open',
    isOpen || folderDropdown.classList.contains('is-closing') || workspaceFilterMenus.some(isWorkspaceFilterMenuOpen),
  );
}

function selectFolderFromMenu(folderId) {
  if (!folderId) return;
  if (typeof setAppPage === 'function') setAppPage('folders');
  selectCollection(folderId);
  if (typeof setNavbarPage === 'function') setNavbarPage(folderButton);
}

folderButton?.addEventListener('click', (event) => {
  if (!folderDropdown?.classList.contains('is-open')) {
    setFolderMenuOpen(true);
    return;
  }

  // While expanded, the trigger is the first folder option, not a close control.
  if (folderButton.dataset.folderId) {
    selectFolderFromMenu(folderButton.dataset.folderId);
  }
});

document.addEventListener('click', (event) => {
  // Selecting a folder rerenders the list synchronously and detaches the clicked
  // option before this document-level listener runs. Use the original event path
  // so that click still counts as inside the menu after that rerender.
  const clickedInsideFolderMenu = event.composedPath().includes(folderDropdown);
  if (folderDropdown && !clickedInsideFolderMenu) {
    setFolderMenuOpen(false);
  }
});

/* Open entry-card tools with the context menu; keep the panel styled through its closing transition. */
const entryCardToolsTimers = new WeakMap();

function setEntryCardToolsOpen(layout, isOpen) {
  const tools = layout.querySelector('.entry-card-tools');
  const pendingTimer = entryCardToolsTimers.get(layout);
  if (pendingTimer) {
    window.clearTimeout(pendingTimer);
    entryCardToolsTimers.delete(layout);
  }
  if (isOpen) {
    layout.classList.add('tools-visible', 'tools-open');
    tools?.classList.add('level-2-styling');
    return;
  }

  layout.classList.remove('tools-open');
  if (tools && layout.classList.contains('tools-visible')) {
    const timer = window.setTimeout(() => {
      if (!layout.classList.contains('tools-open')) {
        layout.classList.remove('tools-visible');
        tools.classList.remove('level-2-styling');
      }
      entryCardToolsTimers.delete(layout);
    }, 170);
    entryCardToolsTimers.set(layout, timer);
  }
}

collection.addEventListener('pointerout', (event) => {
  const layout = event.target.closest('.entry-card-layout.tools-open');
  if (!layout || layout.contains(event.relatedTarget)) return;
  setEntryCardToolsOpen(layout, false);
});

document.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.entry-card-layout.tools-open')) return;
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((layout) => setEntryCardToolsOpen(layout, false));
});

document.addEventListener('contextmenu', () => {
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((layout) => setEntryCardToolsOpen(layout, false));
});

collection.addEventListener('contextmenu', (event) => {
  const layout = event.target.closest('.entry-card-layout');
  if (!layout) return;
  event.preventDefault();
  const shouldOpen = !layout.classList.contains('tools-open');
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((item) => setEntryCardToolsOpen(item, false));
  if (shouldOpen) setEntryCardToolsOpen(layout, true);
  event.stopPropagation();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  collection.querySelectorAll('.entry-card-layout.tools-open').forEach((layout) => setEntryCardToolsOpen(layout, false));
});

window.addEventListener('resize', () => {
  if (folderDropdown?.classList.contains('is-open')) {
    updateFolderMenuOpenSize();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !folderDropdown?.classList.contains('is-open')) return;
  event.preventDefault();
  setFolderMenuOpen(false);
  folderButton?.focus();
});

const workspaceFilterMenuSelector = '.nav-type-menu, .workspace-ratings-menu, .workspace-year-menu, .workspace-sort-menu';
const workspaceFilterMenus = [...document.querySelectorAll(workspaceFilterMenuSelector)];
let hasPendingWorkspaceMenuChanges = false;

function isMixedWorkspaceTypeSelection(types = activeFilters) {
  return types.length === workspaceMediaTypes.length
    && workspaceMediaTypes.every((type) => types.includes(type));
}

function getWorkspaceFilterButton(wrapper) {
  return wrapper.querySelector(':scope > button');
}

function isWorkspaceFilterMenuOpen(wrapper) {
  return wrapper.classList.contains('is-open');
}

/** Lift a workspace menu above scrolling card layers while preserving its row slot. */
function prepareWorkspaceFilterMenuOverlay(wrapper) {
  const layout = wrapper.closest('.workspace-filter-layout');
  const group = wrapper.closest('.workspace-control-group');
  if (!layout || !group || wrapper.previousElementSibling?.hasAttribute('data-menu-spacer')) return;

  const menus = [...layout.querySelectorAll(':scope > .menu-expanding-container')];
  const menuRects = menus.map((menu) => [menu, menu.getBoundingClientRect()]);
  const wrapperRect = menuRects.find(([menu]) => menu === wrapper)?.[1];
  if (!wrapperRect) return;

  menuRects.forEach(([menu, rect]) => {
    menu.style.setProperty('--workspace-menu-closed-width', `${rect.width}px`);
  });
  layout.dataset.menuOpen = 'true';

  const spacer = document.createElement('span');
  spacer.dataset.menuSpacer = '';
  spacer.setAttribute('aria-hidden', 'true');
  Object.assign(spacer.style, {
    flex: `0 0 ${wrapperRect.width}px`,
    width: `${wrapperRect.width}px`,
    height: `${wrapperRect.height}px`,
    pointerEvents: 'none',
    visibility: 'hidden',
  });
  wrapper.before(spacer);

  wrapper.style.setProperty(
    '--workspace-menu-anchor-left',
    `${wrapperRect.left}px`,
  );
  wrapper.style.setProperty(
    '--workspace-menu-anchor-top',
    `${wrapperRect.top}px`,
  );
  wrapper.style.setProperty('--menu-expanding-closed-width', `${wrapperRect.width}px`);
  wrapper.style.setProperty('--menu-expanding-closed-height', `${wrapperRect.height}px`);
  // Lift the same visible surface before exposing its options, so measuring
  // intrinsic content cannot temporarily resize the surrounding flex row.
  wrapper.classList.add('is-opening');
  void wrapper.offsetWidth;
}

/** Return the trigger to the filter row after its closing animation finishes. */
function finishWorkspaceFilterMenuOverlay(wrapper) {
  wrapper.classList.remove('is-opening');
  wrapper.classList.add('level-3-styling');
  if (wrapper.matches('.workspace-ratings-menu, .workspace-year-menu, .workspace-sort-menu')) {
    getWorkspaceFilterButton(wrapper)?.classList.remove('level-4-styling');
  }
  if (wrapper.previousElementSibling?.hasAttribute('data-menu-spacer')) {
    wrapper.previousElementSibling.remove();
  }
  [
    '--workspace-menu-anchor-left',
    '--workspace-menu-anchor-top',
    '--menu-expanding-closed-width',
    '--menu-expanding-open-width',
    '--menu-expanding-closed-height',
    '--menu-expanding-open-height',
  ].forEach((property) => wrapper.style.removeProperty(property));

  const layout = wrapper.closest('.workspace-filter-layout');
  if (!layout?.querySelector(':scope > .menu-expanding-container.is-open, :scope > .menu-expanding-container.is-closing')) {
    layout?.removeAttribute('data-menu-open');
    layout?.querySelectorAll(':scope > .menu-expanding-container').forEach((menu) => {
      menu.style.removeProperty('--workspace-menu-closed-width');
    });
  }
}

/** Keep the collapsed type-picker width synced to its current label. */
function updateNavTypeMenuClosedWidth(wrapper, labelOverride = null) {
  const menu = wrapper;
  const trigger = menu.querySelector(':scope > button');
  const currentLabel = trigger.querySelector(':scope > .menu-option-label');
  const triggerStyles = getComputedStyle(trigger);
  const menuStyles = getComputedStyle(menu);
  const iconBox = trigger.querySelector(':scope > .icon-button');
  const text = currentLabel;
  let textWidth = text.getBoundingClientRect().width;
  if (labelOverride !== null) {
    const previousLabel = text.textContent;
    text.textContent = labelOverride;
    textWidth = text.getBoundingClientRect().width;
    text.textContent = previousLabel;
  }
  const closedWidth = iconBox.getBoundingClientRect().width
    + Number.parseFloat(triggerStyles.columnGap)
    + textWidth
    + Number.parseFloat(triggerStyles.paddingLeft)
    + Number.parseFloat(triggerStyles.paddingRight)
    + Number.parseFloat(menuStyles.borderLeftWidth)
    + Number.parseFloat(menuStyles.borderRightWidth);
  menu.style.setProperty('--menu-expanding-closed-width', `${Math.ceil(closedWidth)}px`);
  return closedWidth;
}

/** Carry the selected type into the trigger as the menu closes. */
function animateNavTypeSelection(wrapper, option, onComplete) {
  if (document.documentElement.dataset.reduceAnimations === 'on') return false;
  const trigger = getWorkspaceFilterButton(wrapper);
  const menu = wrapper;
  const options = menu.querySelector('.menu-content-layout');
  const visibleRows = [...options.querySelectorAll('.menu-option:not([hidden])')];
  const exitingRows = visibleRows.filter((row) => row !== option).reverse();
  const animationScale = Number.parseFloat(
    getComputedStyle(wrapper).getPropertyValue('--nav-menu-animation-scale'),
  ) || 1;
  const sourceRect = option.getBoundingClientRect();
  // Use layout height rather than the transformed visual rect. The squeeze animation
  // scales the menu surface and must not distort the selected row's travel progress.
  const menuHeight = menu.offsetHeight;
  const closedMenuHeight = Number.parseFloat(
    getComputedStyle(menu).getPropertyValue('--menu-expanding-closed-height'),
  ) || trigger.getBoundingClientRect().height;
  const collapsingHeight = Math.max(1, menuHeight - closedMenuHeight);
  const lastOptionBottom = visibleRows.at(-1)?.getBoundingClientRect().bottom ?? sourceRect.bottom;
  const travelSync = Number.parseFloat(
    getComputedStyle(wrapper).getPropertyValue('--nav-type-selection-travel-sync'),
  ) || 1;
  const shrinkProgressAtOption = Math.min(0.95, Math.max(
    0,
    ((lastOptionBottom - sourceRect.bottom) / collapsingHeight) * travelSync,
  ));
  const sourceIconRect = option.querySelector('.icon-button').getBoundingClientRect();
  const ghost = option.cloneNode(true);
  ghost.classList.add('nav-type-selection-ghost');
  const copyComputedStyles = (source, target) => {
    const styles = getComputedStyle(source);
    for (let index = 0; index < styles.length; index++) {
      const property = styles.item(index);
      target.style.setProperty(property, styles.getPropertyValue(property));
    }
    [...source.children].forEach((child, index) => {
      if (target.children[index]) copyComputedStyles(child, target.children[index]);
    });
  };
  copyComputedStyles(option, ghost);
  const sourceIconStyles = getComputedStyle(option.querySelector('.icon-button'));
  const ghostIcon = ghost.querySelector('.icon-button');
  // The moving copy leaves the menu, so carry its resolved glyph color with it.
  ghostIcon.style.setProperty('--nav-type-icon-color', getComputedStyle(option.querySelector('.icon-button'), '::after').backgroundColor);
  for (const property of [
    '--nav-type-icon-mask', '--nav-type-icon-glow-color',
    '--nav-type-icon-size', '--glow-halo-color', '--glow-halo-opacity',
  ]) {
    const value = sourceIconStyles.getPropertyValue(property).trim();
    if (value) ghostIcon.style.setProperty(property, value);
  }
  ghost.setAttribute('aria-hidden', 'true');
  ghost.querySelectorAll('button').forEach((button) => button.setAttribute('tabindex', '-1'));
  exitingRows.forEach((row, index) => {
    row.style.setProperty('--menu-option-close-delay', `${(index * 85 - 8) * animationScale}ms`);
  });
  const triggerFadeDelay = Math.max(0, ((exitingRows.length - 1) * 85 - 8 + 85) * animationScale);
  const triggerContents = [...trigger.querySelectorAll(':scope > .icon-button, :scope > .menu-option-label')];
  triggerContents.forEach((element) => element.style.setProperty('--nav-type-trigger-close-delay', `${triggerFadeDelay}ms`));
  Object.assign(ghost.style, {
    position: 'fixed',
    zIndex: '9999',
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    transform: 'none',
    transformOrigin: 'top left',
    animation: 'none',
  });
  document.body.append(ghost);
  option.classList.add('is-selection-source');
  menu.classList.add('is-selecting-option');
  const selectedLabel = option.querySelector('.menu-option-label')?.textContent.trim() || '';
  setWorkspaceFilterMenuOpen(wrapper, false, selectedLabel);
  const targetIconRect = trigger.querySelector(':scope > .icon-button').getBoundingClientRect();
  const dx = targetIconRect.left - sourceIconRect.left;
  const dy = targetIconRect.top - sourceIconRect.top;
  const transitionDuration = getComputedStyle(menu).transitionDuration.split(',')[0].trim();
  const closeDuration = transitionDuration.endsWith('ms')
    ? Number.parseFloat(transitionDuration)
    : Number.parseFloat(transitionDuration) * 1000;
  const removeAnimationListeners = [];
  let frameId = 0;
  let completed = false;
  const cleanUp = () => {
    if (completed) return;
    completed = true;
    cancelAnimationFrame(frameId);
    removeAnimationListeners.forEach((removeListener) => removeListener());
    // Hide the collapsed option list before revealing its original selected row.
    options.hidden = true;
    ghost.remove();
    onComplete();
    menu.classList.remove('is-selecting-option');
    option.classList.remove('is-selection-source');
    options.querySelectorAll('.menu-option').forEach((row) => {
      row.style.removeProperty('--menu-option-close-delay');
    });
    triggerContents.forEach((element) => element.style.removeProperty('--nav-type-trigger-close-delay'));
  };
  const finishWhenClosed = (event) => {
    if (event.target !== menu || event.propertyName !== 'height') return;
    // Ignore an early transition end/cancel; the selected row must finish traveling
    // with the collapsing surface before the trigger label is replaced.
    if (menu.offsetHeight <= closedMenuHeight + 1) cleanUp();
  };
  menu.addEventListener('transitionend', finishWhenClosed);
  removeAnimationListeners.push(
    () => menu.removeEventListener('transitionend', finishWhenClosed),
  );
  const closeStartedAt = performance.now();
  const followMenuShrink = () => {
    if (completed) return;
    const currentHeight = menu.offsetHeight;
    const shrinkProgress = Math.min(1, Math.max(0, (menuHeight - currentHeight) / collapsingHeight));
    if (shrinkProgress >= shrinkProgressAtOption) {
      const travelProgress = Math.min(1, (shrinkProgress - shrinkProgressAtOption) / (1 - shrinkProgressAtOption));
      ghost.style.transform = `translate(${dx * travelProgress}px, ${dy * travelProgress}px)`;
    }
    if (shrinkProgress >= 1 || performance.now() - closeStartedAt >= closeDuration + 100) {
      cleanUp();
      return;
    }
    frameId = requestAnimationFrame(followMenuShrink);
  };
  frameId = requestAnimationFrame(followMenuShrink);
  return true;
}

/** Opens one workspace filter menu and closes the others. */
function setWorkspaceFilterMenuOpen(wrapper, isOpen, closedLabel = null) {
  const trigger = getWorkspaceFilterButton(wrapper);
  if (wrapper.classList.contains('nav-type-menu')) {
    const menu = wrapper;
    const options = menu.querySelector('.menu-content-layout');
    if (isOpen) {
      menu.classList.remove('is-closing');
      menu.classList.remove('is-squeezing');
      const visibleOptions = [...options.querySelectorAll('.menu-option:not([hidden])')];
      const animationScale = Number.parseFloat(
        getComputedStyle(wrapper).getPropertyValue('--nav-menu-animation-scale'),
      ) || 1;
      setMenuOptionOpenDelays(visibleOptions, animationScale);
      visibleOptions.forEach((option, index) => {
        option.style.setProperty('--menu-option-close-delay', `${((visibleOptions.length - 1 - index) * 85 - 8) * animationScale}ms`);
      });
      const closedWidth = updateNavTypeMenuClosedWidth(wrapper);
      void menu.offsetWidth;
      options.hidden = false;
      const menuStyles = getComputedStyle(menu);
      const menuInlineBorders = Number.parseFloat(menuStyles.borderLeftWidth)
        + Number.parseFloat(menuStyles.borderRightWidth);
      const triggerHeight = trigger.getBoundingClientRect().height;
      const iconHeight = trigger.querySelector(':scope > .icon-button').getBoundingClientRect().height;
      const menuRightPadding = Math.max(0, (triggerHeight - iconHeight) / 2);
      const widestOption = Math.max(0, ...visibleOptions.map((option) => {
        const styles = getComputedStyle(option);
        const iconWidth = option.querySelector('.icon-button').getBoundingClientRect().width;
        const labelWidth = option.querySelector('.menu-option-label').scrollWidth;
        return iconWidth + labelWidth
          + (Number.parseFloat(styles.columnGap) || 0)
          + Number.parseFloat(styles.paddingLeft)
          + Number.parseFloat(styles.paddingRight)
          + menuRightPadding
          + menuInlineBorders;
      }));
      menu.style.setProperty('--menu-expanding-open-width', `${Math.ceil(Math.max(closedWidth, widestOption))}px`);
      const wrapperStyles = getComputedStyle(wrapper);
      const shadowClearance = Number.parseFloat(wrapperStyles.getPropertyValue('--nav-type-menu-shadow-clearance')) || 0;
      const menuPadding = menuRightPadding + shadowClearance;
      const optionsRowGap = Number.parseFloat(getComputedStyle(options).rowGap) || 0;
      const triggerOptionsGap = Math.max(0, optionsRowGap - menuRightPadding);
      const menuBorders = Number.parseFloat(menuStyles.borderTopWidth)
        + Number.parseFloat(menuStyles.borderBottomWidth);
      const openHeight = triggerHeight
        + options.scrollHeight
        + triggerOptionsGap
        + menuPadding
        + menuBorders;
      menu.style.setProperty('--menu-expanding-open-height', `${openHeight}px`);
      menu.classList.add('is-open');
      void menu.offsetWidth;
    } else if (menu.classList.contains('is-open')) {
      updateNavTypeMenuClosedWidth(wrapper, closedLabel);
      const visibleOptions = [...options.querySelectorAll('.menu-option:not([hidden])')];
      menu.classList.remove('is-squeezing');
      menu.classList.add('is-closing');
      menu.classList.remove('is-open');
      menu.classList.add('is-squeezing');
      const finishClosingMenu = (event) => {
        if (event.target !== menu || event.propertyName !== 'height') return;
        menu.removeEventListener('transitionend', finishClosingMenu);
        if (!menu.classList.contains('is-open')) {
          options.hidden = true;
          menu.classList.remove('is-closing');
          if (!menu.classList.contains('is-selecting-option')) {
            menu.querySelectorAll('.menu-option').forEach((option) => {
              option.style.removeProperty('--menu-option-close-delay');
            });
          }
        }
      };
      menu.addEventListener('transitionend', finishClosingMenu);
      if (getComputedStyle(menu).transitionDuration === '0s') {
        options.hidden = true;
        menu.classList.remove('is-closing');
        menu.classList.remove('is-squeezing');
        menu.removeEventListener('transitionend', finishClosingMenu);
      }
    }
  } else {
    const menu = wrapper;
    const options = menu.querySelector(':scope > .menu-content-layout');
    const visibleOptions = [...options.querySelectorAll('.menu-option:not([hidden])')];
    if (isOpen) {
      menu.classList.remove('is-closing', 'is-squeezing');
      menu.classList.add('level-3-styling');
      prepareWorkspaceFilterMenuOverlay(menu);
      const animationScale = Number.parseFloat(
        getComputedStyle(menu).getPropertyValue('--nav-menu-animation-scale'),
      ) || 1;
      const columns = menu.classList.contains('workspace-sort-menu') ? 2 : 3;
      setWorkspaceMenuOptionOpenDelays(visibleOptions, columns);
      visibleOptions.forEach((option, index) => {
        option.style.setProperty(
          '--menu-option-close-delay',
          `${((visibleOptions.length - 1 - index) * 85 - 8) * animationScale}ms`,
        );
      });
      options.hidden = false;
      const triggerHeight = trigger.getBoundingClientRect().height;
      // The closed menu constrains the grid to a few pixels. Its scroll height
      // still contains every option, so use that for the expanded target.
      const optionsMaxHeight = Number.parseFloat(getComputedStyle(options).maxHeight);
      const contentHeight = Math.min(
        options.scrollHeight,
        Number.isFinite(optionsMaxHeight) ? optionsMaxHeight : Infinity,
      );
      const menuStyles = getComputedStyle(menu);
      const menuPadding = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-level-2')) || 8;
      const menuBorders = Number.parseFloat(menuStyles.borderTopWidth)
        + Number.parseFloat(menuStyles.borderBottomWidth);
      const inlineBorders = Number.parseFloat(menuStyles.borderLeftWidth)
        + Number.parseFloat(menuStyles.borderRightWidth);
      const menuLeft = menu.getBoundingClientRect().left;
      // Measure the option grid at intrinsic width so the opened surface can
      // grow beyond the toolbar group instead of squeezing its labels into the
      // trigger's old flex slot.
      options.style.width = 'max-content';
      options.style.gridTemplateColumns = `repeat(${columns}, max-content)`;
      const intrinsicContentWidth = options.getBoundingClientRect().width;
      options.style.removeProperty('width');
      options.style.removeProperty('grid-template-columns');
      const closedWidth = Number.parseFloat(
        menu.style.getPropertyValue('--menu-expanding-closed-width'),
      ) || trigger.getBoundingClientRect().width;
      const availableViewportWidth = Math.max(
        closedWidth,
        window.innerWidth - menuLeft - 12,
      );
      const openWidth = Math.min(
        Math.max(closedWidth, intrinsicContentWidth + (menuPadding * 2) + inlineBorders),
        availableViewportWidth,
      );
      menu.style.setProperty('--menu-expanding-open-width', `${openWidth}px`);
      const openHeight = triggerHeight + contentHeight + (menuPadding * 2) + menuBorders;
      menu.style.setProperty('--menu-expanding-open-height', `${openHeight}px`);
      menu.style.setProperty('--menu-expanding-closed-height', `${triggerHeight}px`);
      void menu.offsetHeight;
      menu.classList.remove('is-opening');
      if (menu.matches('.workspace-ratings-menu, .workspace-year-menu, .workspace-sort-menu')) {
        trigger.classList.add('level-4-styling');
      }
      menu.classList.add('is-open');
    } else if (menu.classList.contains('is-open')) {
      menu.classList.remove('is-squeezing');
      menu.classList.add('is-closing');
      menu.classList.remove('is-open');
      const clearMenuSqueeze = (event) => {
        if (event.target !== menu || event.animationName !== 'menu-expanding-close-squeeze') return;
        menu.removeEventListener('animationend', clearMenuSqueeze);
        menu.classList.remove('is-squeezing');
      };
      menu.addEventListener('animationend', clearMenuSqueeze);
      menu.classList.add('is-squeezing');
      const finishClosingMenu = (event) => {
        if (event.target !== menu || event.propertyName !== 'height') return;
        menu.removeEventListener('transitionend', finishClosingMenu);
        if (!menu.classList.contains('is-open')) {
          options.hidden = true;
          menu.classList.remove('is-closing');
          menu.querySelectorAll('.menu-option').forEach((option) => {
            option.style.removeProperty('--menu-option-close-delay');
          });
          finishWorkspaceFilterMenuOverlay(menu);
        }
      };
      menu.addEventListener('transitionend', finishClosingMenu);
      if (getFolderMenuTransitionDuration(menu) === 0) {
        options.hidden = true;
        menu.classList.remove('is-closing');
        menu.classList.remove('is-squeezing');
        menu.removeEventListener('animationend', clearMenuSqueeze);
        menu.removeEventListener('transitionend', finishClosingMenu);
        finishWorkspaceFilterMenuOverlay(menu);
      }
    }
  }
  wrapper.classList.toggle('is-open', isOpen);
  trigger.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle(
    'workspace-filter-menu-open',
    workspaceFilterMenus.some(isWorkspaceFilterMenuOpen),
  );
}

function closeWorkspaceFilterMenus() {
  const wasOpen = workspaceFilterMenus.some(isWorkspaceFilterMenuOpen);
  if (wasOpen && hasPendingWorkspaceMenuChanges) {
    hasPendingWorkspaceMenuChanges = false;
    renderCollection();
  }
  workspaceFilterMenus.forEach((wrapper) => setWorkspaceFilterMenuOpen(wrapper, false));
}

workspaceFilterMenus.forEach((wrapper) => {
  const trigger = getWorkspaceFilterButton(wrapper);
  const select = wrapper.querySelector('select');
  let ratingDrag = null;
  let suppressRatingClick = false;
  let yearDrag = null;
  let suppressYearClick = false;

  const applyRatingSelection = (values) => {
    ratingFilter = [...new Set(values.map(Number))].slice(0, 2);
    [...select.options].forEach((item) => {
      item.selected = ratingFilter.includes(Number(item.value));
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  if (wrapper.classList.contains('workspace-ratings-menu') && select) {
    wrapper.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const option = event.target.closest('.menu-content-layout > .menu-option[data-filter-value]');
      if (!option || !wrapper.contains(option)) return;
      const value = Number(option.dataset.filterValue);
      ratingDrag = { pointerId: event.pointerId, start: value, current: value, changed: false };
    });

    document.addEventListener('pointermove', (event) => {
      if (!ratingDrag || event.pointerId !== ratingDrag.pointerId) return;
      const option = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest('.menu-content-layout > .menu-option[data-filter-value]');
      if (!option || !wrapper.contains(option)) return;
      const value = Number(option.dataset.filterValue);
      if (value === ratingDrag.current) return;
      ratingDrag.current = value;
      ratingDrag.changed ||= value !== ratingDrag.start;
      applyRatingSelection(ratingDrag.changed ? [ratingDrag.start, value] : [ratingDrag.start]);
    });

    const finishRatingDrag = (event) => {
      if (!ratingDrag || event.pointerId !== ratingDrag.pointerId) return;
      if (ratingDrag.changed) {
        suppressRatingClick = true;
        setTimeout(() => { suppressRatingClick = false; }, 0);
      }
      ratingDrag = null;
    };
    document.addEventListener('pointerup', finishRatingDrag);
    document.addEventListener('pointercancel', finishRatingDrag);
  }

  const applyYearSelection = (years) => {
    releaseYearFilter = [...new Set(years.map(String))].slice(0, 2);
    [...select.options].forEach((item) => {
      item.selected = releaseYearFilter.includes(item.value);
    });
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  if (wrapper.classList.contains('workspace-year-menu') && select) {
    wrapper.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      const option = event.target.closest('.menu-content-layout > .menu-option[data-filter-value]');
      if (!option || !wrapper.contains(option)) return;
      const year = option.dataset.filterValue;
      yearDrag = { pointerId: event.pointerId, start: year, current: year, changed: false };
    });

    document.addEventListener('pointermove', (event) => {
      if (!yearDrag || event.pointerId !== yearDrag.pointerId) return;
      const option = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest('.menu-content-layout > .menu-option[data-filter-value]');
      if (!option || !wrapper.contains(option)) return;
      const year = option.dataset.filterValue;
      if (year === yearDrag.current) return;
      yearDrag.current = year;
      yearDrag.changed ||= year !== yearDrag.start;
      applyYearSelection(yearDrag.changed ? [yearDrag.start, year] : [yearDrag.start]);
    });

    const finishYearDrag = (event) => {
      if (!yearDrag || event.pointerId !== yearDrag.pointerId) return;
      if (yearDrag.changed) {
        suppressYearClick = true;
        setTimeout(() => { suppressYearClick = false; }, 0);
      }
      yearDrag = null;
    };
    document.addEventListener('pointerup', finishYearDrag);
    document.addEventListener('pointercancel', finishYearDrag);
  }

  select?.addEventListener('change', () => {
    if (select.id === 'collection-value-filter') {
      const selectedValues = [...select.selectedOptions].map((option) => Number(option.value));
      const isPriorityFilter = select.getAttribute('aria-label') === 'Filter by priority';
      if (isPriorityFilter) priorityFilter = selectedValues;
      else {
        const addedValues = selectedValues.filter((value) => !ratingFilter.includes(value));
        if (selectedValues.length > 2 && addedValues.length) {
          const nextValue = addedValues.at(-1);
          const endpointToMove = ratingFilter.reduce((closest, value) => (
            Math.abs(value - nextValue) < Math.abs(closest - nextValue) ? value : closest
          ), ratingFilter[0]);
          ratingFilter = [...ratingFilter.filter((value) => value !== endpointToMove), nextValue];
        } else {
          const retainedValues = ratingFilter.filter((value) => selectedValues.includes(value));
          ratingFilter = [...retainedValues, ...addedValues].slice(0, 2);
          if (ratingFilter.length === 0) ratingFilter = [100, 0];
        }
        [...select.options].forEach((option) => {
          option.selected = ratingFilter.includes(Number(option.value));
        });
      }
    }
    if (select.id === 'release-year-filter') {
      const selectedYears = [...select.selectedOptions].map((option) => option.value);
      const addedYears = selectedYears.filter((year) => !releaseYearFilter.includes(year));
      if (selectedYears.length > 2 && addedYears.length) {
        const nextYear = addedYears.at(-1);
        const endpointToMove = releaseYearFilter.reduce((closest, year) => (
          Math.abs(Number(year) - Number(nextYear)) < Math.abs(Number(closest) - Number(nextYear)) ? year : closest
        ), releaseYearFilter[0]);
        releaseYearFilter = [...releaseYearFilter.filter((year) => year !== endpointToMove), nextYear];
      } else {
        releaseYearFilter = [
          ...releaseYearFilter.filter((year) => selectedYears.includes(year)),
          ...addedYears,
        ].slice(0, 2);
      }
      [...select.options].forEach((option) => {
        option.selected = releaseYearFilter.includes(option.value);
      });
    }
    collectionPage = 0;
    hasPendingWorkspaceMenuChanges = true;
    syncWorkspaceFilterMenu(select);
  });

  trigger.addEventListener('click', (event) => {
    const willOpen = !isWorkspaceFilterMenuOpen(wrapper);
    closeWorkspaceFilterMenus();
    setWorkspaceFilterMenuOpen(wrapper, willOpen);
  });

  trigger.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    closeWorkspaceFilterMenus();
    setWorkspaceFilterMenuOpen(wrapper, true);
    const options = wrapper.classList.contains('nav-type-menu')
      ? [...wrapper.querySelectorAll('.menu-option > button')].filter((option) => !option.closest('.menu-option')?.hidden)
      : [...wrapper.querySelectorAll(':scope > .menu-content-layout > .menu-option')].filter((option) => !option.hidden);
    const selectedOption = options.find((option) => (
      option.classList.contains('active') || option.classList.contains('is-selected')
    ));
    (selectedOption || (event.key === 'ArrowDown' ? options[0] : options[options.length - 1]))?.focus();
  });

  if (!select && wrapper.classList.contains('nav-type-menu')) {
    wrapper.addEventListener('click', (event) => {
      const option = event.target.closest('.menu-option');
      if (!option || option === trigger || !option.closest('.menu-content-layout') || !wrapper.contains(option)) return;
      event.stopPropagation();
      const selectedType = option.dataset.filter;
      if (selectedType !== 'mixed' && !workspaceMediaTypes.includes(selectedType)) return;
      const applySelectedType = () => {
        activeFilters = selectedType === 'mixed'
          ? [...workspaceMediaTypes]
          : [selectedType];
        collectionPage = 0;
        hasPendingWorkspaceMenuChanges = false;
        animateWorkspaceEntryRefresh = true;
        renderCollection();
        trigger.focus();
      };
      if (!animateNavTypeSelection(wrapper, option, applySelectedType)) {
        setWorkspaceFilterMenuOpen(wrapper, false);
        applySelectedType();
      }
    });
    return;
  }

  if (!select) return;

  wrapper.addEventListener('click', (event) => {
    const option = event.target.closest('.menu-option');
    if (!option || option === trigger || !option.closest('.menu-content-layout') || !wrapper.contains(option)) return;
    event.stopPropagation();
    if (wrapper.classList.contains('workspace-ratings-menu')) {
      if (suppressRatingClick) {
        suppressRatingClick = false;
        return;
      }
      const selectedRating = Number(option.dataset.filterValue);
      applyRatingSelection([selectedRating]);
      wrapper.querySelector(`.menu-content-layout > .menu-option[data-filter-value="${selectedRating}"]`)?.focus();
      return;
    }
    if (wrapper.classList.contains('workspace-year-menu')) {
      if (suppressYearClick) {
        suppressYearClick = false;
        return;
      }
      const selectedYear = option.dataset.filterValue;
      applyYearSelection([selectedYear]);
      wrapper.querySelector(`.menu-content-layout > .menu-option[data-filter-value="${selectedYear}"]`)?.focus();
      return;
    }
    if (wrapper.classList.contains('workspace-sort-menu')) {
      const [nextSortKey, nextDirection] = option.dataset.filterValue.split('-');
      const [currentSortKey, currentDirection] = collectionSort.split('-');
      collectionSort = nextSortKey === currentSortKey
        ? `${nextSortKey}-${currentDirection === 'desc' ? 'asc' : 'desc'}`
        : `${nextSortKey}-${nextDirection}`;
      collectionPage = 0;
      hasPendingWorkspaceMenuChanges = true;
      const sortOption = [...select.options].find((item) => item.value.split('-')[0] === nextSortKey);
      if (sortOption) sortOption.value = collectionSort;
      select.value = collectionSort;
      const defaultSort = activeCollectionView === 'watchlist' ? 'priority-desc' : 'watched-desc';
      select.classList.toggle('active', collectionSort !== defaultSort);
      syncWorkspaceFilterMenu(select);
      wrapper.querySelector('.menu-content-layout > .menu-option.active')?.focus();
      return;
    }
    const isMultiSelect = select.multiple;
    if (!isMultiSelect) setWorkspaceFilterMenuOpen(wrapper, false);
    if (isMultiSelect) {
      const matchingOption = [...select.options].find((item) => item.value === option.dataset.filterValue);
      if (matchingOption) matchingOption.selected = !matchingOption.selected;
    } else {
      select.value = option.dataset.filterValue;
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (isMultiSelect) {
      if (!isWorkspaceFilterMenuOpen(wrapper)) setWorkspaceFilterMenuOpen(wrapper, true);
      [...wrapper.querySelectorAll('.menu-option')]
        .find((item) => item.dataset.filterValue === option.dataset.filterValue)
        ?.focus();
    } else {
      trigger.focus();
    }
  });
});

document.addEventListener('click', (event) => {
  const openMenu = workspaceFilterMenus.find(isWorkspaceFilterMenuOpen);
  if (!openMenu || openMenu.contains(event.target)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  closeWorkspaceFilterMenus();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const openMenu = workspaceFilterMenus.find(isWorkspaceFilterMenuOpen);
  if (!openMenu) return;
  event.preventDefault();
  closeWorkspaceFilterMenus();
  getWorkspaceFilterButton(openMenu).focus();
});

/** Mirrors a native select's options and value into its reworked menu. */
function syncWorkspaceFilterMenu(select) {
  const wrapper = select.closest(workspaceFilterMenuSelector);
  if (!wrapper) return;

  const trigger = getWorkspaceFilterButton(wrapper);
  const optionsContainer = wrapper.querySelector(':scope > .menu-content-layout');
  const triggerLabel = trigger.querySelector(':scope > .menu-option-label');
  const selectedOptions = [...select.selectedOptions];
  const selectedOption = selectedOptions[0];
  const filterLabel = select.getAttribute('aria-label');
  const isValueFilter = select.id === 'collection-value-filter';
  const isPriorityFilter = isValueFilter && select.getAttribute('aria-label') === 'Filter by priority';
  const rangeValues = isValueFilter && !isPriorityFilter
    ? selectedOptions.map((option) => Number(option.value))
    : select.id === 'release-year-filter'
      ? selectedOptions.map((option) => Number(option.value))
      : [];
  const rangeBounds = rangeValues.length === 2
    ? [Math.min(...rangeValues), Math.max(...rangeValues)]
    : null;
  optionsContainer.setAttribute('aria-label', filterLabel);
  const selectedText = select.multiple
    ? selectedOptions.length === 0
      ? isValueFilter
        ? (isPriorityFilter ? 'P5 - P1' : `100 - 0${hideRatingChipPercentage ? '' : '%'}`)
        : select.id === 'release-year-filter'
          ? select.options.length
            ? `${select.options[0].value} - ${select.options[select.options.length - 1].value}`
            : 'No years'
          : 'All years'
      : isValueFilter && !isPriorityFilter && selectedOptions.length === 2
        ? `${Math.max(...selectedOptions.map((option) => Number(option.value)))} - ${Math.min(...selectedOptions.map((option) => Number(option.value)))}${hideRatingChipPercentage ? '' : '%'}`
        : select.id === 'release-year-filter' && selectedOptions.length === 2
          ? `${Math.max(...selectedOptions.map((option) => Number(option.value)))} - ${Math.min(...selectedOptions.map((option) => Number(option.value)))}`
        : selectedOptions.length === 1
          ? selectedOption.textContent
          : `${selectedOptions.length} selected`
    : selectedOption?.textContent ?? '';
  const directionalSort = select.id === 'collection-sort' && /^(watched|recent|rating|priority|title|release)-(asc|desc)$/.exec(selectedOption?.value ?? '');
  triggerLabel.textContent = selectedText;
  if (directionalSort) wrapper.dataset.sortDirection = directionalSort[2];
  const sortDirectionLabel = directionalSort
    ? `, ${directionalSort[2] === 'desc' ? 'descending' : 'ascending'}`
    : '';
  trigger.setAttribute('aria-label', `${filterLabel}: ${triggerLabel.textContent}${sortDirectionLabel}`);
  trigger.classList.toggle('active', select.classList.contains('active'));

  const existingRatingOptions = isValueFilter && !isPriorityFilter
    ? [...optionsContainer.querySelectorAll(':scope > .menu-option[data-filter-value]')]
    : [];
  const canUpdateRatingOptionsInPlace = existingRatingOptions.length === select.options.length
    && existingRatingOptions.every((button, index) => button.dataset.filterValue === select.options[index].value);
  if (canUpdateRatingOptionsInPlace) {
    [...select.options].forEach((selectOption, index) => {
      const button = existingRatingOptions[index];
      const optionValue = Number(selectOption.value);
      const isInSelectedRange = rangeBounds
        && optionValue >= rangeBounds[0]
        && optionValue <= rangeBounds[1];
      const isOptionActive = selectOption.selected || isInSelectedRange;
      button.setAttribute('aria-pressed', String(isOptionActive));
      button.classList.toggle('active', isOptionActive);
      if (isOptionActive) {
        let valueChip = button.querySelector(':scope > .rating-value-chip');
        if (!valueChip) {
          valueChip = document.createElement('span');
          valueChip.className = 'value-chip-styling rating-value-chip';
          button.replaceChildren(valueChip);
        }
        valueChip.textContent = selectOption.textContent;
        valueChip.style.setProperty('--rating-color', ratingColorForScore(optionValue / 10));
      } else if (button.firstElementChild || button.textContent !== selectOption.textContent) {
        button.textContent = selectOption.textContent;
      }
    });
    return;
  }

  const existingYearOptions = select.id === 'release-year-filter'
    ? [...optionsContainer.querySelectorAll(':scope > .menu-option[data-filter-value]')]
    : [];
  const canUpdateYearOptionsInPlace = existingYearOptions.length === select.options.length
    && existingYearOptions.every((button, index) => button.dataset.filterValue === select.options[index].value);
  if (canUpdateYearOptionsInPlace) {
    [...select.options].forEach((selectOption, index) => {
      const button = existingYearOptions[index];
      const year = Number(selectOption.value);
      const isInSelectedRange = rangeBounds
        && year >= rangeBounds[0]
        && year <= rangeBounds[1];
      const isOptionActive = selectOption.selected || isInSelectedRange;
      button.classList.remove('level-3-styling');
      button.classList.add('level-4-styling');
      button.setAttribute('aria-pressed', String(isOptionActive));
      button.classList.toggle('active', isOptionActive);
    });
    return;
  }

  optionsContainer.replaceChildren(...[...select.options].map((selectOption) => {
    const button = document.createElement('button');
    const optionValue = Number(selectOption.value);
    const isInSelectedRange = rangeBounds
      && optionValue >= rangeBounds[0]
      && optionValue <= rangeBounds[1];
    const isOptionActive = selectOption.selected || isInSelectedRange;
    button.type = 'button';
    const menuOptionLevel = wrapper.classList.contains('workspace-year-menu')
      || wrapper.classList.contains('workspace-sort-menu')
      ? 'level-4-styling'
      : 'level-3-styling';
    button.className = `menu-option${isValueFilter ? ' menu-option-value' : ''} ${menuOptionLevel}`;
    button.dataset.filterValue = selectOption.value;
    if (isValueFilter) {
      if (isOptionActive) {
        const valueChip = document.createElement('span');
        valueChip.className = isPriorityFilter
          ? 'value-chip-styling priority-value-chip'
          : 'value-chip-styling rating-value-chip';
        valueChip.textContent = selectOption.textContent;
        if (isPriorityFilter) {
          valueChip.style.setProperty('--priority-color', priorityColorForValue(Number(selectOption.value)));
        } else {
          valueChip.style.setProperty('--rating-color', ratingColorForScore(Number(selectOption.value) / 10));
        }
        button.append(valueChip);
      } else {
        button.textContent = selectOption.textContent;
      }
    } else {
      button.textContent = selectOption.textContent;
    }
    button.setAttribute('aria-pressed', String(isOptionActive));
    button.classList.toggle('active', isOptionActive);
    return button;
  }));
}

/** Picks the palette color for a priority chip based on its priority level. */
function priorityColorForValue(priority) {
  const token = priority >= 4
    ? '--color-priority-high'
    : priority <= 2
      ? '--color-priority-low'
      : '--color-priority-medium';
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

/** Updates active styling for the Logged and Backlogged view controls. */
function updateViewTabs() {
  const folderSelected = activeCollectionView === 'logged' && activeCollectionId !== 'all';
  const collapsedView = folderSelected ? folderReturnView : activeCollectionView;
  document.querySelectorAll('.workspace-controls-container .collection-view-switcher > [data-view]').forEach((button) => {
    const selected = !folderSelected && button.dataset.view === activeCollectionView;
    button.classList.toggle('is-collapsed-current', folderSelected && button.dataset.view === collapsedView);
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}

const workspaceViewToggle = document.querySelector('.workspace-view-toggle');

function updateWorkspaceViewToggle() {
  if (!workspaceViewToggle) return;
  const isListView = collection.classList.contains('is-list-view');
  const nextView = isListView ? 'gallery' : 'list';
  const currentView = isListView ? 'list' : 'gallery';
  const label = `Switch to ${nextView} view`;
  workspaceViewToggle.setAttribute('aria-label', label);
  workspaceViewToggle.title = label;
  workspaceViewToggle.setAttribute('aria-pressed', String(isListView));
  workspaceViewToggle.innerHTML = appIconMarkup(currentView, 'icon');
}

workspaceViewToggle?.addEventListener('click', () => {
  collection.classList.toggle('is-list-view');
  collectionPage = 0;
  animateWorkspaceEntryRefresh = true;
  renderCollection();
  updateWorkspaceViewToggle();
});
updateWorkspaceViewToggle();

/** Renders collection changes without collapsing its scroll position. */
function renderWithoutScrollCollapse() {
  const currentHeight = collection.getBoundingClientRect().height;
  if (currentHeight) collection.style.minHeight = `${Math.ceil(currentHeight)}px`;
  render();
  requestAnimationFrame(() => {
    collection.style.removeProperty('min-height');
  });
}

/** Renders the selectable list of collections. */
function renderCollectionPicker() {
  const list = folderList;
  if (!list || !folderButton) return;
  // Keep the exiting rows mounted until their reverse stagger has completed.
  if (folderDropdown?.classList.contains('is-closing')) return;
  const getFolderMenuContentSignature = () => [...list.children]
    .map((option) => `${option.dataset.folderId || ''}:${option.title || ''}`)
    .join('|');
  const previousContentSignature = getFolderMenuContentSignature();
  const selectedFolder = activeCollectionView === 'logged'
    ? customCollections.find((folder) => folder.id === activeCollectionId)
    : null;

  const formatFolderMenuLabel = (name) => {
    const characters = Array.from(name);
    return characters.length > 10 ? `${characters.slice(0, 10).join('')}…` : name;
  };

  const setTriggerFolder = (folder) => {
    const label = folderButton.querySelector('.menu-option-label') || document.createElement('span');
    label.className = 'menu-option-label';
    const labelText = formatFolderMenuLabel(folder?.name || 'No folders yet');
    if (folderButton.dataset.folderId !== (folder?.id || '')) folderButton.dataset.folderId = folder?.id || '';
    const isSelected = Boolean(folder && selectedFolder?.id === folder.id);
    if (folderButton.getAttribute('aria-pressed') !== String(isSelected)) {
      folderButton.setAttribute('aria-pressed', String(isSelected));
    }
    const ariaLabel = folder ? `Open ${folder.name} folder` : 'Choose a folder';
    if (folderButton.getAttribute('aria-label') !== ariaLabel) folderButton.setAttribute('aria-label', ariaLabel);
    if (folderButton.title !== (folder?.name || 'Choose a folder')) folderButton.title = folder?.name || 'Choose a folder';
    if (label.textContent !== labelText) label.textContent = labelText;
    if (!label.parentElement) folderButton.append(label);
    folderButton.classList.toggle('is-selected', isSelected);
    folderButton.classList.toggle('is-active', Boolean(selectedFolder));
  };

  const existingOptions = new Map(
    [...list.querySelectorAll(':scope > .menu-option:not(.nav-folders-button)')]
      .map((option) => [option.dataset.folderId, option]),
  );
  const expectedIds = new Set(customCollections.slice(1).map((folder) => folder.id));
  existingOptions.forEach((option, id) => {
    if (!expectedIds.has(id)) option.remove();
  });

  const updateFolderOption = (option, folder) => {
    const selected = selectedFolder?.id === folder.id;
    if (!option) {
      option = document.createElement('button');
      option.type = 'button';
      option.className = 'menu-option';
      option.dataset.folderId = folder.id;
      const icon = document.createElement('span');
      icon.className = 'icon-button glow-halo level-3-styling';
      icon.setAttribute('aria-hidden', 'true');
      icon.append(createFilledIconElement('folder'));
      const label = document.createElement('span');
      label.className = 'menu-option-label';
      option.append(icon, label);
      option.addEventListener('click', () => selectFolderFromMenu(folder.id));
    }
    const label = option.querySelector('.menu-option-label');
    const labelText = formatFolderMenuLabel(folder.name);
    if (label.textContent !== labelText) label.textContent = labelText;
    if (option.getAttribute('aria-pressed') !== String(selected)) option.setAttribute('aria-pressed', String(selected));
    if (option.getAttribute('aria-label') !== `Open ${folder.name} folder`) {
      option.setAttribute('aria-label', `Open ${folder.name} folder`);
    }
    if (option.title !== folder.name) option.title = folder.name;
    option.classList.toggle('is-selected', selected);
    return option;
  };

  if (!customCollections.length) {
    setTriggerFolder(null);
    if (folderDropdown.classList.contains('is-open')
      && getFolderMenuContentSignature() !== previousContentSignature) {
      updateFolderMenuOpenSize();
    }
    return;
  }

  const [firstFolder, ...remainingFolders] = customCollections;
  // The navigation trigger is the first actual folder row in the scrollable list.
  setTriggerFolder(firstFolder);
  remainingFolders.forEach((folder, index) => {
    const option = updateFolderOption(existingOptions.get(folder.id), folder);
    const expectedPosition = list.children[index + 1] || null;
    if (option !== expectedPosition) list.insertBefore(option, expectedPosition);
  });
  if (folderDropdown.classList.contains('is-open')
    && getFolderMenuContentSignature() !== previousContentSignature) {
    updateFolderMenuOpenSize();
  }
}

/** Preserves control order during expansion, then applies the compact order. */
function keepControlOrderUntilCollapsed(group, buttonSelector) {
  let releaseOrderTimer;

  const buttons = () => [...group.querySelectorAll(buttonSelector)];
  const lockOrder = () => {
    clearTimeout(releaseOrderTimer);
    buttons().forEach((button) => {
      button.style.order = getComputedStyle(button).order;
    });
  };
  const releaseOrderAfterCollapse = () => {
    clearTimeout(releaseOrderTimer);
    releaseOrderTimer = setTimeout(() => {
      if (group.matches(':hover, :focus-within') || group.classList.contains('is-pointer-active')) return;
      buttons().forEach((button) => button.style.removeProperty('order'));
    }, 200);
  };

  group.addEventListener('pointerenter', lockOrder);
  group.addEventListener('pointerleave', releaseOrderAfterCollapse);
  group.addEventListener('focusin', lockOrder);
  group.addEventListener('focusout', releaseOrderAfterCollapse);
}


/** Selects a library or folder and refreshes the collection view. */
function selectCollection(collectionId) {
  if (activeCollectionId === 'all' || activeCollectionView === 'watchlist') folderReturnView = activeCollectionView;
  activeCollectionId = collectionId;
  activeCollectionView = 'logged';
  collectionPage = 0;
  animateWorkspaceEntryRefresh = true;
  updateViewTabs();
  renderWithoutScrollCollapse();
  if (typeof updateNavbarPageContext === 'function') updateNavbarPageContext();
}

/** Deletes a folder and removes its ID from entries. */
function deleteCollection(folder) {
  if (!confirm(`Delete the “${folder.name}” collection? Its titles will remain in Logged.`)) return;
  customCollections = customCollections.filter((item) => item.id !== folder.id);
  [entries, watchlist].forEach((items) => {
    items.forEach((entry) => {
      const collectionIds = entryCollectionIds(entry).filter((id) => id !== folder.id);
      if (collectionIds.length) entry.collectionIds = collectionIds;
      else delete entry.collectionIds;
      delete entry.collectionId;
    });
  });
  if (activeCollectionId === folder.id) activeCollectionId = 'all';
  save();
  render();
  if (typeof updateNavbarPageContext === 'function') updateNavbarPageContext();
}

/** Starts the create-folder flow. */
function createCollection() {
  const collectionDialog = $('#collection-dialog');
  const nameInput = $('#collection-name');
  if (collectionDialog && nameInput) {
    nameInput.value = '';
    collectionDialog.showModal();
    nameInput.focus();
    return;
  }
  const name = window.prompt('Name this collection:')?.trim();
  finishCreateCollection(name);
}

/** Validates and creates a folder from the entered name. */
function finishCreateCollection(name) {
  name = name?.trim();
  if (!name) return;
  const existing = customCollections.find((folder) => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing) activeCollectionId = existing.id;
  else {
    const folder = { id: crypto.randomUUID(), name };
    customCollections.push(folder);
    activeCollectionId = folder.id;
    save();
  }
  activeCollectionView = 'logged';
  updateViewTabs();
  render();
  if (typeof updateNavbarPageContext === 'function') updateNavbarPageContext();
}

let folderPickerEntry = null;

/** Opens the folder assignment picker for an entry. */
function openFolderPicker(entry) {
  folderPickerEntry = entry;
  const popover = $('#folder-popover');
  const list = $('#folder-popover-list');
  list.replaceChildren();
  if (!customCollections.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Create a collection from Logged first.';
    list.append(empty);
  } else {
    const selectedIds = entryCollectionIds(entry);
    customCollections.forEach((folder) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = folder.id;
      input.checked = selectedIds.includes(folder.id);
      input.addEventListener('change', saveFolderPickerSelection);
      label.append(input, document.createTextNode(folder.name));
      list.append(label);
    });
  }
  const button = document.activeElement;
  const rect = button.getBoundingClientRect();
  popover.hidden = false;
  popover.style.left = `${Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12)}px`;
  popover.style.top = `${rect.bottom + 8}px`;
}

/** Saves the selected folder assignments for the entry. */
function saveFolderPickerSelection() {
  if (!folderPickerEntry) return;
  folderPickerEntry.collectionIds = [...document.querySelectorAll('#folder-popover-list input:checked')].map((input) => input.value);
  delete folderPickerEntry.collectionId;
  save();
}

/** Closes the folder assignment picker. */
function closeFolderPicker() {
  $('#folder-popover').hidden = true;
  folderPickerEntry = null;
}

document.addEventListener('click', (event) => {
  if (folderPickerEntry && !event.target.closest('.folder-popover') && !event.target.closest('.action-folder')) closeFolderPicker();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && folderPickerEntry) closeFolderPicker();
});

$('#collection-form')?.addEventListener('submit', (event) => {
  if (event.submitter?.value !== 'create') return;
  event.preventDefault();
  const dialog = $('#collection-dialog');
  finishCreateCollection($('#collection-name').value);
  dialog.close();
});

/** Removes an entry from the library or watchlist. */
function removeEntry(entry, isWatchlist) {
  if (!confirm(`Remove “${entry.title}”?`)) return;

  if (isWatchlist) watchlist = watchlist.filter((item) => item.id !== entry.id);
  else {
    entries = entries.filter((item) => item.id !== entry.id);
    bannerIndex = 0;
  }
  save();
  render();
}

/** Checks whether an entry matches the current search query. */
function matchesCollectionSearch(entry, query) {
  if (!activeFilters.includes(entry.type)) return false;
  if (!query) return true;

  return [
    entry.title,
    entry.type,
    entry.category,
    entry.year,
    entry.notes,
    ...(entry.watches || []).map((watch) => watch.notes),
  ].join(' ').toLocaleLowerCase().includes(query);
}

/** Refreshes filter and sort controls for the active collection. */
function updateCollectionTools(isWatchlist) {
  const typeWrapper = $('.nav-type-menu');
  if (typeWrapper) {
    const trigger = getWorkspaceFilterButton(typeWrapper);
    const activeTypes = activeFilters;
    const mixedTypesSelected = isMixedWorkspaceTypeSelection(activeTypes);
    typeWrapper.querySelectorAll('.menu-option').forEach((button) => {
      const isMixedOption = button.dataset.filter === 'mixed';
      const selected = !isMixedOption && activeTypes.includes(button.dataset.filter);
      button.hidden = isMixedOption ? mixedTypesSelected : (!mixedTypesSelected && selected);
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
      const iconName = isMixedOption ? 'all' : mediaTypeIconName(button.dataset.filter);
      const optionIcon = button.querySelector(':scope > button');
      if (optionIcon) {
        optionIcon.dataset.typeIcon = iconName;
        const iconMask = `url("${appIconUrl(iconName)}")`;
        optionIcon.style.setProperty('--nav-type-icon-mask', iconMask);
      }
    });
    const selectedOptions = [...typeWrapper.querySelectorAll('.menu-option')]
      .filter((button) => activeTypes.includes(button.dataset.filter));
    const accessibleLabel = mixedTypesSelected
      ? 'Mixed'
      : selectedOptions[0]?.querySelector('.menu-option-label')?.textContent.trim() || 'Mixed';
    const typeStateClass = activeTypes.length === 1 ? `is-${String(activeTypes[0]).toLowerCase()}` : '';
    trigger.classList.remove('is-movie', 'is-show', 'is-game', 'is-book');
    if (typeStateClass) trigger.classList.add(typeStateClass);
    trigger.classList.toggle('is-mixed', mixedTypesSelected);
    const typeButtonText = trigger;
    const selectedOption = selectedOptions[0];
    const iconName = mixedTypesSelected ? 'all' : mediaTypeIconName(selectedOption?.dataset.filter);
    const colorToken = mixedTypesSelected ? null : {
      Movie: '--color-media-film',
      Show: '--color-media-show',
      Game: '--color-media-game',
      Book: '--color-media-book',
    }[selectedOption?.dataset.filter];
    const selectedIcon = typeButtonText.querySelector(':scope > .icon-button');
    selectedIcon.dataset.typeIcon = iconName;
    selectedIcon.style.setProperty('--nav-type-icon-mask', `url("${appIconUrl(iconName)}")`);
    if (colorToken) selectedIcon.style.setProperty('--nav-type-icon-color', `var(${colorToken})`);
    else selectedIcon.style.setProperty('--nav-type-icon-color', 'var(--palette-white)');
    typeButtonText.querySelector(':scope > .menu-option-label').textContent = accessibleLabel;
    updateNavTypeMenuClosedWidth(typeWrapper);
    trigger.setAttribute('aria-label', `Entry type: ${accessibleLabel}`);
    trigger.classList.toggle('active', !mixedTypesSelected);
  }
  document.querySelectorAll('.logged-collection-tool').forEach((control) => {
    control.hidden = isWatchlist;
  });

  const yearSelect = $('#release-year-filter');
  const yearFilterLabel = 'Filter by release year';
  yearSelect.setAttribute('aria-label', yearFilterLabel);
  const activeCollectionItems = isWatchlist ? watchlist : activeCollectionId === 'all'
    ? entries
    : [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))];
  const availableYears = [...new Set(activeCollectionItems
    .map((entry) => String(entry.year || '')).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  releaseYearFilter = releaseYearFilter.filter((year) => availableYears.includes(year));
  yearSelect.replaceChildren(...availableYears.map((year) => new Option(year, year, false, releaseYearFilter.includes(year))));
  yearSelect.classList.toggle('active', releaseYearFilter.length > 0);
  syncWorkspaceFilterMenu(yearSelect);
  const valueSelect = $('#collection-value-filter');
  const hasActiveValueFilter = isWatchlist ? priorityFilter.length > 0 : !isDefaultRatingRange(ratingFilter);
  const valueOptions = isWatchlist
    ? [5, 4, 3, 2, 1].map((priority) => new Option(`P${priority}`, String(priority), false, priorityFilter.includes(priority)))
    : Array.from({ length: 21 }, (_, index) => 100 - index * 5)
      .map((rating) => new Option(formatRatingChipValue(rating), String(rating), false, ratingFilter.includes(rating)));
  const valueLabel = isWatchlist ? 'priority' : 'rating';
  valueSelect.setAttribute('aria-label', `Filter by ${valueLabel}`);
  valueSelect.replaceChildren(...valueOptions);
  valueSelect.classList.toggle('active', hasActiveValueFilter);
  syncWorkspaceFilterMenu(valueSelect);

  const sortSelect = $('#collection-sort');
  const selectedSort = /^(watched|recent|rating|priority|title|release)-(asc|desc)$/.exec(collectionSort);
  const directionFor = (key, defaultDirection) => selectedSort?.[1] === key ? selectedSort[2] : defaultDirection;
  const choices = isWatchlist
    ? [[`priority-${directionFor('priority', 'desc')}`, 'Priority'], [`recent-${directionFor('recent', 'desc')}`, 'Logged'], [`title-${directionFor('title', 'asc')}`, 'Title'], [`release-${directionFor('release', 'desc')}`, 'Release']]
    : [[`watched-${directionFor('watched', 'desc')}`, 'Watched'], [`recent-${directionFor('recent', 'desc')}`, 'Logged'], [`rating-${directionFor('rating', 'desc')}`, 'Rating'], [`title-${directionFor('title', 'asc')}`, 'Title'], [`release-${directionFor('release', 'desc')}`, 'Release']];
  if (!choices.some(([value]) => value === collectionSort)) {
    collectionSort = isWatchlist ? 'priority-desc' : 'watched-desc';
  }
  sortSelect.replaceChildren(...choices.map(([value, label]) => new Option(label, value)));
  sortSelect.value = collectionSort;
  const defaultSort = isWatchlist ? 'priority-desc' : 'watched-desc';
  sortSelect.classList.toggle('active', collectionSort !== defaultSort);
  const resetAll = $('#workspace-reset-button');
  if (resetAll) {
    const hasActiveSettings = Boolean(
      releaseYearFilter.length || hasActiveValueFilter || collectionSort !== defaultSort
    );
    resetAll.disabled = !hasActiveSettings;
    resetAll.classList.toggle('is-active', hasActiveSettings);
  }
  syncWorkspaceFilterMenu(sortSelect);
}

/** Treat the full 100-to-0 rating span as the unfiltered default. */
function isDefaultRatingRange(values) {
  return values.length === 2 && Math.min(...values) === 0 && Math.max(...values) === 100;
}

/** Checks whether an entry passes the active collection filters. */
function matchesCollectionFilters(entry, isWatchlist) {
  if (activeCollectionView === 'logged' && activeCollectionId !== 'all' && !entryCollectionIds(entry).includes(activeCollectionId)) return false;
  if (releaseYearFilter.length) {
    const year = Number(entry.year || 0);
    const minYear = Math.min(...releaseYearFilter.map(Number));
    const maxYear = Math.max(...releaseYearFilter.map(Number));
    if (year < minYear || year > maxYear) return false;
  }
  if (isWatchlist) {
    if (priorityFilter.length && !priorityFilter.includes(Number(entry.priority || 3))) return false;
    return true;
  }
  if (ratingFilter.length && !isDefaultRatingRange(ratingFilter)) {
    const score = Math.round(Number(latest(entry).score) * 10);
    const minRating = Math.min(...ratingFilter);
    const maxRating = Math.max(...ratingFilter);
    if (score < minRating || score > maxRating) return false;
  }
  return true;
}

/** Sorts collection entries using the active sort option. */
function sortCollectionItems(items, isWatchlist) {
  return items.map((entry, index) => ({ entry, index })).sort((left, right) => {
    const a = left.entry;
    const b = right.entry;
    const [sortKey, direction] = collectionSort.split('-');
    const directionFactor = direction === 'asc' ? 1 : -1;
    if (sortKey === 'title') return a.title.localeCompare(b.title) * directionFactor || left.index - right.index;
    if (sortKey === 'release') return (Number(a.year || 0) - Number(b.year || 0)) * directionFactor || left.index - right.index;
    if (isWatchlist && sortKey === 'priority') return (Number(a.priority || 3) - Number(b.priority || 3)) * directionFactor || left.index - right.index;
    if (!isWatchlist && sortKey === 'rating') return (Number(a.watches?.[0]?.score || 0) - Number(b.watches?.[0]?.score || 0)) * directionFactor || left.index - right.index;
    if (!isWatchlist && ['watched-desc', 'watched-asc'].includes(collectionSort)) {
      const newestDate = (entry) => (entry.watches || []).map((watch) => watch.date || '').sort().at(-1) || '';
      const dateOrder = newestDate(a).localeCompare(newestDate(b));
      return (collectionSort === 'watched-desc' ? -dateOrder : dateOrder) || left.index - right.index;
    }
    if (['recent-desc', 'recent-asc'].includes(collectionSort)) {
      return collectionSort === 'recent-desc' ? left.index - right.index : right.index - left.index;
    }
    return left.index - right.index;
  }).map(({ entry }) => entry);
}

/** Returns every item matching the active workspace view and filters. */
function getFilteredCollectionItems() {
  const isWatchlist = activeCollectionView === 'watchlist';
  const showingFolder = !isWatchlist && activeCollectionId !== 'all';
  const items = isWatchlist ? watchlist : showingFolder
    ? [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))]
    : entries;
  const query = $('.collection-search-container > .search-input').value.trim().toLocaleLowerCase();

  return sortCollectionItems(
    items.filter((entry) => {
      const entryIsWatchlist = watchlist.includes(entry);
      return matchesCollectionSearch(entry, query) && matchesCollectionFilters(entry, entryIsWatchlist);
    }),
    isWatchlist,
  );
}

/** Updates type counts from the active search, filters, and collection view. */
function updateWorkspaceTypeCounts(items) {
  const counts = new Map(workspaceMediaTypes.map((type) => [type, 0]));
  items.forEach((entry) => {
    const matchingType = workspaceMediaTypes.find(
      (type) => type.toLocaleLowerCase() === String(entry.type || '').toLocaleLowerCase(),
    );
    if (matchingType) counts.set(matchingType, counts.get(matchingType) + 1);
  });

  const visibleTypeCount = [...counts.values()].filter((count) => count > 0).length;
  const countItems = document.querySelectorAll('.workspace-type-count');
  let hasVisibleCounts = false;
  countItems.forEach((item) => {
    const type = item.dataset.mediaType;
    const count = type === 'Mixed'
      ? (visibleTypeCount > 1 ? items.length : 0)
      : (counts.get(type) || 0);
    hasVisibleCounts ||= count > 0;
    item.hidden = count === 0;
    item.querySelector('.workspace-type-count-value').textContent = String(count);
    item.querySelector('.workspace-type-count-icon').innerHTML = appIconMarkup(
      type === 'Mixed' ? 'all' : mediaTypeIconName(type),
      'icon',
    );
  });
  const countGroup = document.querySelector('.workspace-type-counts-layout')?.closest('.workspace-control-group');
  const controls = countGroup?.parentElement;
  if (countGroup) {
    countGroup.hidden = !hasVisibleCounts;
    controls.classList.toggle('has-type-counts', hasVisibleCounts);
  }
}

/** Updates page controls and counts for the visible collection. */
function updateCollectionPaginationControls() {
  const pagination = $('.workspace-controls-container > .workspace-control-group > .pagination-container');
  const status = pagination.querySelector('.pagination-text-container');
  pagination.hidden = false;
  status.firstElementChild.textContent = `${collectionPage + 1}`;
  status.lastElementChild.textContent = `${collectionPageCount}`;
  pagination.querySelector('.pagination-prev-button').disabled = collectionPage === 0;
  pagination.querySelector('.pagination-next-button').disabled = collectionPage >= collectionPageCount - 1;
}

function updateCollectionPagination(totalItems, pageSize) {
  collectionPageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  collectionPage = Math.min(collectionPage, collectionPageCount - 1);
  updateCollectionPaginationControls();
}

if (isReworkedCollection) {
  collection.addEventListener('scroll', () => {
    if (!collection.clientWidth) return;
    const page = Math.min(
      collectionPageCount - 1,
      Math.max(0, Math.round(collection.scrollLeft / collection.clientWidth)),
    );
    if (page === collectionPage) return;
    collectionPage = page;
    updateCollectionPaginationControls();
    bannerIndex = 0;
    renderBanner();
  }, { passive: true });
}

/** Moves the collection to an adjacent page. */
function changeCollectionPage(direction) {
  const nextPage = Math.max(0, Math.min(collectionPage + direction, collectionPageCount - 1));
  if (nextPage === collectionPage) return false;
  if (isReworkedCollection) {
    collectionPage = nextPage;
    collection.scrollTo({ left: nextPage * collection.clientWidth, behavior: 'smooth' });
    updateCollectionPaginationControls();
    bannerIndex = 0;
    renderBanner();
    return true;
  }
  collectionPageDirection = direction;
  collectionPage = nextPage;
  renderCollection();
  return true;
}

/** Recalculates collection layout and paging after a resize. */
function handleCollectionResize() {
  const columns = getCollectionColumnCount();
  const rows = getCollectionRowCount();
  const viewportWidth = collection.clientWidth;
  if (!collectionColumnCount) {
    collectionColumnCount = columns;
    collectionRowCount = rows;
    collectionViewportWidth = viewportWidth;
    return;
  }
  if (columns === collectionColumnCount && rows === collectionRowCount) {
    if (isReworkedCollection && viewportWidth !== collectionViewportWidth) {
      collectionViewportWidth = viewportWidth;
      collection.scrollLeft = collectionPage * viewportWidth;
    }
    return;
  }

  collectionColumnCount = columns;
  collectionRowCount = rows;
  collectionViewportWidth = viewportWidth;
  collectionPage = 0;
  const pageScroll = collection.scrollTop;
  const documentScroll = window.scrollY;
  renderCollection();
  requestAnimationFrame(() => {
    collection.scrollTop = pageScroll;
    window.scrollTo(0, documentScroll);
  });
}

// Recompute list capacity when the app-content viewport settles or changes size.
const collectionResizeObserver = new ResizeObserver(handleCollectionResize);
collectionResizeObserver.observe(collection);

/** Builds the card markup and actions for one entry. */
function createEntryCard(entry, isBacklogged, sourceView = activeCollectionView) {
  const watch = isBacklogged ? null : latest(entry);
  const isReworkPreview = document.documentElement.dataset.cssReworkPreview === 'true';
  const cardLayout = document.createElement('div');
  cardLayout.className = 'entry-card-layout';
  cardLayout.addEventListener('pointerenter', () => cardLayout.classList.remove('is-hover-leaving'));
  cardLayout.addEventListener('pointerleave', () => {
    if (reduceAnimationsEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cardLayout.classList.add('is-hover-leaving');
  });
  cardLayout.addEventListener('animationend', (event) => {
    if (event.animationName === 'workspace-entry-hover-out') cardLayout.classList.remove('is-hover-leaving');
  });
  cardLayout.addEventListener('animationcancel', (event) => {
    if (event.animationName === 'workspace-entry-hover-out') cardLayout.classList.remove('is-hover-leaving');
  });
  const card = document.createElement('article');
  card.className = `${isReworkPreview ? 'entry-container banner-container' : 'workspace-content-entry'} level-2-styling entry ${isBacklogged ? 'is-backlogged' : 'is-logged'}`;
  if (isReworkPreview && entry.poster) {
    const posterSource = entry.poster;
    card.dataset.posterPaletteSource = posterSource;
    let paletteRequested = false;
    const requestCardPalette = () => {
      if (document.documentElement.dataset.entryPosterBackdrop !== 'on') return;
      if (paletteRequested) return;
      paletteRequested = true;
      getPosterPalette(posterSource).then((palette) => {
        if (!palette || !card.isConnected || card.dataset.posterPaletteSource !== posterSource) return;
        card.style.setProperty('--entry-poster-color-one', `rgb(${palette.pageOne.join(', ')})`);
        card.style.setProperty('--entry-poster-color-two', `rgb(${palette.pageTwo.join(', ')})`);
      });
    };
    card.addEventListener('pointerenter', requestCardPalette, { once: true });
    card.addEventListener('focusin', requestCardPalette, { once: true });
  }

  const link = document.createElement('a');
  link.className = `${isReworkPreview ? 'workspace-banner-link' : 'workspace-content-entry-link'} entry-link`;
  link.href = `#entry/${sourceView}/${encodeURIComponent(entry.id)}`;
  link.setAttribute('aria-label', `Open ${entry.title} details`);
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openEntryFromCard(card, link.href);
  });
  const poster = posterElement(entry, `${isReworkPreview ? 'banner-poster' : 'workspace-content-entry-poster'} entry-poster`);
  card.append(link, poster);

  const info = document.createElement('div');
  info.className = `${isReworkPreview ? 'banner-info-layout' : 'workspace-content-entry-detail'} entry-info`;
  const header = document.createElement('div');
  header.className = 'entry-header';
  const details = document.createElement('div');
  details.className = 'entry-details';

  const tag = document.createElement('span');
  tag.className = isReworkPreview
    ? 'category-chip-styling banner-category-chip'
    : 'workspace-content-entry-detail-tagChip entry-tag';
  if (entry.category && entry.category.toLowerCase() !== entry.type.toLowerCase()) {
    tag.textContent = entry.category;
    tag.style.setProperty('--category-hue', categoryHueForName(entry.category));
  }
  else {
    tag.classList.add('entry-tag-placeholder');
    if (isReworkPreview) tag.classList.add('is-placeholder');
    tag.setAttribute('aria-hidden', 'true');
    tag.textContent = 'Genre';
  }

  const title = document.createElement('h3');
  title.className = isReworkPreview
    ? 'banner-title'
    : 'workspace-content-entry-detail-title';
  title.textContent = entry.title;
  const heading = document.createElement('div');
  heading.className = 'banner-heading-layout';
  heading.append(title);
  const label = document.createElement('div');
  label.className = isReworkPreview
    ? 'banner-labels-layout'
    : 'entry-type';
  let mediaIcon;
  if (isReworkPreview) {
    const mediaType = entry.type.toLowerCase();
    mediaIcon = document.createElement('span');
    mediaIcon.className = `text-chip-styling media-type-icon banner-type is-${mediaType}`;
    mediaIcon.setAttribute('role', 'img');
    mediaIcon.setAttribute('aria-label', entry.type);
    mediaIcon.innerHTML = appIconMarkup(mediaTypeIconName(entry.type), 'icon');
    label.append(tag);
  } else {
    label.textContent = entry.type;
  }
  if (entry.year) {
    const year = document.createElement('span');
    year.className = isReworkPreview
      ? 'text-chip-styling banner-release-date-chip'
      : 'workspace-content-entry-detail-year entry-year';
    if (isReworkPreview) {
      year.innerHTML = appIconMarkup('release', 'icon banner-release-date-icon');
      const yearLabel = document.createElement('span');
      yearLabel.className = 'banner-release-date-label';
      yearLabel.textContent = entry.year;
      year.append(yearLabel);
    } else {
      year.textContent = entry.year;
    }
    label.append(year);
  }
  if (isReworkPreview && watch) {
    const date = document.createElement('span');
    date.className = 'text-chip-styling banner-log-date-chip';
    date.innerHTML = appIconMarkup('watched', 'icon banner-log-date-icon');
    const dateLabel = document.createElement('span');
    dateLabel.className = 'banner-log-date-label';
    dateLabel.textContent = formatDate(watch.date);
    date.append(dateLabel);
    label.append(date);
  }
  if (isReworkPreview) {
    label.append(mediaIcon);
    if (entry.director) {
      const director = document.createElement('span');
      director.className = 'banner-director';
      director.textContent = `By ${entry.director}`;
      heading.append(director);
    }
    info.append(label, heading);
  } else {
    header.append(tag, label, title);
  }

  const meta = document.createElement('div');
  if (isReworkPreview) meta.className = 'banner-meta-layout';
  const fullscreen = iconButton(
    `Open ${entry.title} fullscreen`,
    'Fullscreen',
    () => openEntryFromCard(card, `#entry/${sourceView}/${encodeURIComponent(entry.id)}/full`),
    isReworkPreview ? 'action-fullscreen' : 'entry-open-fullscreen',
    isReworkPreview,
  );
  if (isReworkPreview) {
    fullscreen.classList.remove('level-2-styling');
    fullscreen.classList.add('text-chip-styling');
  }

  if (watch) {
    const score = document.createElement('div');
    score.className = isReworkPreview
      ? 'banner-value-layout'
      : 'workspace-content-entry-detail-rating entry-score entry-rating-with-star';
    const scoreFill = `${Number(watch.score) * 10}%`;
    const scoreColor = ratingColorForScore(watch.score);
    const scoreValue = document.createElement('span');
    scoreValue.className = isReworkPreview
      ? 'value-chip-styling rating-value-chip banner-ratings-chip'
      : 'workspace-content-entry-detail-ratingChip valueChip ratingValueChip rating-valueChip';
    scoreValue.textContent = formatRatingChipValue(Number(watch.score) * 10);
    scoreValue.style.setProperty('--rating-color', scoreColor);
    const meterClass = isReworkPreview
      ? 'ratings-meter ratings-bar'
      : 'workspace-content-entry-detail-ratingsMeter ratingsMeter';
    score.append(scoreValue, createRatingMeter(scoreFill, scoreColor, meterClass));
    score.setAttribute('aria-label', `Rating ${Number(watch.score).toFixed(1)} out of 10`);
    if (isReworkPreview) {
      meta.append(score, fullscreen);
    } else {
      const date = document.createElement('div');
      date.className = 'workspace-content-entry-detail-date entry-date';
      date.textContent = `Watched ${formatDate(watch.date)}`;
      details.append(score, date);
    }
  } else if (isBacklogged) {
    const priority = Math.min(5, Math.max(1, Number(entry.priority) || 3));
    const priorityColor = priorityColorForValue(priority);
    const indicator = document.createElement('div');
    indicator.className = isReworkPreview
      ? 'priority-dots'
      : 'workspace-content-entry-detail-priorityDots entry-priority priorityDots';
    indicator.dataset.priority = priority;
    indicator.style.setProperty('--priority-color', priorityColor);
    indicator.setAttribute('aria-label', `Priority ${priority} out of 5`);
    for (let dot = 1; dot <= 5; dot++) {
      const marker = document.createElement('span');
      marker.classList.toggle('is-filled', dot <= priority);
      indicator.append(marker);
    }
    if (isReworkPreview) {
      const value = document.createElement('div');
      value.className = 'banner-value-layout';
      const priorityValue = document.createElement('span');
      priorityValue.className = 'value-chip-styling priority-value-chip';
      priorityValue.textContent = `P${priority}`;
      priorityValue.style.setProperty('--priority-color', priorityColor);
      value.append(priorityValue, indicator);
      meta.append(value, fullscreen);
    }
    else details.append(indicator);
  }

  if (isReworkPreview && !fullscreen.parentElement) meta.append(fullscreen);

  const actions = document.createElement('div');
  actions.className = 'entry-actions';
  const actionList = isBacklogged
    ? [['Edit', () => openDialog(entry.id, false, null, true, 'watchlist')], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, true)]]
    : [['Edit', () => openDialog(entry.id, false, null, true)], ['Rewatch', () => openDialog(entry.id, true)], ['Folder', () => openFolderPicker(entry)], ['Remove', () => removeEntry(entry, false)]];

  actionList.forEach(([label, action]) => {
    const buttonLabel = label === 'Folder' ? `Add ${entry.title} to folder` : `${label} ${entry.title}`;
    const button = iconButton(buttonLabel, label, action, `action-${label.toLowerCase()}`, isReworkPreview);
    if (isReworkPreview) {
      button.classList.remove('level-2-styling');
      button.classList.add('level-3-styling');
    }
    if (label === 'Remove') button.classList.add('remove-button');
    actions.append(button);
  });

  if (isReworkPreview) {
    info.append(meta);
  } else {
    info.append(header, details);
  }
  const tools = document.createElement('div');
  tools.className = 'entry-card-tools';
  if (isReworkPreview) tools.append(...actions.children);
  else tools.append(actions, fullscreen);
  if (isReworkPreview) {
    tools.addEventListener('click', () => setEntryCardToolsOpen(cardLayout, false));
    card.append(info);
    cardLayout.append(card, tools);
    return cardLayout;
  }
  card.append(info, tools);
  return card;
}

/** Opens an entry with the shared transition when enabled. */
function openEntryFromCard(card, destination) {
  if (card.classList.contains('is-opening')) return;
  const hash = destination.startsWith('#') ? destination : new URL(destination).hash;
  if (reduceAnimationsEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    location.hash = hash;
    return;
  }
  card.classList.add('is-opening');
  window.setTimeout(() => {
    card.classList.remove('is-opening');
    location.hash = hash;
  }, 60);
}

/** Opens the first visible result when Enter is pressed in the collection search. */
$('.collection-search-container > .search-input').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.isComposing) return;
  const firstCard = collection.querySelector('.entry');
  if (!firstCard) return;

  event.preventDefault();
  const link = firstCard.querySelector('.entry-link');
  if (link) openEntryFromCard(firstCard, link.href);
});

/** Moves keyboard focus through visible entry cards using the arrow keys. */
collection.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  const currentCard = event.target.closest('.entry');
  if (!currentCard || !collection.contains(currentCard)) return;

  const cards = [...collection.querySelectorAll('.entry')];
  const currentIndex = cards.indexOf(currentCard);
  const columns = getCollectionColumnCount();
  const indexDelta = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
  }[event.key];
  const nextCard = cards[currentIndex + indexDelta];
  if (!nextCard) return;

  event.preventDefault();
  nextCard.querySelector('.entry-link')?.focus({ preventScroll: true });
});

/** Filters, sorts, pages, and renders the active collection. */
function renderCollection() {
  const appPage = document.documentElement.dataset.appPage || 'home';
  const isWorkspacePage = ['logged', 'backlogged', 'folders'].includes(appPage);
$('.workspace-section').hidden = document.documentElement.dataset.appPage === 'statistics';
  const isWatchlist = activeCollectionView === 'watchlist';
  renderCollectionPicker();
  updateCollectionTools(isWatchlist);
  const query = $('.collection-search-container > .search-input').value.trim().toLocaleLowerCase();
  const sourceItems = isWatchlist ? watchlist : activeCollectionId === 'all'
    ? entries
    : [...entries, ...watchlist.filter((entry) => entryCollectionIds(entry).includes(activeCollectionId))];
  const shown = getFilteredCollectionItems();
  updateWorkspaceTypeCounts(shown);
  const enteringWorkspacePage = isReworkedCollection
    && (
      (isWorkspacePage && appPage !== lastRenderedAppPage)
      || animateWorkspaceEntryRefresh
      || (isWorkspacePage && lastRenderedWorkspaceEntryCount === 0 && shown.length > 0)
    )
    && !reduceAnimationsEnabled;
  animateWorkspaceEntryRefresh = false;
  lastRenderedAppPage = appPage;
  if (isWorkspacePage) lastRenderedWorkspaceEntryCount = shown.length;
  const watchlistEmpty = $('#watchlist-empty');
  const empty = $('#empty');
  const hasCollectionFilter = activeFilters.length < workspaceMediaTypes.length
    || releaseYearFilter.length > 0
    || (isWatchlist ? priorityFilter.length > 0 : !isDefaultRatingRange(ratingFilter));

  $('.workspace-create-entry-button').setAttribute('aria-label', isWatchlist ? 'Add to watchlist' : 'Log a watch');
  watchlistEmpty.hidden = !isWatchlist || sourceItems.length > 0 || Boolean(query) || hasCollectionFilter;
  empty.hidden = shown.length > 0 || !watchlistEmpty.hidden;
  if (query || hasCollectionFilter) {
    empty.textContent = 'No titles match your search or filters.';
  } else if (sourceItems.length) {
    empty.textContent = 'No titles match this filter.';
  } else if (isWatchlist) {
    empty.textContent = 'Nothing on your watchlist yet.';
  } else {
    empty.textContent = 'Nothing here yet. Log the first thing you watched.';
  }

  const columns = getCollectionColumnCount();
  collectionColumnCount = columns;
  const rows = getCollectionRowCount();
  collectionRowCount = rows;
  const pageSize = columns * rows;
  updateCollectionPagination(shown.length, pageSize);
  collection.replaceChildren();
  const enteringCards = [];
  const appendEntryCard = (target, entry, revealDelay = null) => {
    const entryIsWatchlist = watchlist.includes(entry);
    const sourceView = entryIsWatchlist ? 'watchlist' : 'logged';
    const cardLayout = createEntryCard(entry, entryIsWatchlist, sourceView);
    if (revealDelay !== null) {
      cardLayout.classList.add('is-enter-pending');
      cardLayout.style.setProperty('--entry-reveal-delay', `${revealDelay}ms`);
      enteringCards.push(cardLayout);
    }
    target.append(cardLayout);
  };
  if (isReworkedCollection) {
    for (let pageIndex = 0; pageIndex < collectionPageCount; pageIndex++) {
      const page = document.createElement('div');
      page.className = 'workspace-content-page';
      shown.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
        .forEach((entry, index) => appendEntryCard(
          page,
          entry,
          enteringWorkspacePage && pageIndex === collectionPage
            ? (Math.floor(index / columns) + (index % columns)) * 78
            : null,
        ));
      collection.append(page);
    }
    collection.scrollLeft = collectionPage * collection.clientWidth;
  } else {
    const pageStart = collectionPage * pageSize;
    shown.slice(pageStart, pageStart + pageSize)
      .forEach((entry) => appendEntryCard(collection, entry));
  }

  if (enteringCards.length) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      enteringCards.forEach((card) => {
        if (card.isConnected) card.classList.replace('is-enter-pending', 'is-entering');
      });
    }));
  }

  collection.classList.remove('page-enter-forward', 'page-enter-backward');
  if (!isReworkedCollection && collectionPageDirection && collectionPageCount > 1) {
    void collection.offsetWidth;
    collection.classList.add(collectionPageDirection > 0 ? 'page-enter-forward' : 'page-enter-backward');
    collection.onanimationend = (event) => {
      if (!event.animationName.startsWith('collection-page-')) return;
      collection.classList.remove('page-enter-forward', 'page-enter-backward');
    };
  }
  collectionPageDirection = 0;

  requestAnimationFrame(() => {
    // A second pass accounts for fonts and images changing card dimensions.
    requestAnimationFrame(() => collectionColumnCount = getCollectionColumnCount());
  });
  renderStatsbar();
  if (isReworkedCollection) renderBanner();
}

// Listen on the whole library card so trackpad swipes work over the toolbar and cards.
$('.workspace-section').addEventListener('wheel', (event) => {
  if (isReworkedCollection) return;
  if (collectionPageCount < 2) return;

  const now = performance.now();
  if (now - collectionSwipeLastEventAt > 140) {
    collectionSwipeDistance = 0;
    collectionSwipeLocked = false;
    collectionSwipeLockedDirection = 0;
    collectionSwipeReverseDistance = 0;
    collectionSwipeQuietEvents = 0;
    collectionSwipePeakDelta = 0;
    collectionSwipeReversePeakDelta = 0;
    collectionSwipeSettled = false;
  }
  collectionSwipeLastEventAt = now;

  const horizontalDelta = event.shiftKey && Math.abs(event.deltaX) < 1
    ? event.deltaY
    : event.deltaX;
  const verticalDelta = event.shiftKey ? 0 : event.deltaY;
  const horizontalMagnitude = Math.abs(horizontalDelta);
  if (collectionSwipeLocked
    && Math.abs(verticalDelta) < 8
    && horizontalMagnitude <= Math.max(6, collectionSwipePeakDelta * 0.2)) {
    collectionSwipeDistance = 0;
    collectionSwipeReverseDistance = 0;
    collectionSwipeQuietEvents++;
    if (collectionSwipeQuietEvents >= 3) collectionSwipeSettled = true;
    return;
  }
  collectionSwipeQuietEvents = 0;

  if (Math.abs(horizontalDelta) < 2 || Math.abs(horizontalDelta) < Math.abs(verticalDelta) * 0.72) {
    collectionSwipeDistance = 0;
    return;
  }

  const swipeDirection = Math.sign(horizontalDelta);
  if (collectionSwipeLocked) {
    event.preventDefault();
    if (swipeDirection === collectionSwipeLockedDirection) {
      collectionSwipeReverseDistance = 0;
      collectionSwipeReversePeakDelta = 0;
      // A new, deliberate same-direction swipe has a fresh strong delta after
      // the previous gesture's momentum has tapered off. Re-arm on that
      // rebound, rather than requiring pointer movement or a long idle pause.
      if (!collectionSwipeSettled
        || horizontalMagnitude < Math.max(18, collectionSwipePeakDelta * 0.75)) return;
      collectionSwipeLocked = false;
      collectionSwipeLockedDirection = 0;
      collectionSwipeDistance = 0;
      collectionSwipePeakDelta = horizontalMagnitude;
      collectionSwipeReversePeakDelta = 0;
      collectionSwipeSettled = false;
    } else {
      // Only treat a direction change as a new swipe once it has its own
      // threshold-sized movement, so trackpad momentum wobble cannot skip pages.
      collectionSwipeReverseDistance += horizontalDelta;
      collectionSwipeReversePeakDelta = Math.max(collectionSwipeReversePeakDelta, horizontalMagnitude);
      if (Math.abs(collectionSwipeReverseDistance) < 52) return;

      const reverseDirection = Math.sign(collectionSwipeReverseDistance);
      changeCollectionPage(reverseDirection);
      collectionSwipeLockedDirection = reverseDirection;
      collectionSwipeReverseDistance = 0;
      collectionSwipePeakDelta = collectionSwipeReversePeakDelta;
      collectionSwipeReversePeakDelta = 0;
      collectionSwipeSettled = false;
      return;
    }
  }

  collectionSwipeDistance += horizontalDelta;
  collectionSwipePeakDelta = Math.max(collectionSwipePeakDelta, horizontalMagnitude);
  if (Math.abs(collectionSwipeDistance) < 52) return;

  const direction = Math.sign(collectionSwipeDistance);
  const changedPage = changeCollectionPage(direction);
  collectionSwipeDistance = 0;
  collectionSwipeLocked = true;
  collectionSwipeLockedDirection = direction;
  collectionSwipeReverseDistance = 0;
  collectionSwipeQuietEvents = 0;
  collectionSwipeReversePeakDelta = 0;
  collectionSwipeSettled = false;
  if (changedPage) event.preventDefault();
}, { passive: false });
/** Manages library and folder controls, collection filtering, paging, and entry cards. */
