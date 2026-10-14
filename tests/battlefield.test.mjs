import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const ts=require('typescript');
function importTS(file,deps={}) {
  const js=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
  const m={exports:{}};new Function('require','module','exports',js)(p=>deps[p]??require(p),m,m.exports);return m.exports;
}
const daily=importTS('../src/data/daily.ts');
const pool=JSON.parse(readFileSync(new URL('../src/data/pool.json',import.meta.url),'utf8'));
const teams=importTS('../src/data/teams.ts',{'./daily':daily,'./pool.json':pool});
const mockDex={mod:()=>({})};
const bossAI=importTS('../src/lib/bossAI.ts');
const {DailyBattle,shouldPresent}=importTS('../src/engine/showdown.ts',{'@pkmn/sim':{BattleStreams:{},Teams:{}},'../data/daily':daily,'../data/teams':teams,'../lib/bossAI':bossAI});
const {frameDuration,animatesHP}=importTS('../src/lib/presentation.ts');
const {activeSpecies,visibleActiveSlot}=importTS('../src/lib/active.ts');
function make(){const frames=[];let ending='';const b=new DailyBattle({key:'2026-10-14',lead:0,isPractice:true,onState:()=>{},onEnd:v=>ending=v,onEvent:v=>frames.push(v)});return {b,frames,get ending(){return ending;}};}
test('la pluie et le soleil sont nommés, puis la météo se dissipe',()=>{
  const {b,frames}=make();b.onProtocol('|-weather|RainDance');assert.equal(b.snapshot.field.weather,'Pluie');
  b.onProtocol('|-weather|SunnyDay');assert.equal(b.snapshot.field.weather,'Soleil');
  b.onProtocol('|-weather|none');assert.equal(b.snapshot.field.weather,null);
  assert.equal(frames.filter(f=>f.kind==='-weather').length,3);
});
test('les rappels météo de fin de tour ne créent pas d’étapes inutiles',()=>{
  const {b,frames}=make();b.onProtocol('|-weather|Sandstorm');b.onProtocol('|-weather|Sandstorm|[upkeep]');b.onProtocol('|-weather|Sandstorm|[upkeep]');
  assert.equal(frames.length,1);assert.equal(b.snapshot.logs.length,1);
  assert.equal(b.snapshot.field.weather,'Tempête de sable');
});
test('distorsion et autres effets globaux sont ajoutés puis supprimés',()=>{
  const {b}=make();b.onProtocol('|-fieldstart|move: Trick Room');b.onProtocol('|-fieldstart|move: Gravity');
  assert.deepEqual(b.snapshot.field.global,['Distorsion','Gravité']);
  b.onProtocol('|-fieldend|move: Trick Room');assert.deepEqual(b.snapshot.field.global,['Gravité']);
  b.onProtocol('|-fieldend|move: Gravity');assert.deepEqual(b.snapshot.field.global,[]);
});
test('les pièges et écrans ne sont pas mélangés entre les deux camps',()=>{
  const {b,frames}=make();b.onProtocol('|-sidestart|p1: Dresseur|move: Reflect');b.onProtocol('|-sidestart|p2: N|move: Stealth Rock');
  b.onProtocol('|-sidestart|p2: N|move: Light Screen');
  assert.deepEqual(b.snapshot.field.ally,['Protection']);
  assert.deepEqual(b.snapshot.field.foe,['Piège de Roc','Mur Lumière']);
  b.onProtocol('|-sideend|p2: N|move: Light Screen');
  assert.deepEqual(b.snapshot.field.foe,['Piège de Roc']);
  assert.deepEqual(b.snapshot.field.ally,['Protection']);
  assert.equal(frames.filter(f=>f.kind==='-sidestart').length,3);
});
test('pas de duplication des effets de terrain',()=>{
  const {b,frames}=make();b.onProtocol('|-fieldstart|move: Trick Room');b.onProtocol('|-fieldstart|move: Trick Room');
  b.onProtocol('|-sidestart|p1: Dresseur|move: Reflect');b.onProtocol('|-sidestart|p1: Dresseur|move: Reflect');
  assert.equal(frames.length,2);
  assert.deepEqual(b.snapshot.field.global,['Distorsion']);
});
test('le changement de Pokémon de N change le slot de sprite, les dégâts et les K.O. de la bonne cible',()=>{
  const {b,frames}=make();b.onProtocol('|switch|p2a: Zekrom|Zekrom, L100|100/100');
  b.onProtocol('|switch|p2a: Carracosta|Carracosta, L100|100/100');
  assert.equal(b.snapshot.foeActive,1);
  assert.equal(frames.at(-1).state.foeActive,1);
  b.onProtocol('|-damage|p2a: Carracosta|23/100');
  assert.equal(b.snapshot.foes[1].hp,23);
  assert.equal(b.snapshot.foes[0].hp,100);
  b.onProtocol('|faint|p2a: Carracosta');assert.equal(b.snapshot.foes[1].fainted,true);
});
test('le changement de Pokémon du joueur actualise le slot actif, sans effacer les PV précédents',()=>{
  const {b}=make(); const first=b.snapshot.allies[0],second=b.snapshot.allies[1];
  b.onProtocol(`|switch|p1a: ${first.label}|${teams.teamFor('2026-10-14')[b.teamOrder[0]].species}, L100|100/100`);
  b.onProtocol(`|-damage|p1a: ${first.label}|25/100`);
  b.onProtocol(`|switch|p1a: ${second.label}|${teams.teamFor('2026-10-14')[b.teamOrder[1]].species}, L100|100/100`);
  assert.equal(b.snapshot.allyActive,1);
  assert.equal(b.snapshot.allies[0].hp,25);
  assert.equal(b.snapshot.allies[1].hp,100);
});
test('les durées gardent une animation visible pour les PV sans pause sur le texte décoratif',()=>{
  assert.ok(frameDuration('-damage','normal')>=850);
  assert.ok(frameDuration('-heal','normal')>=850);
  assert.ok(frameDuration('move','normal')<frameDuration('-damage','normal'));
  assert.ok(frameDuration('move','fast')<frameDuration('move','normal'));
  assert.ok(frameDuration('move','normal')<frameDuration('move','cinematic'));
  assert.equal(animatesHP('-damage'),true);assert.equal(animatesHP('turn'),false);
  assert.equal(shouldPresent('-crit'),false);assert.equal(shouldPresent('-damage'),true);
});
test('le CSS de barre de PV possède une transition proche de la durée de l’événement',()=>{
  const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  assert.match(css,/\.hp-progress\s*\{[^}]*transition:width \.86s/s);
  assert.ok(frameDuration('-damage','normal')>=860);
});
test('navigation séparée et retour au défi présents dans toutes les sections importantes',()=>{
  const ui=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8');
  for(const screen of ["'home'","'challenge'","'team'","'stats'"])assert.ok(ui.includes(screen));
  assert.match(ui,/screen==='home'/);
  assert.match(ui,/screen==='challenge'/);
  assert.match(ui,/screen==='team'/);
  assert.match(ui,/RETOUR AU DÉFI/);
  assert.match(ui,/ÉTAT DU TERRAIN/);
  assert.match(readFileSync(new URL('../README.md',import.meta.url),'utf8'),/PokeAPI/);
});

test('régression Carchacrok : changements successifs de sprite issus des protocoles Showdown',()=>{
  const original=teams.teamFor('2026-10-14');
  const {b,frames}=make();
  const ordered=b.teamOrder.map(i=>original[i]);
  const current=()=>{
    const v=b.snapshot;
    const slot=visibleActiveSlot(v.allies,v.allyActive);
    return activeSpecies(original,v.allies[slot],0).id;
  };
  const expected=[0,3,5,1,0];
  for(const i of expected){
    const mon=ordered[i];
    b.onProtocol(`|switch|p1a: ${mon.label}|${mon.species}, L100|100/100`);
    assert.equal(current(),mon.id,`sprite attendu : ${mon.label}`);
    assert.equal(b.snapshot.allies[b.snapshot.allyActive].id,mon.id);
    assert.equal(frames.at(-1).state.allies[frames.at(-1).state.allyActive].id,mon.id);
  }
});
test('après K.O., le sprite suit le remplaçant au lieu de rester sur le vaincu',()=>{
  const {b}=make(),mons=b.snapshot.allies;
  const first=mons[0],second=mons[2];
  const ordered=b.teamOrder.map(i=>teams.teamFor('2026-10-14')[i]);
  b.onProtocol(`|switch|p1a: ${first.label}|${ordered[0].species}, L100|100/100`);
  b.onProtocol(`|faint|p1a: ${first.label}`);
  b.onProtocol(`|switch|p1a: ${second.label}|${ordered[2].species}, L100|87/100`);
  const view=b.snapshot;
  const mon=view.allies[visibleActiveSlot(view.allies,view.allyActive)];
  assert.equal(mon.id,second.id);
  assert.equal(mon.hp,87);
  assert.equal(view.allies[0].fainted,true);
});
