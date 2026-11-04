import { cp, mkdir, rm } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
const publicFiles = [
	'index.html', 'menu.html', 'cart.html', 'checkout.html', 'confirmation.html',
	'dashboard.html', 'tracking.html', 'styles.css', 'app.js', 'api.js', 'menu-items.json', 'cart.js',
	'format.js', 'validation.js',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(publicFiles.map((file) => cp(new URL(`../${file}`, import.meta.url), new URL(file, output))));
await cp(new URL('../images/', import.meta.url), new URL('images/', output), { recursive: true });
console.log('Static HTML, CSS, and JavaScript written to dist/.');
