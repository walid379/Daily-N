import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/active.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  reportDiagnostics:true,
});
assert.equal(js.diagnostics?.length ?? 0, 0);
const helper = {exports:{}};
new Function('module','exports',js.outputText)(helper,helper.exports);
const {activeTeamIndex,visibleActiveSlot,activeSpecies}=helper.exports;

// Simule une équipe dont le premier Pokémon est Carchacrok (index 0).
test('changer le Pokémon de tête change le sprite AVANT le combat',()=>{
  assert.equal(activeTeamIndex(6,0,null,null),0,'Carchacrok initial');
  assert.equal(activeTeamIndex(6,3,null,null),3,'nouveau leader affiché');
  assert.equal(activeTeamIndex(6,5,null,null),5,'dernier Pokémon affiché');
});
test('Showdown réordonne les six Pokémon : l’interface conserve les bons sprites',()=>{
  const order=[3,0,1,2,4,5]; // on a choisi le Pokémon 4 comme leader
  assert.equal(activeTeamIndex(6,3,order,0),3,'sprite du leader');
  assert.equal(activeTeamIndex(6,3,order,1),0,'remplacement par Carchacrok');
  assert.equal(activeTeamIndex(6,3,order,4),4,'autre remplacement');
  assert.equal(activeTeamIndex(6,3,order,0),3,'retour du leader');
});
test('le drapeau actif corrige un index dépassé après changement forcé',()=>{
  assert.equal(visibleActiveSlot([{active:false},{active:false},{active:true}],0),2);
  assert.equal(visibleActiveSlot([{active:true},{active:false},{active:false}],2),0);
  assert.equal(visibleActiveSlot([{active:false},{active:false}],1),1);
});
test('le Pokémon réellement actif commande le sprite, sans repasser par l’ordre initial',()=>{
  const team=[{id:445,label:'Carchacrok'},{id:448,label:'Lucario'},{id:635,label:'Trioxhydre'}];
  assert.equal(activeSpecies(team,null,0).id,445);
  assert.equal(activeSpecies(team,{id:448},0).id,448);
  assert.equal(activeSpecies(team,{id:635},0).id,635);
  assert.equal(activeSpecies(team,{id:445},0).id,445);
  assert.equal(activeSpecies(team,null,2).id,635);
});
test('la scène utilise les IDs actifs Showdown et un sprite réinitialisé sur chaque Pokémon',()=>{
  const app=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8');
  const sprite=readFileSync(new URL('../src/components/PokemonSprite.vue',import.meta.url),'utf8');
  assert.match(app,/activeSpecies\(team\.value,ally\.value,daily\.value\.lead\)/);
  assert.match(app,/<PokemonSprite[^>]+:id="allySpec\.id"/);
  assert.match(app,/:key="'ally-'\+allySpec\.id"/);
  assert.match(sprite,/watch\(\(\)=>\[props\.id,props\.back\]/);
  assert.match(sprite,/source\.value=sprite\(props\.id,props\.back\)/);
  assert.match(sprite,/source\.value=art\(props\.id\)/);
  assert.doesNotMatch(app,/activeTeamIndex\(team\.value\.length/);
});
