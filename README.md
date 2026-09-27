# Rewatched

Rewatched is a personal watch journal for films and shows. It runs as an Electron desktop app or directly in a browser and does not require an account or remote server.

## Features

- Compact rotating spotlight for the five most recently rated titles
- Library cards with poster images, genres, scores, notes, and watch dates
- Separate first-time and previously-watched categories
- Date-optional logging for watches whose exact date is unknown
- Rewatch entries that preserve the full score and notes history
- Edit existing titles and filter the library by films or shows
- Search across the current library or watchlist view
- Individual title pages with a watch timeline
- Poster upload or image search through Google Programmable Search Engine
- Export and import JSON backups of logged titles, watch histories, posters, and watchlist items
- Link a JSON file that loads on startup and saves changes automatically in supported browsers

## Project files

- `index.html` contains the page and dialog markup.
- `main.css` lists the feature styles first, responsive overrides after them, and the light theme last.
- `css/01-base.css` defines shared layout and color tokens. Edit those variables first when changing the app palette.
- `css/02-utilities.css` contains shared helpers such as `.visually-hidden`, used to keep form labels accessible without displaying them.
- `css/03-buttons.css` contains common dialog buttons; `css/04-sidebar.css` contains the sidebar identity and dashboard controls.
- `css/05-spotlight-banner.css` and `css/06-statsbar.css` style the spotlight and its summary metrics.
- `css/07-library-controls.css` and `css/08-entry-cards.css` style the collection toolbar and title cards.
- `css/09-dialog-base.css` through `css/13-settings-backup.css` contain dialog, form, detail-page, and settings styles.
- `css/14-animations.css` contains motion rules; `css/15-statistics.css` contains the detailed statistics page and charts.
- `css/16-responsive.css` applies viewport-specific overrides; `css/17-light-theme.css` applies light-mode colors and is loaded last.
- `js/state.js` loads and saves entries and holds shared state.
- `js/ui.js` contains shared UI helpers and action icons.
- `js/banner.js` renders the rotating spotlight banner.
- `js/statistics.js` calculates and renders both the summary bar and detailed statistics.
- `js/collection.js` renders library and watchlist cards.
- `js/detail.js` renders entry previews, full pages, and timelines.
- `js/views.js` coordinates the main render cycle.
- `js/form.js` handles the entry form and image uploads.
- `js/poster-search.js` handles Google image search.
- `js/backup.js` handles backup download and restore.
- `js/file-storage.js` links a chosen JSON file for automatic loading and saving.
- `app.js` connects navigation, keyboard shortcuts, filters, and banner controls, then starts the app.

The scripts load in that order as regular deferred scripts, so the page still opens directly without a build step.

## Run it

Open `index.html` in a browser. If local storage is restricted for local files, run a local server from this folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Data is saved in the current browser's local storage.

## Back up your data

Open the gear icon in the top right and choose **Export backup**. Save the downloaded JSON file somewhere you can find it again. To restore it, choose the file in the same Settings panel. **Merge** keeps current items and adds backup items with new IDs; **Replace** restores the backup as the full library and watchlist. Imported posters are included when they were uploaded into the app. Posters added by URL remain links to their original websites.

Browser local storage belongs to the current browser and site address. Changing browsers or opening the app from a different address may show a separate library; clearing site data can remove it. Keep a downloaded backup if the data matters to you.

## Use a JSON file as storage

Run the app at <http://localhost:8000> in Chrome or Edge, then open Settings → **Storage file**. **Choose JSON file** loads an existing Rerun backup and links it to the app. **Create new file** writes your current library to a new JSON file. After that, edits automatically save to the linked file. The app remembers which file you chose and loads it the next time you open the same site. If the browser asks you to reconnect access after restarting, use **Reconnect file** in Settings. Until then, the last browser copy is shown. **Stop using file** keeps the current library in browser storage and stops writing to the file.

Browsers do not let a web page open an arbitrary path typed into a box. The file picker grants access to the specific file you choose. Linked-file storage needs the File System Access API and a secure context such as localhost or HTTPS. In other browsers, **Choose JSON file** still loads the file into the current library, but cannot save back to it automatically; use **Export backup** after making changes.

## Run the Electron desktop app

Install the dependencies once, then start the desktop wrapper:

```sh
npm install
npm start
```

The Electron wrapper loads the same `index.html`, so normal HTML, CSS, and JavaScript edits do not need compiling. While running in development, changes to source files automatically reload the window. Set `OPEN_DEVTOOLS=1` before starting if you want the Chromium developer tools:

```sh
OPEN_DEVTOOLS=1 npm start
```
