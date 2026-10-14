import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function importTS(file,deps={}){
 const js=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
 const m={exports:{}};new Function('require','module','exports',js)(p=>deps[p]??require(p),m,m.exports);return m.exports;
}
const daily=importTS('../src/data/daily.ts');
const pool=JSON.parse(readFileSync(new URL('../src/data/pool.json',import.meta.url),'utf8'));
const teams=importTS('../src/data/teams.ts',{'./daily':daily,'./pool.json':pool});
const {Dex}=require('@pkmn/sim'), gen=Dex.mod('gen5');

test('les 83 sets joueurs ont IV maximaux, EV concentrés, nature utile et options Gen 5 existantes',()=>{
 for(const mon of pool){
  const set=teams.asSet(mon);
  assert.deepEqual(Object.values(set.ivs),[31,31,31,31,31,31],mon.label);
  const evs=Object.values(set.evs);
  assert.equal(evs.reduce((a,b)=>a+b,0),508,mon.label);
  assert.ok(evs.every(v=>v>=0&&v<=252),mon.label);
  assert.notEqual(set.nature,'Serious',mon.label);
  assert.ok(gen.natures.get(set.nature).exists,`${mon.label}: nature ${set.nature}`);
  assert.ok(gen.items.get(set.item).exists,`${mon.label}: objet ${set.item}`);
  assert.ok(gen.abilities.get(set.ability).exists,`${mon.label}: talent ${set.ability}`);
  for(const move of set.moves)assert.ok(gen.moves.get(move).exists,`${mon.label}: ${move}`);
 }
});

test('les capacités et objets de tous les sets respectent les règles de disponibilité en génération V',()=>{
 const validator=require('@pkmn/sim').TeamValidator.get('gen5ubers');
 const sets=[...pool,...teams.bossFor('2026-10-14'),...teams.bossFor('2026-10-15')];
 const failures=sets.flatMap(mon=>{
   const errors=validator.validateTeam([teams.asSet(mon)]);
   return errors ? [`${mon.label}: ${errors.join('; ')}`] : [];
 });
 assert.deepEqual(failures,[]);
});

test('les six sets de N des deux jours ont une couverture Gen 5, un objet et des EV adaptés',()=>{
 for(const key of ['2026-10-14','2026-10-15']){
  const boss=teams.bossFor(key);
  assert.equal(boss.length,6);
  for(const mon of boss){
   assert.ok(mon.item,`${mon.label}: objet absent`);
   const set=teams.asSet(mon);
   assert.equal(Object.values(set.evs).reduce((a,b)=>a+b,0),508,mon.label);
   assert.notEqual(set.nature,'Serious',mon.label);
   assert.ok(set.moves.every(m=>gen.moves.get(m).exists),`${mon.label}: capacité invalide`);
  }
 }
});
