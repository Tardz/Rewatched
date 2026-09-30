/** Form module. */
// Entry form, poster upload, and watch submission.

let formEntryMode = 'logged';

/** Updates the create dialog's Library/Watchlist switcher appearance. */
function updateEntryModeSwitcher() {
  const destination = formEntryMode === 'watchlist' ? 'watchlist' : 'library';
  $('.watch-panel-heading h3').textContent = `Log to ${destination}`;
  $('.watch-rating-panel').setAttribute('aria-label', `Log to ${destination}`);
  document.querySelectorAll('#entry-mode-switcher .library-view-option').forEach((button) => {
    const selected = button.dataset.view === formEntryMode;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
  });
}

/** Switches the create dialog between a logged watch and a watchlist item. */
function setFormEntryMode(mode) {
  formEntryMode = mode;
  if (mode === 'logged' && !$('#watch-year-input').value && !$('#watch-month').value && !$('#watch-day').value) {
    const today = new Date();
    $('#watch-year-input').value = String(today.getFullYear());
    $('#watch-month').value = String(today.getMonth() + 1).padStart(2, '0');
    $('#watch-day').value = String(today.getDate()).padStart(2, '0');
  }
  updateEntryModeSwitcher();
  updateFormVisibility();
  const isWatchlist = mode === 'watchlist';
  const detailsOnly = form.dataset.detailsOnly === 'true';
  $('#score').required = !isWatchlist && !detailsOnly;
  $('#priority').required = isWatchlist && !detailsOnly;
  if (!detailsOnly) {
    const label = isWatchlist ? 'Add to watchlist' : 'Log a watch';
    $('#save-entry').setAttribute('aria-label', label);
    $('#save-entry').title = label;
  }
}

/** Reads the year-only release input. */
function releaseYearValue() {
  return $('#year').value.trim();
}

/** Keeps the Movie/Show toolbar switcher in sync with the native select. */
function updateMediaTypeSwitcher() {
  const type = $('#type').value;
  const isShow = type === 'Show';
  const titleLabel = isShow ? 'Show title' : 'Movie title';
  $('#movie-details-heading').textContent = isShow ? 'Show details' : 'Movie details';
  $('.movie-details-panel').setAttribute('aria-label', isShow ? 'Show details' : 'Movie details');
  $('#title').placeholder = titleLabel;
  $('#title').setAttribute('aria-label', titleLabel);
  $('label[for="title"] .visually-hidden').textContent = titleLabel;
  document.querySelectorAll('[data-media-type-option]').forEach((option) => {
    const selected = option.dataset.mediaTypeOption === type;
    option.classList.toggle('active', selected);
    option.setAttribute('aria-selected', String(selected));
  });
}

/** Shows a short form message above the create-entry dialog. */
function showFormToast(message) {
  const toast = $('#form-toast');
  toast.textContent = message;
  toast.hidden = false;
  const dialog = $('#watch-dialog');
  const dialogRect = dialog.getBoundingClientRect();
  const toastRect = toast.getBoundingClientRect();
  toast.style.left = `${dialogRect.left}px`;
  toast.style.top = `${Math.max(8, dialogRect.top - toastRect.height - 10)}px`;
  clearTimeout(showFormToast.timer);
  showFormToast.timer = setTimeout(() => { toast.hidden = true; }, 3000);
}

/** Shows the selected genre as a chip using the library's genre hue. */
function updateCategoryChip() {
  const select = $('#category');
  const chip = $('#category-chip');
  const genre = select.value.trim();
  chip.hidden = !genre;
  chip.textContent = genre;

  if (!genre) {
    chip.style.removeProperty('--category-hue');
    return;
  }

  let hue = 0;
  for (const character of genre.toLocaleLowerCase()) {
    hue = (hue * 31 + character.codePointAt(0)) % 360;
  }
  chip.style.setProperty('--category-hue', hue);
}

/** Expands a two-digit year and checks that the release year is supported. */
function normalizeReleaseYear() {
  const field = $('#year');
  const value = releaseYearValue();
  const latestYear = new Date().getFullYear() + 1;
  field.setCustomValidity('');
  if (!value) return;

  if (/^\d{2}$/.test(value)) {
    const shortYear = Number(value);
    field.value = String(shortYear <= 29 ? 2000 + shortYear : 1900 + shortYear);
  } else if (!/^\d{4}$/.test(value)) {
    field.setCustomValidity('Enter a release year using two or four digits.');
    return;
  }

  const year = Number(field.value);
  if (year < 1888 || year > latestYear) {
    field.setCustomValidity(`Enter a year between 1888 and ${latestYear}.`);
  }
}

/** Selects the requested genre in the form control. */
function selectGenre(genre) {
  const select = $('#category');
  select.querySelector('[data-custom-genre]')?.remove();

  if (genre && !Array.from(select.options).some((option) => option.value === genre)) {
    const option = new Option(genre, genre);
    option.dataset.customGenre = 'true';
    select.add(option);
  }

  select.value = genre || '';
  updateCategoryChip();
}

/** Populates the create dialog's multi-select folder menu. */
function populateEntryFolderSwitcher(selectedIds = []) {
  const menu = $('#entry-folder-options');
  const selected = new Set(selectedIds);
  menu.replaceChildren();

  customCollections.forEach((folder) => {
    const label = document.createElement('label');
    label.className = 'entry-folder-choice';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = folder.id;
    checkbox.checked = selected.has(folder.id);

    const name = document.createElement('span');
    name.textContent = folder.name;
    label.append(checkbox, name);
    menu.append(label);
  });

  if (!customCollections.length) {
    const empty = document.createElement('span');
    empty.className = 'entry-folder-empty';
    empty.textContent = 'No folders yet';
    menu.append(empty);
  }

  updateEntryFolderSelectionState();
}

/** Returns the selected folder IDs in the create dialog. */
function selectedEntryFolderIds() {
  return Array.from($('#entry-folder-options').querySelectorAll('input:checked'), (input) => input.value);
}

/** Reflects the selected folders in the folder button and its tooltip. */
function updateEntryFolderSelectionState() {
  const picker = $('#entry-folder-picker');
  const button = $('#entry-folder-button');
  const selectedNames = Array.from(
    $('#entry-folder-options').querySelectorAll('input:checked'),
    (input) => input.parentElement.querySelector('span').textContent,
  );
  picker.classList.toggle('has-folder-selection', selectedNames.length > 0);
  const title = selectedNames.length ? selectedNames.join(', ') : 'Choose folders';
  button.title = title;
  button.setAttribute('aria-label', selectedNames.length
    ? `Choose folders. Selected: ${selectedNames.join(', ')}`
    : 'Choose folders');
}

/** Refreshes the poster preview from the current form value. */
function updatePosterPreview() {
  const url = $('#poster').value.trim();
  const image = $('#poster-preview-image');
  image.hidden = !url;
  $('#poster-preview-empty').hidden = Boolean(url);
  $('#poster-preview-empty').textContent = 'No poster selected';
  if (url) image.src = url;
  else image.removeAttribute('src');
}

/** Synchronizes the rating slider and percentage display. */
function updateScoreDisplay() {
  const numericScore = Number($('#score').value);
  const score = numericScore.toFixed(1);
  const percentage = `${numericScore * 10}%`;
  const ratingColor = ratingColorForScore(numericScore);

  $('#score-value').textContent = percentage;
  $('#score-value').style.setProperty('--rating-color', ratingColor);
  $('#score').style.setProperty('--rating-color', ratingColor);
  const scoreFill = $('#score-meter-fill');
  scoreFill.style.width = percentage;
  scoreFill.style.backgroundColor = ratingColor;
  $('#score-value').setAttribute('aria-label', `Rating ${score} out of 10`);
}

/** Updates the watchlist priority slider's label and tier color. */
function updatePriorityDisplay() {
  const priority = Number($('#priority').value);
  const label = priority <= 2 ? 'Low' : priority === 3 ? 'Medium' : 'High';
  const colorName = priority <= 2 ? '--priority-low' : priority === 3 ? '--priority-medium' : '--priority-high';
  const color = getComputedStyle(document.documentElement).getPropertyValue(colorName).trim();
  const progress = `${((priority - 1) / 4) * 100}%`;

  $('#priority-value').textContent = `P${priority}`;
  $('#priority-value').style.setProperty('--priority-color', color);
  $('#priority').setAttribute('aria-valuetext', `${priority}, ${label} priority`);
  $('#priority').style.setProperty('--priority-color', color);
  $('#priority-meter-fill').style.width = progress;
  $('#priority-meter-fill').style.backgroundColor = color;
  $('#priority-meter-fill').style.setProperty('--rating-color', color);
}

/** Lets pointer drags anywhere on a slider track set its value continuously. */
function enableTrackDragging(trackSelector, inputSelector) {
  const track = $(trackSelector);
  const input = $(inputSelector);
  let pointerId = null;

  const updateFromPointer = (event) => {
    const bounds = track.getBoundingClientRect();
    const thumbInset = 9;
    const usableWidth = Math.max(1, bounds.width - thumbInset * 2);
    const progress = Math.min(1, Math.max(0, (event.clientX - bounds.left - thumbInset) / usableWidth));
    const min = Number(input.min);
    const max = Number(input.max);
    const step = Number(input.step) || 1;
    const steppedValue = min + Math.round((progress * (max - min)) / step) * step;
    const precision = (String(step).split('.')[1] || '').length;

    input.value = String(Number(Math.min(max, Math.max(min, steppedValue)).toFixed(precision)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  track.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || input.disabled) return;
    event.preventDefault();
    pointerId = event.pointerId;
    track.setPointerCapture(pointerId);
    input.focus({ preventScroll: true });
    updateFromPointer(event);
  });

  track.addEventListener('pointermove', (event) => {
    if (event.pointerId === pointerId) updateFromPointer(event);
  });

  const stopDragging = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
  };
  track.addEventListener('pointerup', stopDragging);
  track.addEventListener('pointercancel', stopDragging);
}

enableTrackDragging('.rating-slider', '#score');
enableTrackDragging('.priority-slider', '#priority');

/** Validates the entered watch date and derives its stored precision. */
function updateWatchDateFields() {
  const isWatchlist = formEntryMode === 'watchlist';
  const yearField = $('#watch-year-input');
  const monthField = $('#watch-month');
  const dayField = $('#watch-day');
  const dateModeButton = $('#date-mode');
  const datePickerButton = $('#watch-date-picker-button');
  const datePicker = $('#watch-date-picker');
  const detailsOnly = form.dataset.detailsOnly === 'true';
  const disabled = isWatchlist || detailsOnly;

  [yearField, monthField, dayField].forEach((field) => {
    field.disabled = disabled;
    field.setCustomValidity('');
  });
  yearField.required = false;
  monthField.required = false;
  dayField.required = false;
  dateModeButton.disabled = isWatchlist || detailsOnly;
  datePickerButton.disabled = isWatchlist || detailsOnly;
  datePicker.disabled = isWatchlist || detailsOnly;

  let year = yearField.value.trim();
  if (/^\d{2}$/.test(year)) {
    const shortYear = Number(year);
    year = String(shortYear <= 29 ? 2000 + shortYear : 1900 + shortYear);
  }
  let month = monthField.value.trim();
  const day = dayField.value.trim();
  const isUnknown = !year && !month && !day;
  const approximate = dateModeButton.getAttribute('aria-pressed') === 'true';
  dateModeButton.setAttribute('aria-pressed', String(approximate));
  $('#date-mode-symbol').textContent = approximate ? '≈' : '=';
  dateModeButton.setAttribute('aria-label', approximate
    ? 'Approximate date selected; press Enter to use a regular date'
    : 'Regular date selected; press Enter to use an approximate date');
  dateModeButton.title = approximate ? 'Approximate date' : 'Regular date';
  const latestYear = new Date().getFullYear() + 1;

  if (!disabled) {
    if (year && !/^\d{4}$/.test(year)) {
      yearField.setCustomValidity('Enter a year using two or four digits.');
    } else if (year && (Number(year) < 1888 || Number(year) > latestYear)) {
      yearField.setCustomValidity(`Enter a year between 1888 and ${latestYear}.`);
    }

    if (month && (!/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12)) {
      monthField.setCustomValidity('Enter a month from 1 to 12.');
    }
    if ((month || day) && !year) yearField.setCustomValidity('Enter a year before the month or day.');
    if (day && !month) dayField.setCustomValidity('Enter a month before the day.');
    if (day && month && year && /^\d{4}$/.test(year)) {
      const dayNumber = Number(day);
      const monthNumber = Number(month);
      const date = new Date(Number(year), monthNumber - 1, dayNumber);
      if (!/^\d{1,2}$/.test(day) || date.getFullYear() !== Number(year) ||
          date.getMonth() !== monthNumber - 1 || date.getDate() !== dayNumber) {
        dayField.setCustomValidity('Enter a valid day for the selected month.');
      }
    }
  }

  let date = '';
  let precision = 'unknown';
  if (!isUnknown && !isWatchlist && year) {
    if (month && day) {
      date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      precision = approximate ? 'approximate-date' : 'exact';
    } else if (month) {
      date = `${year}-${month.padStart(2, '0')}`;
      precision = approximate ? 'approximate-month' : 'month';
    } else {
      date = year;
      precision = approximate ? 'approximate' : 'year';
    }
  }
  const pickerMonth = /^\d{1,2}$/.test(month) && Number(month) >= 1 && Number(month) <= 12
    ? month.padStart(2, '0') : '01';
  const pickerDay = /^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= 31
    ? day.padStart(2, '0') : '01';
  datePicker.value = /^\d{4}$/.test(year) ? `${year}-${pickerMonth}-${pickerDay}` : '';
  $('#date').value = date;
  $('#date-precision').value = precision;
}

/** Expands short watch years when leaving the field. */
function normalizeWatchedYear() {
  const field = $('#watch-year-input');
  const value = field.value.trim();
  if (/^\d{2}$/.test(value)) {
    const shortYear = Number(value);
    field.value = String(shortYear <= 29 ? 2000 + shortYear : 1900 + shortYear);
  }
  updateWatchDateFields();
}

/** Pads a numeric month to two digits when leaving its field. */
function normalizeWatchedMonth() {
  const field = $('#watch-month');
  const value = field.value.trim();
  if (/^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 12) {
    field.value = value.padStart(2, '0');
  }
  updateWatchDateFields();
}

/** Completes a partial date part on Enter, then advances on the next Enter. */
function handleWatchedDateEnter(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();

  const field = event.currentTarget;
  const previousValue = field.value;
  if (field.id === 'watch-year-input') {
    if (/^\d{3}$/.test(field.value)) field.value += '0';
    else normalizeWatchedYear();
  } else if (/^\d$/.test(field.value)) {
    field.value = field.value.padStart(2, '0');
  }
  updateWatchDateFields();

  if (field.value !== previousValue) {
    if (field.validationMessage) field.reportValidity();
    return;
  }
  if (!field.reportValidity()) return;

  const nextField = field.id === 'watch-year-input'
    ? $('#watch-month')
    : field.id === 'watch-month' ? $('#watch-day') : $('#score');
  nextField.focus();
}

/** Clearing the year clears the rest of the date, making it unknown. */
function handleWatchedYearInput() {
  if (!$('#watch-year-input').value.trim()) {
    $('#watch-month').value = '';
    $('#watch-day').value = '';
  }
  updateWatchDateFields();
}

/** Clears a whole date part with one Backspace, revealing its dash placeholders. */
function clearWatchedDatePart(event) {
  if (event.key !== 'Backspace' || !event.currentTarget.value) return;
  event.preventDefault();
  event.currentTarget.value = '';
  if (event.currentTarget.id === 'watch-year-input') {
    $('#watch-month').value = '';
    $('#watch-day').value = '';
  }
  updateWatchDateFields();
}

/** Shows or hides form sections for the selected entry type. */
function updateFormVisibility() {
  const isWatchlist = formEntryMode === 'watchlist';
  form.classList.toggle('is-watchlist-mode', isWatchlist);
  $('.watch-details-components').hidden = isWatchlist;
  document.querySelectorAll('.watch-only').forEach((field) => { field.hidden = isWatchlist; });
  document.querySelectorAll('.watchlist-only').forEach((field) => { field.hidden = !isWatchlist; });
  document.querySelectorAll('.logged-entry-only').forEach((field) => { field.hidden = isWatchlist; });
  $('#score').required = !isWatchlist;
  updateWatchDateFields();
}

/** Converts an uploaded image file into a storable poster value. */
async function imageToPoster(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    const scale = Math.min(1, 480 / image.width, 720 / image.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}


// Watch dialog

/** Opens and initializes the add, edit, or rewatch dialog. */
function openDialog(id = null, rewatch = false, watchIndex = null, detailsOnly = false, sourceView = activeView) {
  editingId = id;
  formEntryMode = sourceView;
  const isWatchlist = formEntryMode === 'watchlist';

  const entry = id
    ? (isWatchlist ? watchlist : entries).find((item) => item.id === id)
    : null;

  const watch = entry && !rewatch && !isWatchlist
    ? entry.watches[watchIndex ?? 0]
    : null;
  const watchOnlyEdit = Boolean(entry && !rewatch && !isWatchlist && watchIndex !== null && !detailsOnly);

  if (detailsOnly) {
    $('#form-heading').textContent = 'Edit movie details';
  } else if (watchOnlyEdit) {
    $('#form-heading').textContent = 'Edit watch';
  } else if (isWatchlist) {
    $('#form-heading').textContent = entry ? 'Edit watchlist item' : 'Add to watchlist';
  } else if (rewatch) {
    $('#form-heading').textContent = 'Log a rewatch';
  } else if (entry) {
    $('#form-heading').textContent = 'Edit entry';
  } else {
    $('#form-heading').textContent = 'Log a watch';
  }

  form.classList.remove('has-submission-attempt');
  form.reset();
  $('#form-toast').hidden = true;
  $('#form-toast').textContent = '';
  clearTimeout(showFormToast.timer);
  form.dataset.omdbMetadata = entry?.metadata ? JSON.stringify(entry.metadata) : '';

  $('#title').value = entry?.title || '';
  $('#director').value = entry?.director || '';
  $('#type').value = entry?.type || 'Movie';
  updateMediaTypeSwitcher();
  selectGenre(entry?.category);
  $('#year').value = entry?.year || '';
  const selectedCollections = entry
    ? entryCollectionIds(entry)
    : formEntryMode === 'logged' && activeCollectionId !== 'all' ? [activeCollectionId] : [];
  populateEntryFolderSwitcher(selectedCollections);
  $('#poster').value = entry?.poster || '';
  $('#poster-upload-status').textContent = '';
  updatePosterPreview();

  let savedDate = watch?.date || '';
  if (rewatch || (!watch && formEntryMode === 'logged')) {
    const today = new Date();
    savedDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
  }
  const savedDateParts = savedDate.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  $('#watch-year-input').value = savedDateParts?.[1] || '';
  $('#watch-month').value = savedDateParts?.[2] || '';
  $('#watch-day').value = savedDateParts?.[3] || '';
  const savedPrecision = watch?.precision || (savedDateParts
    ? savedDateParts[3] ? 'exact' : savedDateParts[2] ? 'month' : 'year'
    : watch ? 'unknown' : 'exact');
  $('#date-mode').setAttribute('aria-pressed', String(savedPrecision.startsWith('approximate')));
  $('#score').value = rewatch && entry ? (latest(entry)?.score ?? 7) : (watch?.score ?? 8.5);
  $('#priority').value = String(entry?.priority || 3);
  updateScoreDisplay();
  updatePriorityDisplay();
  document.querySelectorAll('.watch-only').forEach((field) => {
    field.hidden = isWatchlist;
  });
  $('.watch-details-components').hidden = isWatchlist;
  document.querySelectorAll('.watchlist-only').forEach((field) => {
    field.hidden = !isWatchlist;
  });
  document.querySelectorAll('.logged-entry-only').forEach((field) => {
    field.hidden = isWatchlist;
  });
  document.querySelectorAll('.title-details').forEach((field) => {
    field.hidden = rewatch || watchOnlyEdit;
  });
  document.querySelectorAll('.form-panel:not(.title-details)').forEach((field) => {
    field.hidden = detailsOnly || (isWatchlist && field.classList.contains('watch-only'));
  });
  document.querySelectorAll('.title-details input, .title-details select, .title-details button').forEach((control) => {
    control.disabled = watchOnlyEdit;
  });
  $('#title').required = !rewatch && !watchOnlyEdit;
  form.dataset.rewatch = rewatch ? 'true' : 'false';
  form.dataset.watchOnlyEdit = watchOnlyEdit ? 'true' : 'false';
  form.dataset.detailsOnly = detailsOnly ? 'true' : 'false';
  form.dataset.watchIndex = watchIndex ?? '';
  $('#entry-mode-switcher').hidden = Boolean(entry || rewatch || detailsOnly || watchOnlyEdit);
  updateEntryModeSwitcher();
  updateWatchDateFields();
  $('#score-field-label').textContent = rewatch ? 'New rating' : 'Score';
  $('#score').required = !isWatchlist && !detailsOnly;
  $('#priority').required = isWatchlist && !detailsOnly;
  const saveLabel = detailsOnly
    ? 'Save details'
    : watchOnlyEdit ? 'Save watch'
      : isWatchlist ? 'Add to watchlist' : (rewatch ? 'Save rewatch' : 'Save entry');
  const saveButton = $('#save-entry');
  saveButton.setAttribute('aria-label', isWatchlist && entry ? 'Save changes' : saveLabel);
  saveButton.title = isWatchlist && entry ? 'Save changes' : saveLabel;

  dialog.showModal();
  $('#title').focus();
}

$('#open-add').addEventListener('click', () => openDialog());
$('#entry-mode-switcher').addEventListener('click', (event) => {
  const option = event.target.closest('.library-view-option');
  if (!option) return;
  const selectedMode = option.dataset.view;
  const nextMode = selectedMode === formEntryMode
    ? (formEntryMode === 'logged' ? 'watchlist' : 'logged')
    : selectedMode;
  setFormEntryMode(nextMode);
});
keepControlOrderUntilCollapsed($('#entry-mode-switcher'), '.library-view-option');
const entryFolderPicker = $('#entry-folder-picker');
const entryFolderMenu = $('#entry-folder-options');
const entryFolderButton = $('#entry-folder-button');

entryFolderButton.addEventListener('click', () => {
  const isOpening = entryFolderMenu.hidden;
  entryFolderMenu.hidden = !isOpening;
  entryFolderPicker.classList.toggle('is-open', isOpening);
  entryFolderButton.setAttribute('aria-expanded', String(isOpening));
});

entryFolderMenu.addEventListener('change', updateEntryFolderSelectionState);

document.addEventListener('click', (event) => {
  if (entryFolderPicker.contains(event.target)) return;
  entryFolderMenu.hidden = true;
  entryFolderPicker.classList.remove('is-open');
  entryFolderButton.setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || entryFolderMenu.hidden) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  entryFolderMenu.hidden = true;
  entryFolderPicker.classList.remove('is-open');
  entryFolderButton.setAttribute('aria-expanded', 'false');
  entryFolderButton.focus();
}, true);
document.querySelectorAll('.form-entry-switcher, .entry-media-switcher').forEach((control) => {
  control.addEventListener('pointerleave', () => {
    if (control.contains(document.activeElement)) document.activeElement.blur();
  });
});
form.addEventListener('invalid', () => {
  form.classList.add('has-submission-attempt');
}, true);
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
$('#cancel-dialog').addEventListener('click', () => dialog.close());
$('#score').addEventListener('input', updateScoreDisplay);
$('#priority').addEventListener('input', updatePriorityDisplay);
$('#poster').addEventListener('input', updatePosterPreview);
$('#year').addEventListener('input', () => $('#year').setCustomValidity(''));
$('#year').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  normalizeReleaseYear();
  $('#year').reportValidity();
});
$('#title').addEventListener('keydown', (event) => {
  if (event.key === 'Backspace' && hasCurrentOmdbLookup()) {
    event.preventDefault();
    clearOmdbLookup();
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (hasCurrentOmdbLookup() && !$('#date-mode').disabled) {
    $('#date-mode').focus();
    return;
  }
  $('#lookup-title-details').click();
});
$('#lookup-title-details').addEventListener('click', async (event) => {
  const title = $('#title').value.trim();
  const apiKey = localStorage.getItem(OMDB_API_KEY)?.trim();
  const button = event.currentTarget;
  if (!title) {
    showFormToast('Enter a title first.');
    $('#title').focus();
    return;
  }
  if (!apiKey) {
    showFormToast('Add your OMDb API key in Settings first.');
    return;
  }

  const previousMetadata = safeOmdbMetadata();
  if (previousMetadata && previousMetadata.query?.title === title.toLocaleLowerCase() &&
      previousMetadata.query?.type === $('#type').value) {
    showFormToast(`Details already saved from ${new Date(previousMetadata.fetchedAt).toLocaleDateString()}.`);
    return;
  }

  button.disabled = true;
  showFormToast('Looking up details…');
  try {
    const result = await requestOmdbTitle(apiKey, { title, type: $('#type').value });
    if (result.Response !== 'True') throw new Error(result.Error || 'No matching title found.');

    const canonicalTitle = result.Title && result.Title !== 'N/A' ? result.Title.trim() : '';
    if (canonicalTitle) $('#title').value = canonicalTitle;
    const releaseYear = result.Year?.match(/\d{4}/)?.[0] || '';
    const genre = result.Genre && result.Genre !== 'N/A' ? result.Genre.split(',')[0].trim() : '';
    const director = result.Director && result.Director !== 'N/A' ? result.Director : '';
    const poster = result.Poster && result.Poster !== 'N/A' ? result.Poster : '';
    $('#year').value = releaseYear;
    selectGenre(genre);
    $('#director').value = director;
    $('#poster').value = poster;
    updatePosterPreview();
    form.dataset.omdbMetadata = JSON.stringify({
      source: 'OMDb',
      fetchedAt: new Date().toISOString(),
      query: { title: (canonicalTitle || title).toLocaleLowerCase(), type: $('#type').value, year: releaseYear || releaseYearValue() },
      imdbId: result.imdbID === 'N/A' ? '' : result.imdbID || '',
      imdbRating: result.imdbRating === 'N/A' ? '' : result.imdbRating || '',
      runtime: result.Runtime === 'N/A' ? '' : result.Runtime || '',
      plot: result.Plot === 'N/A' ? '' : result.Plot || '',
      actors: result.Actors === 'N/A' ? '' : result.Actors || '',
      writer: result.Writer === 'N/A' ? '' : result.Writer || '',
      director,
      genre,
      year: releaseYear,
      poster,
    });
    showFormToast('Details found. Check them before saving.');
  } catch (error) {
    showFormToast(error.message || 'Could not look up this title.');
  } finally {
    button.disabled = false;
  }
});
/** Returns validated OMDb metadata from the current form state. */
function safeOmdbMetadata() {
  try {
    return form.dataset.omdbMetadata ? JSON.parse(form.dataset.omdbMetadata) : null;
  } catch {
    return null;
  }
}

/** Checks whether the current title/type already has a successful OMDb result. */
function hasCurrentOmdbLookup() {
  const metadata = safeOmdbMetadata();
  return Boolean(metadata &&
    metadata.query?.title === $('#title').value.trim().toLocaleLowerCase() &&
    metadata.query?.type === $('#type').value);
}

/** Clears the movie fields and poster populated by OMDb for a fresh search. */
function clearOmdbLookup() {
  form.dataset.omdbMetadata = '';
  $('#title').value = '';
  $('#director').value = '';
  $('#year').value = '';
  selectGenre('');
  $('#poster').value = '';
  $('#poster-upload').value = '';
  $('#poster-upload-status').textContent = '';
  updatePosterPreview();
  $('#title').focus();
}

$('#date-mode').addEventListener('keydown', (event) => {
  if (event.key !== 'Backspace' || !hasCurrentOmdbLookup()) return;
  event.preventDefault();
  clearOmdbLookup();
});

['#title', '#type', '#year'].forEach((selector) => {
  const invalidateFetchedMetadata = () => {
    const metadata = safeOmdbMetadata();
    if (!metadata) return;
    if (metadata.query?.title !== $('#title').value.trim().toLocaleLowerCase() ||
        metadata.query?.type !== $('#type').value) {
      form.dataset.omdbMetadata = '';
      showFormToast('Title or type changed. Look up details again to refresh saved metadata.');
    }
  };
  $(selector).addEventListener('input', () => {
    if (selector === '#type') updateMediaTypeSwitcher();
    invalidateFetchedMetadata();
  });
  $(selector).addEventListener('change', () => {
    if (selector === '#type') updateMediaTypeSwitcher();
    invalidateFetchedMetadata();
  });
});
$('#poster-preview-image').addEventListener('error', () => {
  $('#poster-preview-image').hidden = true;
  $('#poster-preview-empty').hidden = false;
  $('#poster-preview-empty').textContent = 'Image unavailable';
});
$('#category').addEventListener('change', updateCategoryChip);
$('#category').addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || event.shiftKey || $('#date-mode').disabled) return;
  event.preventDefault();
  $('#watch-date-picker-button').focus();
});
$('#watch-day').addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || event.shiftKey) return;
  event.preventDefault();
  $('#score').focus();
});
$('#score').addEventListener('keydown', (event) => {
  if (event.shiftKey || !['Enter', 'Tab'].includes(event.key)) return;
  event.preventDefault();
  $('#save-entry').focus();
});
$('#save-entry').addEventListener('keydown', (event) => {
  if (event.key !== 'Tab' || event.shiftKey) return;
  event.preventDefault();
  $('#title').focus();
});
$('.entry-media-switcher').addEventListener('click', (event) => {
  const option = event.target.closest('[data-media-type-option]');
  if (!option) return;
  const selectedType = option.dataset.mediaTypeOption;
  $('#type').value = selectedType === $('#type').value
    ? (selectedType === 'Movie' ? 'Show' : 'Movie')
    : selectedType;
  $('#type').dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector(`.entry-media-option[data-media-type-option="${$('#type').value}"]`).focus();
});
keepControlOrderUntilCollapsed($('.entry-media-switcher'), '.entry-media-option');
$('#poster-upload-button').addEventListener('click', () => $('#poster-upload').click());
$('#poster-upload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  $('#poster-upload-status').textContent = 'Preparing image…';
  try {
    $('#poster').value = await imageToPoster(file);
    updatePosterPreview();
    $('#poster-upload-status').textContent = 'Image ready. Save the entry to keep it.';
  } catch (error) {
    $('#poster-upload-status').textContent = error.message || 'Could not load that image.';
  }
});
$('#watch-year-input').addEventListener('input', handleWatchedYearInput);
$('#watch-year-input').addEventListener('blur', normalizeWatchedYear);
$('#watch-month').addEventListener('input', updateWatchDateFields);
$('#watch-month').addEventListener('blur', normalizeWatchedMonth);
$('#watch-day').addEventListener('input', updateWatchDateFields);
['#watch-year-input', '#watch-month', '#watch-day'].forEach((selector) => {
  $(selector).addEventListener('keydown', clearWatchedDatePart);
  $(selector).addEventListener('keydown', handleWatchedDateEnter);
});
$('#date-mode').addEventListener('click', () => {
  const button = $('#date-mode');
  const approximate = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(approximate));
  if (approximate) {
    $('#watch-year-input').value = '';
    $('#watch-month').value = '';
    $('#watch-day').value = '';
  }
  updateWatchDateFields();
});

$('#watch-date-picker-button').addEventListener('click', () => {
  const picker = $('#watch-date-picker');
  if ($('#date-mode').getAttribute('aria-pressed') === 'true') {
    $('#date-mode').setAttribute('aria-pressed', 'false');
    updateWatchDateFields();
  }
  try {
    picker.showPicker();
  } catch {
    picker.click();
  }
});

$('#watch-date-picker').addEventListener('change', (event) => {
  const [year, month, day] = event.target.value.split('-');
  if (!year || !month || !day) return;
  $('#watch-year-input').value = year;
  $('#watch-month').value = month;
  $('#watch-day').value = day;
  updateWatchDateFields();
});


// Form submission

form.addEventListener('submit', (event) => {
  event.preventDefault();
  normalizeReleaseYear();
  if (!$('#year').reportValidity()) return;
  normalizeWatchedYear();
  const hasWatchDateParts = ['#watch-year-input', '#watch-month', '#watch-day']
    .some((selector) => $(selector).value.trim());
  if (formEntryMode !== 'watchlist' && form.dataset.detailsOnly !== 'true' && hasWatchDateParts) {
    if (!$('#watch-year-input').reportValidity() ||
        !$('#watch-month').reportValidity() || !$('#watch-day').reportValidity()) return;
  }
  const previousEntries = structuredClone(entries);
  const previousWatchlist = structuredClone(watchlist);

  if (formEntryMode === 'watchlist') {
    const normalizedTitle = $('#title').value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const duplicate = watchlist.some((item) => item.id !== editingId &&
      item.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedTitle);
    if (duplicate) {
      showFormToast('This title is already on your watchlist.');
      $('#title').focus();
      return;
    }
  }

  if (form.dataset.detailsOnly === 'true') {
    const item = (formEntryMode === 'watchlist' ? watchlist : entries)
      .find((entry) => entry.id === editingId);
    if (!item) return;
    Object.assign(item, {
      title: $('#title').value.trim(),
      director: $('#director').value.trim(),
      metadata: safeOmdbMetadata(),
      type: $('#type').value,
      category: $('#category').value.trim(),
      year: releaseYearValue(),
      poster: $('#poster').value.trim(),
      collectionIds: selectedEntryFolderIds(),
    });
    if (!saveFormChanges(previousEntries, previousWatchlist)) return;
    dialog.close();
    render();
    return;
  }

  if (formEntryMode === 'watchlist') {
    const details = {
      title: $('#title').value.trim(),
      director: $('#director').value.trim(),
      metadata: safeOmdbMetadata(),
      type: $('#type').value,
      category: $('#category').value.trim(),
      year: releaseYearValue(),
      poster: $('#poster').value.trim(),
      priority: Number($('#priority').value),
      collectionIds: selectedEntryFolderIds(),
    };

    if (editingId) {
      Object.assign(watchlist.find((item) => item.id === editingId), details);
    } else {
      watchlist.unshift({ id: crypto.randomUUID(), ...details });
    }

    if (!saveFormChanges(previousEntries, previousWatchlist)) return;
    dialog.close();
    render();
    return;
  }

  const existingWatch = editingId && form.dataset.rewatch !== 'true'
    ? entries.find((entry) => entry.id === editingId)?.watches?.[Number(form.dataset.watchIndex || 0)]
    : null;
  const watch = {
    date: $('#date').value,
    score: Number($('#score').value),
    notes: existingWatch?.notes || '',
    kind: form.dataset.rewatch === 'true' ? 'previous' : 'first',
    precision: $('#date-precision').value,
  };
  const details = {
    title: $('#title').value.trim(),
    director: $('#director').value.trim(),
    metadata: safeOmdbMetadata(),
    type: $('#type').value,
    category: $('#category').value.trim(),
    year: releaseYearValue(),
    poster: $('#poster').value.trim(),
    collectionIds: selectedEntryFolderIds(),
  };

  if (editingId && form.dataset.rewatch === 'true') {
    const entry = entries.find((entry) => entry.id === editingId);
    entry.watches.unshift(watch);
  } else if (editingId) {
    const entry = entries.find((item) => item.id === editingId);

    if (form.dataset.watchOnlyEdit !== 'true') Object.assign(entry, details);

    entry.watches[Number(form.dataset.watchIndex || 0)] = watch;
  } else {
    entries.unshift({
      id: crypto.randomUUID(),
      ...details,
      watches: [watch],
    });
  }

  if (!saveFormChanges(previousEntries, previousWatchlist)) return;
  bannerIndex = 0;
  dialog.close();
  render();
});
/** Populates and controls the add/edit watch forms, including dates, ratings, and posters. */
