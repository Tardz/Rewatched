/** Ui module. */
// Shared UI building blocks used by collection cards and entry details.

const ACTION_ICONS = {
  Rewatch: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 6.4"/><path d="M3 4v7h7"/></svg>',
  Edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4z"/></svg>',
  Remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>',
  Folder: appIconMarkup('folder-action', 'icon-button-symbol app-icon'),
  Fullscreen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg>',
};

/** Returns the color associated with a score on the rating scale. */
function ratingColorForScore(score) {
  const hue = Math.min(140, Math.max(0, (Number(score) - 3) * 20));
  return `hsl(${hue} 72% 64%)`;
}

/** Creates poster markup for an entry, including its fallback state. */
function posterElement(entry, className) {
  const wrapper = document.createElement('div');
  wrapper.className = className;

  if (!entry.poster) {
    wrapper.textContent = 'No poster';
    return wrapper;
  }

  const image = document.createElement('img');
  image.src = entry.poster;
  image.alt = `${entry.title} poster`;
  image.onerror = () => {
    image.remove();
    wrapper.textContent = 'No poster';
  };
  wrapper.append(image);
  return wrapper;
}

/** Creates a reusable icon button and connects its click handler. */
function iconButton(label, icon, callback, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ['icon-button', className].filter(Boolean).join(' ');
  button.innerHTML = ACTION_ICONS[icon];
  button.querySelector('svg')?.classList.add('icon-button-symbol');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.addEventListener('click', callback);
  return button;
}
/** Shared UI helpers for ratings, poster markup, and reusable icon buttons. */
