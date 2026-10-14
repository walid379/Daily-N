import {cpSync,existsSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
const docs=resolve(root,'docs');
if(!existsSync(resolve(dist,'index.html'))) throw new Error('Compilation absente : exécute npm run build.');
rmSync(docs,{recursive:true,force:true});
mkdirSync(docs,{recursive:true});
cpSync(dist,docs,{recursive:true});
writeFileSync(resolve(docs,'.nojekyll'),'');
console.log('Site GitHub Pages généré dans docs/.');
