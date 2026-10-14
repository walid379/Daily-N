import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function importTS(file){
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',js)(require,module,module.exports);return module.exports;
}
const mon=(id,label,hp=100)=>({id,label,hp,active:true,fainted:hp===0});
const state=(ally,foe)=>({allies:[ally],foes:[foe],allyActive:0,foeActive:0});

test('un changement volontaire rappelle le Pokémon actif puis envoie le nouveau',()=>{
 const {planSwitch}=importTS('../src/lib/switchVisual.ts');
 const old=state(mon(1,'A'),mon(2,'B'));
 const next={kind:'switch',actor:'p1',state:state(mon(3,'C'),mon(2,'B'))};
 assert.deepEqual(planSwitch(old,next),{actor:'p1',from:{id:1,label:'A'},to:{id:3,label:'C'}});
});

test('le remplaçant après K.O. apparaît sans rappeler un Pokémon vaincu',()=>{
 const {planSwitch}=importTS('../src/lib/switchVisual.ts');
 const old=state(mon(1,'A',0),mon(2,'B'));
 const next={kind:'switch',actor:'p1',state:state(mon(3,'C'),mon(2,'B'))};
 assert.deepEqual(planSwitch(old,next),{actor:'p1',from:null,to:{id:3,label:'C'}});
});

test('N peut aussi changer et Illusion ne déclenche pas de Poké Ball',()=>{
 const {planSwitch}=importTS('../src/lib/switchVisual.ts');
 const old=state(mon(1,'A'),mon(2,'B'));
 const next={kind:'switch',actor:'p2',state:state(mon(1,'A'),mon(4,'D'))};
 assert.deepEqual(planSwitch(old,next),{actor:'p2',from:{id:2,label:'B'},to:{id:4,label:'D'}});
 assert.equal(planSwitch(old,{...next,kind:'replace'}),null);
 assert.equal(planSwitch(old,{...next,kind:'move'}),null);
});

test('la présentation réserve du temps au rappel et à l’envoi, avec un mode rapide plus court',()=>{
 const {frameDuration}=importTS('../src/lib/presentation.ts');
 assert.ok(frameDuration('switch','normal')>=1100);
 assert.ok(frameDuration('drag','normal')>=1100);
 assert.ok(frameDuration('switch','fast')<frameDuration('switch','normal'));
 assert.ok(frameDuration('replace','normal')<frameDuration('switch','normal'));
});

test('le premier envoi déclenche seulement l’apparition',()=>{
 const {planSwitch}=importTS('../src/lib/switchVisual.ts');
 const next={kind:'switch',actor:'p1',state:state(mon(1,'A'),mon(2,'B'))};
 assert.deepEqual(planSwitch(null,next),{actor:'p1',from:null,to:{id:1,label:'A'}});
});
