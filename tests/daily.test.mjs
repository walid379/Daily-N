import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function importTS(file,deps={}) {
  const content=readFileSync(new URL(file,import.meta.url),'utf8');
  const code=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports',code)((path)=>deps[path]??require(path),m,m.exports);
  return m.exports;
}
const daily=importTS('../src/data/daily.ts');
const pool=JSON.parse(readFileSync(new URL('../src/data/pool.json',import.meta.url),'utf8'));
const teams=importTS('../src/data/teams.ts',{'./daily':daily,'./pool.json':pool});

test('Zekrom / Reshiram alternent à chaque date civile, sans réinitialisation mensuelle',()=>{
  assert.equal(daily.dragonFor('2026-10-14'),'Zekrom');
  assert.equal(daily.dragonFor('2026-10-15'),'Reshiram');
  assert.equal(daily.dragonFor('2026-10-16'),'Zekrom');
  assert.notEqual(daily.dragonFor('2026-10-31'),daily.dragonFor('2026-11-01'));
});
test('minuit Paris reste cohérent en été et lors du changement d’heure',()=>{
  const winter=daily.parisNextMidnight('2026-01-14');
  const summer=daily.parisNextMidnight('2026-07-14');
  assert.equal(new Date(winter).toISOString(),'2026-01-14T23:00:00.000Z');
  assert.equal(new Date(summer).toISOString(),'2026-07-14T22:00:00.000Z');
  assert.equal(daily.parisNextMidnight('2026-10-25')-daily.parisNextMidnight('2026-10-24'),25*3600000);
});
test('identité des équipes et absence de doublons',()=>{
  assert.equal(pool.length,83);
  for(let i=0;i<200;i++) {
    const key=new Date(Date.UTC(2026,9,14+i)).toISOString().slice(0,10);
    const team=teams.teamFor(key);
    assert.deepEqual(team,teams.teamFor(key));
    assert.equal(team.length,6);
    assert.equal(new Set(team.map(p=>p.id)).size,6);
    for(const mon of team) {assert.equal(mon.moves.length,4);assert.ok(mon.species.length>0);}
  }
});
test('N conserve ses cinq Pokémon et son ordre',()=>{
  const a=teams.bossFor('2026-10-14'), b=teams.bossFor('2026-10-15');
  assert.equal(a[0].species,'Zekrom');assert.equal(b[0].species,'Reshiram');
  assert.deepEqual(a.slice(1),b.slice(1));
  assert.deepEqual(a.map(x=>x.id).slice(1),[565,584,567,571,601]);
});
test('graine de combat stable et sensible à la date',()=>{
  const a=daily.battleSeed('2026-10-14');
  assert.deepEqual(a,daily.battleSeed('2026-10-14'));
  assert.notDeepEqual(a,daily.battleSeed('2026-10-15'));
  assert.equal(a.length,4);
  assert.ok(a.every(v=>Number.isInteger(v)&&v>=0&&v<65536));
});

test('palmarès sans double comptage et séries consécutives',()=>{
  const storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val),removeItem:key=>storage.delete(key)};
  const m=importTS('../src/lib/storage.ts',{'../data/daily':daily});
  let stats=m.readStats();
  stats=m.recordResult(stats,'2026-10-14','win');
  stats=m.recordResult(stats,'2026-10-14','win');
  assert.equal(stats.played,1);
  stats=m.recordResult(stats,'2026-10-15','win');
  assert.equal(stats.streak,2);
  stats=m.recordResult(stats,'2026-10-16','loss');
  assert.equal(stats.played,3);
  assert.equal(stats.streak,0);
  assert.equal(stats.best,2);
  m.writeStats(stats);
  assert.equal(m.readStats().wins,2);
});
