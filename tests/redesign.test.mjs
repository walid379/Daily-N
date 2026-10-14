import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const app=readFileSync(new URL('src/App.vue',root),'utf8');
const css=readFileSync(new URL('src/style.css',root),'utf8');
test('victoire: N apparaît et parle, également après rechargement du résultat enregistré',()=>{
 assert.ok(existsSync(new URL('public/assets/n-trainer.png',root)));
 assert.equal((app.match(/class="n-epilogue"/g)||[]).length,2);
 assert.ok(app.includes("view.outcome==='win'"));
 assert.ok(app.includes("daily.result==='win'"));
 assert.ok(app.includes('alt="N, dresseur du Palais"'));
 assert.ok(css.includes('.n-epilogue'));
});
test('interface: aucune puce dans le logo et détails du combat masqués par défaut',()=>{
 assert.ok(!app.includes('<span>·</span>'));
 assert.ok(app.includes('v-if="showIntel&&(running||!daily.result)"'));
 assert.ok(app.includes('class="foe-counter"'));
 assert.ok(!app.includes('<footer class="footer">'));
 assert.ok(css.includes('.combat-layout{grid-template-columns:minmax(0,1fr)'));
});
