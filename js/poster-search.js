/** Poster search module. */
// Google Programmable Search integration for the poster picker.

/** Builds selectable poster results returned by Google Image Search. */
function renderGoogleResults(name, query, promotions, results, resultsDiv) {
  resultsDiv.replaceChildren();
  resultsDiv.classList.add('poster-results-grid');

  const images = (results || []).filter((result) => result.image?.url);
  if (!images.length) {
    resultsDiv.textContent = 'No images found. Try another search.';
  }

  images.forEach((result) => {
    const button = document.createElement('button');
    const image = document.createElement('img');
    const caption = document.createElement('span');

    button.type = 'button';
    button.className = 'poster-result';
    button.setAttribute('aria-label', `Use poster: ${result.titleNoFormatting || result.title || 'image'}`);
    image.src = result.thumbnailImage?.url || result.image.url;
    image.alt = '';
    caption.textContent = result.titleNoFormatting || result.title || 'Image';
    button.append(image, caption);
    button.addEventListener('click', () => {
      $('#poster').value = result.image.url;
      updatePosterPreview();
      posterDialog.close();
    });
    resultsDiv.append(button);
  });

  return true;
}

/** Adds the poster keyword once so it stays visible in the search field. */
function addPosterKeyword(query) {
  const trimmedQuery = query.trim();
  return /\bposter$/i.test(trimmedQuery) ? trimmedQuery : `${trimmedQuery} poster`;
}

/** Runs an image search using the query entered in the poster picker. */
function runPosterSearch() {
  const query = $('#poster-query').value.trim();
  if (!query) return;
  const searchQuery = addPosterKeyword(query);
  $('#poster-query').value = searchQuery;

  const search = window.google?.search?.cse?.element?.getElement('poster-images');
  if (search) {
    search.execute(searchQuery);
  } else {
    $('#poster-status').textContent = 'Google Image Search is still loading. Try again in a moment.';
  }
}

/** Loads the Google search client and starts the pending search. */
function loadGoogleSearch() {
  const searchId = $('#google-search-id').value.trim();
  if (!searchId) {
    $('#poster-status').textContent = 'Enter your Google Programmable Search Engine ID first.';
    return;
  }

  if (/^AIza/i.test(searchId)) {
    $('#poster-status').textContent = 'That looks like an API key. Enter the Programmable Search Engine ID (cx) instead.';
    return;
  }

  if (googleSearchReady && searchId === loadedGoogleSearchId) {
    runPosterSearch();
    return;
  }

  if (googleSearchReady && searchId !== loadedGoogleSearchId) {
    $('#poster-status').textContent = 'Reload the page to use a different Google search engine ID.';
    localStorage.setItem(GOOGLE_SEARCH_ID_KEY, searchId);
    return;
  }

  if (googleSearchLoading) return;

  localStorage.setItem(GOOGLE_SEARCH_ID_KEY, searchId);
  googleSearchLoading = true;
  $('#poster-status').textContent = 'Loading Google Image Search…';

  window.__gcse = {
    parsetags: 'explicit',
    searchCallbacks: { image: { ready: renderGoogleResults } },
    initializationCallback: () => {
      try {
        window.google.search.cse.element.render({
          div: 'google-results',
          tag: 'searchresults-only',
          gname: 'poster-images',
          attributes: {
            enableImageSearch: true,
            defaultToImageSearch: true,
            disableWebSearch: true,
          },
        });
        googleSearchReady = true;
        googleSearchLoading = false;
        loadedGoogleSearchId = searchId;
        $('#poster-status').textContent = '';
        runPosterSearch();
      } catch (error) {
        googleSearchLoading = false;
        $('#poster-status').textContent = 'Could not start Google Image Search. Check the engine ID and Image Search setting.';
        console.warn('Google Image Search failed to initialize.', error);
      }
    },
  };

  const script = document.createElement('script');
  script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(searchId)}`;
  script.onerror = () => {
    googleSearchLoading = false;
    $('#poster-status').textContent = 'Could not load Google Image Search. Check your connection.';
  };
  document.head.append(script);
}

$('#poster-search').addEventListener('click', () => {
  const title = $('#title').value.trim();
  $('#poster-query').value = title ? addPosterKeyword(title) : '';
  $('#google-search-id').value = localStorage.getItem(GOOGLE_SEARCH_ID_KEY) || '';
  $('#poster-status').textContent = '';
  posterDialog.showModal();
  if ($('#google-search-id').value) loadGoogleSearch();
});
// Restore the saved search engine ID as soon as the app starts, not only when
// the poster picker is opened.
$('#google-search-id').value = localStorage.getItem(GOOGLE_SEARCH_ID_KEY) || '';
$('#save-google-key')?.addEventListener('click', () => {
  const value = $('#google-search-id').value.trim();
  localStorage.setItem(GOOGLE_SEARCH_ID_KEY, value);
  $('#google-key-status').textContent = value ? 'Google search ID saved.' : 'Google search ID cleared.';
});
$('#poster-search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  loadGoogleSearch();
});
$('#close-poster-dialog').addEventListener('click', () => posterDialog.close());
$('#poster-google-settings').addEventListener('click', () => {
  posterDialog.close();
  openSettings();
  $('#google-search-id').focus();
});
/** Searches Google Images and renders selectable poster results. */
