import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8');
test('la présentation corrige chaque frame et chaque état, même pendant une reprise',()=>{
 assert.match(app,/new IllusionPresentation\(/);
 assert.match(app,/illusion\.frame\(next\)/);
 assert.match(app,/illusion\.state\(next\)/);
 assert.ok(app.indexOf('illusion.frame(next)')<app.indexOf('if(restoring.value)return;timeline.push'),'les événements du replay doivent être réconciliés');
});
const require=createRequire(import.meta.url),ts=require('typescript');
function importTS(file,deps={}) {
 const js=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 const m={exports:{}};new Function('require','module','exports',js)(p=>deps[p]??require(p),m,m.exports);return m.exports;
}
const daily=importTS('../src/data/daily.ts');
const pool=JSON.parse(readFileSync(new URL('../src/data/pool.json',import.meta.url),'utf8'));
const teams=importTS('../src/data/teams.ts',{'./daily':daily,'./pool.json':pool});
const reordered={...teams,asSet:mon=>{const set=teams.asSet(mon);return mon.species==='Garchomp'?{...set,level:100}:set},bossFor:key=>{const mons=teams.bossFor(key);return [mons[4],...mons.filter((_,i)=>i!==4)]}};
const bossAI=importTS('../src/lib/bossAI.ts');
const {DailyBattle}=importTS('../src/engine/showdown.ts',{'../data/daily':daily,'../data/teams':reordered,'../lib/bossAI':bossAI});
const {IllusionPresentation}=importTS('../src/lib/illusionView.ts');
async function until(check){for(let i=0;i<500;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}throw new Error('Attente du simulateur expirée')}

test('la révélation de Zoroark conserve ses PV déjà perdus sous Illusion',async()=>{
 let raw;const frames=[];
 const battle=new DailyBattle({key:'2026-10-14',lead:0,isPractice:true,onState:s=>{raw=s},onEnd:()=>{},onEvent:f=>frames.push(f)});
 try{
  await battle.start();await until(()=>raw?.turn>=1&&raw.request?.active?.length&&!raw.busy);
  const fang=raw.request.active[0].moves.findIndex(m=>m.id==='firefang');
  assert.ok(fang>=0);battle.choose(`move ${fang+1}`);
  await until(()=>frames.some(f=>f.kind==='replace'&&f.actor==='p2')&&raw?.turn>=2);
  const presenter=new IllusionPresentation();
  const projected=frames.map(f=>presenter.frame(f));
  const revealIndex=projected.findIndex(f=>f.kind==='replace'&&f.actor==='p2');
  const reveal=projected[revealIndex];
  assert.ok(reveal);
  const priorDamage=frames.slice(0,revealIndex).filter(f=>f.kind==='-damage'&&f.actor==='p2').at(-1);
  assert.ok(priorDamage,'le Pokémon déguisé doit avoir perdu des PV');
  assert.equal(reveal.state.foes[0].hp,priorDamage.state.foes[5].hp,'les PV du déguisement appartiennent à Zoroark');
  assert.ok(reveal.state.foes[0].hp<reveal.state.foes[0].maxHp);
  assert.equal(reveal.state.foes[0].maxHp,262);
  assert.equal(reveal.state.foes[5].hp,100,'Cliticlic n’a pas subi ces dégâts');
  assert.equal(presenter.state(raw).foes[0].hp,reveal.state.foes[0].hp,'l’état final doit garder les mêmes PV');
 }finally{battle.destroy()}
});

test('une Illusion révélée après un K.O. ne met pas le vrai Cliticlic K.O.',async()=>{
 let raw;const frames=[];
 const battle=new DailyBattle({key:'2026-10-14',lead:0,isPractice:true,onState:s=>{raw=s},onEnd:()=>{},onEvent:f=>frames.push(f)});
 try{
  await battle.start();await until(()=>raw?.turn>=1&&raw.request?.active?.length&&!raw.busy);
  const quake=raw.request.active[0].moves.findIndex(m=>m.id==='earthquake');
  assert.ok(quake>=0);assert.equal(battle.choose(`move ${quake+1}`),true);
  await until(()=>frames.some(f=>f.kind==='faint'&&f.message.includes('Zoroark'))&&raw?.turn>=2);
  const presenter=new IllusionPresentation();
  const projected=frames.map(f=>presenter.frame(f));
  const reveal=projected.find(f=>f.kind==='replace'&&f.actor==='p2');
  assert.ok(reveal,'Showdown doit révéler Zoroark');
  const faint=projected.find(f=>f.kind==='faint'&&f.message.includes('Zoroark'));
  assert.ok(faint);assert.equal(faint.state.foes[0].fainted,true,'Zoroark est réellement K.O.');
  assert.equal(faint.state.foes[5].fainted,false,'Cliticlic ne doit pas partager ce K.O.');
  assert.equal(faint.state.foes[5].hp,100,'Cliticlic était indemne avant l’Illusion');
  const final=presenter.state(raw);
  assert.equal(final.foes.filter(m=>m.fainted).length,1,'le compteur adverse doit perdre une seule Poké Ball');
  assert.equal(final.foes[5].fainted,false);
 }finally{battle.destroy()}
});
