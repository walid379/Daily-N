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
const {DailyBattle}=importTS('../src/engine/showdown.ts',{'../data/daily':daily,'../data/teams':teams});
const {requestTeamIndex}=importTS('../src/lib/active.ts');
async function until(condition,ms=5000){
 const deadline=Date.now()+ms;
 while(Date.now()<deadline){if(condition())return;await new Promise(r=>setTimeout(r,20));}
 throw new Error('Le simulateur n’a pas fourni la requête attendue');
}
test('changement volontaire : le moteur accepte le remplaçant puis le retour, avec vrais PV et tours',async()=>{
 let state, result;
 const battle=new DailyBattle({key:'2026-10-14',lead:0,isPractice:true,onState:s=>{state=s},onEnd:r=>{result=r}});
 try{
  await battle.start();
  await until(()=>state?.request?.active?.length && state?.turn>=1 && !state.busy);
  assert.equal(state.allies[0].active,true);
  assert.equal(battle.choose('switch 2'),true,JSON.stringify({turn:state.turn,request:state.request,error:state.error}));
  await until(()=>state?.turn>=2 && state?.request?.active?.length && !state.busy);
  assert.equal(state.allies[1].active,true,JSON.stringify({allies:state.allies,request:state.request,logs:state.logs,error:state.error}));
  assert.equal(state.allyActive,1);
  assert.equal(state.allies[0].active,false);
  assert.equal(requestTeamIndex(state.request.side.pokemon[0],teams.teamFor('2026-10-14')),1);
  assert.equal(requestTeamIndex(state.request.side.pokemon[1],teams.teamFor('2026-10-14')),0);
  assert.equal(battle.choose('switch 2'),true,JSON.stringify(state.request?.side?.pokemon.map(p=>[p.ident,p.active])));
  await until(()=>state?.turn>=3 && state?.request?.active?.length && !state.busy);
  assert.equal(state.allies[0].active,true);
  assert.equal(state.allyActive,0);
  assert.equal(result,undefined);
 }finally{battle.destroy();}
});

test('après un K.O. réel, un remplaçant valide entre sans perdre le roster',async()=>{
 let state;
 const battle=new DailyBattle({key:'2026-10-14',lead:0,isPractice:true,onState:s=>{state=s},onEnd:()=>{}});
 try{
  await battle.start();
  await until(()=>state?.turn>=1 && state?.request?.active?.length && !state.busy);
  for(let i=0;i<60&&!state.request?.forceSwitch?.some(Boolean)&&!state.outcome;i++){
    const before=state.turn;
    const idx=state.request.active?.[0]?.moves.findIndex(m=>!m.disabled&&m.pp>0)??-1;
    assert.ok(idx>=0, 'attaque disponible');
    assert.equal(battle.choose(`move ${idx+1}`),true);
    await until(()=>state?.outcome||state?.request?.forceSwitch?.some(Boolean)||(state?.turn>before&&!state.busy));
  }
  assert.ok(state.request?.forceSwitch?.some(Boolean),'un K.O. doit imposer un remplacement');
  const slot=state.request.side.pokemon.findIndex(p=>!p.active&&!p.condition.includes('fnt'));
  assert.ok(slot>=0,'un remplaçant vivant existe');
  const target=teams.teamFor('2026-10-14')[requestTeamIndex(state.request.side.pokemon[slot],teams.teamFor('2026-10-14'))].id;
  assert.equal(battle.choose(`switch ${slot+1}`),true);
  await until(()=>state?.allies.some(p=>p.id===target&&p.active)&&!state.busy);
  assert.equal(state.allies.find(p=>p.id===target).fainted,false);
 }finally{battle.destroy();}
});
