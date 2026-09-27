/** Copies the web app into docs/ for GitHub Pages branch publishing. */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const pagesRoot = path.join(projectRoot, 'docs');
const appFiles = ['index.html', 'app.js', 'main.css', 'rewatched-icon.svg'];
const appFolders = ['css', 'js'];

for (const file of appFiles) {
  fs.copyFileSync(path.join(projectRoot, file), path.join(pagesRoot, file));
}

for (const folder of appFolders) {
  const destination = path.join(pagesRoot, folder);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(path.join(projectRoot, folder), destination, { recursive: true });
}

fs.writeFileSync(path.join(pagesRoot, '.nojekyll'), '');
console.log('GitHub Pages files are synced to docs/.');
