/** Form module. */
// Entry form, poster upload, and watch submission.

/** Fills year selectors with the supported year options. */
function populateYears() {
  const latestYear = new Date().getFullYear() + 1;
  for (let year = latestYear; year >= 1888; year--) {
    $('#year').add(new Option(year, year));
    $('#watch-year').add(new Option(year, year));
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
}

/** Updates the collection picker’s selected-items summary. */
function updateCollectionPickerSummary() {
  const selected = [...document.querySelectorAll('#entry-collections input:checked')];
  $('#collection-picker-summary').textContent = selected.length
    ? `${selected.length} selected`
    : 'None selected';
}

/** Builds the collection selector and marks selected folders. */
function populateCollectionPicker(selectedIds = []) {
  const picker = $('#entry-collections');
  if (!picker) return;
  picker.replaceChildren();
  customCollections.forEach((folder) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = folder.id;
    input.checked = selectedIds.includes(folder.id);
    input.addEventListener('change', updateCollectionPickerSummary);
    label.append(input, document.createTextNode(folder.name));
    picker.append(label);
  });
  if (!customCollections.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Create a collection above the library first.';
    picker.append(empty);
  }
  updateCollectionPickerSummary();
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
  $('#score').style.setProperty('--rating-color', ratingColor);
  const scoreFill = $('#score-meter-fill');
  scoreFill.style.width = percentage;
  scoreFill.style.backgroundColor = ratingColor;
  $('#score-value').setAttribute('aria-label', `Rating ${score} out of 10`);
}

/** Shows the date inputs required for the selected date precision. */
function updateWatchDateFields() {
  const isWatchlist = activeView === 'watchlist';
  document.querySelectorAll('[data-entry-mode]').forEach((button) => {
    const selected = button.dataset.entryMode === activeView;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
  const canUseYear = !isWatchlist;
  const yearOnly = canUseYear && ['year', 'approximate'].includes($('#date-precision').value);
  const unknown = $('#date-precision').value === 'unknown';
  $('#date').type = ['month', 'approximate-month'].includes($('#date-precision').value) ? 'month' : 'date';
  $('#date-precision-label').hidden = !canUseYear;
  $('#date-label').hidden = isWatchlist || yearOnly || unknown;
  $('#watch-year-label').hidden = !yearOnly;
  $('#date').required = canUseYear && !yearOnly && !unknown;
  $('#watch-year').required = yearOnly;
  $('#date-field-label').textContent = form.dataset.rewatch === 'true' ? 'Date of rewatch' : 'Watched on';
}

/** Shows or hides form sections for the selected entry type. */
function updateFormVisibility() {
  const isWatchlist = activeView === 'watchlist';
  document.querySelectorAll('.watch-only').forEach((field) => { field.hidden = isWatchlist; });
  document.querySelectorAll('.watchlist-only').forEach((field) => { field.hidden = !isWatchlist; });
  document.querySelectorAll('.logged-entry-only').forEach((field) => { field.hidden = isWatchlist; });
  $('#notes-field-label').closest('label').hidden = isWatchlist;
  $('#rating-panel-heading').textContent = isWatchlist ? 'Priority' : 'Rating & notes';
  $('#score').required = !isWatchlist;
  updateWatchDateFields();
}

document.querySelectorAll('[data-entry-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    if (editingId || form.dataset.rewatch === 'true') return;
    activeView = button.dataset.entryMode;
    document.querySelectorAll('[data-entry-mode]').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    updateFormVisibility();
  });
});

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
function openDialog(id = null, rewatch = false, watchIndex = null, detailsOnly = false) {
  editingId = id;
  const isWatchlist = activeView === 'watchlist';

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

  form.reset();
  $('#metadata-lookup-status').textContent = '';
  form.dataset.omdbMetadata = entry?.metadata ? JSON.stringify(entry.metadata) : '';

  $('#title').value = entry?.title || '';
  $('#director').value = entry?.director || '';
  $('#type').value = entry?.type || 'Movie';
  selectGenre(entry?.category);
  $('#year').value = entry?.year || '';
  const selectedCollections = entry
    ? entryCollectionIds(entry)
    : activeCollectionId === 'all' ? [] : [activeCollectionId];
  populateCollectionPicker(selectedCollections);
  if ($('.collection-picker')) $('.collection-picker').open = false;
  $('#poster').value = entry?.poster || '';
  $('#poster-upload-status').textContent = '';
  updatePosterPreview();

  const savedDate = watch?.date || '';
  const savedYearOnly = /^\d{4}$/.test(savedDate);
  $('#date').value = savedYearOnly ? '' : savedDate;
  $('#watch-year').value = savedYearOnly ? savedDate : '';
  if (rewatch || (!savedDate && activeView === 'logged')) {
    const today = new Date();
    $('#date').value = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
  }
  $('#score').value = rewatch && entry ? (latest(entry)?.score ?? 7) : (watch?.score ?? 7);
  $('#priority').value = String(entry?.priority || 3);
  updateScoreDisplay();
  $('#notes').value = watch?.notes || '';
  if (isWatchlist) $('#notes').value = entry?.notes || '';
  $('#date-precision').value = watch?.precision || (savedYearOnly || (watch?.kind === 'previous' && !savedDate)
    ? 'year'
    : 'exact');

  document.querySelectorAll('.watch-only').forEach((field) => {
    field.hidden = isWatchlist;
  });
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
  $('.form-entry-switcher').hidden = Boolean(rewatch || watchOnlyEdit || detailsOnly);
  $('#title').required = !rewatch && !watchOnlyEdit;
  form.dataset.rewatch = rewatch ? 'true' : 'false';
  form.dataset.watchOnlyEdit = watchOnlyEdit ? 'true' : 'false';
  form.dataset.detailsOnly = detailsOnly ? 'true' : 'false';
  form.dataset.watchIndex = watchIndex ?? '';
  updateWatchDateFields();
  $('#score-field-label').textContent = rewatch ? 'New rating' : 'Score';
  $('#notes-field-label').textContent = rewatch ? 'Rewatch notes' : 'Notes';
  $('#notes-field-label').closest('label').hidden = isWatchlist;
  $('#rating-panel-heading').textContent = isWatchlist ? 'Priority' : 'Rating & notes';
  $('#score').required = !isWatchlist && !detailsOnly;
  $('#priority').required = isWatchlist && !detailsOnly;
  $('#save-entry').textContent = detailsOnly
    ? 'Save details'
    : watchOnlyEdit ? 'Save watch'
      : isWatchlist ? 'Add to watchlist' : (rewatch ? 'Save rewatch' : 'Save entry');
  if (isWatchlist && entry) $('#save-entry').textContent = 'Save changes';

  dialog.showModal();
  $('#title').focus();
}

$('#open-add').addEventListener('click', () => openDialog());
$('#close-dialog').addEventListener('click', () => dialog.close());
$('#cancel-dialog').addEventListener('click', () => dialog.close());
$('#score').addEventListener('input', updateScoreDisplay);
$('#poster').addEventListener('input', updatePosterPreview);
$('#title').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  $('#lookup-title-details').click();
});
$('#lookup-title-details').addEventListener('click', async (event) => {
  const title = $('#title').value.trim();
  const apiKey = localStorage.getItem(OMDB_API_KEY)?.trim();
  const status = $('#metadata-lookup-status');
  const button = event.currentTarget;
  if (!title) {
    status.textContent = 'Enter a title first.';
    $('#title').focus();
    return;
  }
  if (!apiKey) {
    status.textContent = 'Add your OMDb API key in Settings first.';
    return;
  }

  const previousMetadata = safeOmdbMetadata();
  if (previousMetadata && previousMetadata.query?.title === title.toLocaleLowerCase() &&
      previousMetadata.query?.type === $('#type').value &&
      (!$('#year').value || previousMetadata.query?.year === $('#year').value)) {
    status.textContent = `Details already saved from ${new Date(previousMetadata.fetchedAt).toLocaleDateString()}.`;
    return;
  }

  button.disabled = true;
  status.textContent = 'Looking up details…';
  try {
    const result = await requestOmdbTitle(apiKey, { title, year: $('#year').value, type: $('#type').value });
    if (result.Response !== 'True') throw new Error(result.Error || 'No matching title found.');

    const canonicalTitle = result.Title && result.Title !== 'N/A' ? result.Title.trim() : '';
    if (canonicalTitle) $('#title').value = canonicalTitle;
    const releaseYear = result.Year?.match(/\d{4}/)?.[0] || '';
    const genre = result.Genre && result.Genre !== 'N/A' ? result.Genre.split(',')[0].trim() : '';
    const director = result.Director && result.Director !== 'N/A' ? result.Director : '';
    const poster = result.Poster && result.Poster !== 'N/A' ? result.Poster : '';
    if (releaseYear) $('#year').value = releaseYear;
    if (genre) selectGenre(genre);
    $('#director').value = director;
    if (poster) {
      $('#poster').value = poster;
      updatePosterPreview();
    }
    form.dataset.omdbMetadata = JSON.stringify({
      source: 'OMDb',
      fetchedAt: new Date().toISOString(),
      query: { title: (canonicalTitle || title).toLocaleLowerCase(), type: $('#type').value, year: releaseYear || $('#year').value },
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
    status.textContent = 'Details found. Check them before saving.';
  } catch (error) {
    status.textContent = error.message || 'Could not look up this title.';
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

['#title', '#type', '#year'].forEach((selector) => {
  const invalidateFetchedMetadata = () => {
    const metadata = safeOmdbMetadata();
    if (!metadata) return;
    if (metadata.query?.title !== $('#title').value.trim().toLocaleLowerCase() ||
        metadata.query?.type !== $('#type').value ||
        (metadata.query?.year && metadata.query.year !== $('#year').value)) {
      form.dataset.omdbMetadata = '';
      $('#metadata-lookup-status').textContent = 'Title changed. Look up details again to refresh saved metadata.';
    }
  };
  $(selector).addEventListener('input', invalidateFetchedMetadata);
  $(selector).addEventListener('change', invalidateFetchedMetadata);
});
$('#poster-preview-image').addEventListener('error', () => {
  $('#poster-preview-image').hidden = true;
  $('#poster-preview-empty').hidden = false;
  $('#poster-preview-empty').textContent = 'Image unavailable';
});
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
$('#date-precision').addEventListener('change', updateWatchDateFields);


// Form submission

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const previousEntries = structuredClone(entries);
  const previousWatchlist = structuredClone(watchlist);

  if (activeView === 'watchlist') {
    const normalizedTitle = $('#title').value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const duplicate = watchlist.some((item) => item.id !== editingId &&
      item.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedTitle);
    if (duplicate) {
      $('#metadata-lookup-status').textContent = 'This title is already on your watchlist.';
      $('#title').focus();
      return;
    }
  }

  if (form.dataset.detailsOnly === 'true') {
    const item = (activeView === 'watchlist' ? watchlist : entries)
      .find((entry) => entry.id === editingId);
    if (!item) return;
    Object.assign(item, {
      title: $('#title').value.trim(),
      director: $('#director').value.trim(),
      metadata: safeOmdbMetadata(),
      type: $('#type').value,
      category: $('#category').value.trim(),
      year: $('#year').value,
      poster: $('#poster').value.trim(),
    });
    if (!saveFormChanges(previousEntries, previousWatchlist)) return;
    dialog.close();
    render();
    return;
  }

  if (activeView === 'watchlist') {
    const details = {
      title: $('#title').value.trim(),
      director: $('#director').value.trim(),
      metadata: safeOmdbMetadata(),
      type: $('#type').value,
      category: $('#category').value.trim(),
      year: $('#year').value,
      poster: $('#poster').value.trim(),
      priority: Number($('#priority').value),
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

  const watch = {
    date: $('#date-precision-label').hidden || ['exact', 'month', 'approximate-month'].includes($('#date-precision').value)
      ? $('#date').value
      : $('#watch-year').value,
    score: Number($('#score').value),
    notes: $('#notes').value.trim(),
    kind: form.dataset.rewatch === 'true' ? 'previous' : 'first',
    precision: $('#date-precision').value,
  };
  const details = {
    title: $('#title').value.trim(),
    director: $('#director').value.trim(),
    metadata: safeOmdbMetadata(),
    type: $('#type').value,
    category: $('#category').value.trim(),
    year: $('#year').value,
    poster: $('#poster').value.trim(),
    collectionIds: [...document.querySelectorAll('#entry-collections input:checked')].map((input) => input.value),
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
