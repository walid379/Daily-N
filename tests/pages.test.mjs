import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('le site GitHub Pages précompilé est autonome sous un chemin de dépôt',()=>{
 const html=readFileSync(resolve(root,'docs/index.html'),'utf8');
 assert.ok(existsSync(resolve(root,'docs/.nojekyll')),'désactiver Jekyll pour Vite');
 assert.doesNotMatch(html,/\/src\/main\.ts|(?:src|href)="\/assets\//);
 const paths=[...html.matchAll(/(?:src|href)="(\.\/assets\/[^"#]+)"/g)].map(m=>m[1]);
 assert.ok(paths.some(p=>p.endsWith('.js')),'script compilé');
 assert.ok(paths.some(p=>p.endsWith('.css')),'CSS compilé');
 for(const path of paths) assert.ok(existsSync(resolve(root,'docs',path)),`asset manquant : ${path}`);
 assert.ok(existsSync(resolve(root,'docs/assets/n-trainer.png')));
 assert.ok(existsSync(resolve(root,'docs/assets/favicon.svg')));
 const app=readFileSync(resolve(root,'src/App.vue'),'utf8');
 assert.doesNotMatch(app,/src="\/assets\//,'les images dans Vue doivent rester relatives pour un dépôt GitHub Pages');
});
