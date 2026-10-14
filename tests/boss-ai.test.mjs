import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
function importTS(file) {
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const m={exports:{}};
 new Function('require','module','exports',code)(require,m,m.exports);
 return m.exports;
}
const {chooseBossAction}=importTS('../src/lib/bossAI.ts');
const opponent=species=>({species});
const mon=(species,condition='100/100',active=false,moves=[])=>({details:`${species}, L100`,condition,active,moves});
const move=(name,pp=10)=>({move:name,id:name.toLowerCase().replace(/[^a-z]/g,''),pp,maxpp:pp});

test('N choisit le meilleur remplaçant après un K.O., pas un banc au hasard',()=>{
 const request={forceSwitch:[true],side:{pokemon:[mon('Zekrom','0 fnt',true),mon('Klinklang','100/100',false,['Gear Grind','Wild Charge']),mon('Carracosta','100/100',false,['Stone Edge','Waterfall']),mon('Vanilluxe','100/100',false,['Ice Beam'])]}};
 assert.equal(chooseBossAction(request,()=>0,opponent('Charizard')),'switch 3');
});

test('N évite les immunités et choisit une attaque qui touche',()=>{
 const request={active:[{moves:[move('Bolt Strike'),move('Dragon Claw'),move('Zen Headbutt'),move('Stone Edge')]}],
   side:{pokemon:[mon('Zekrom','100/100',true)]}};
 assert.equal(chooseBossAction(request,()=>0,opponent('Golem')),'move 2');
});

test('N tient compte du STAB et de la précision, pas seulement de la puissance brute',()=>{
 const request={active:[{moves:[move('Bolt Strike'),move('Dragon Claw'),move('Zen Headbutt'),move('Stone Edge')]}],
   side:{pokemon:[mon('Zekrom','100/100',true)]}};
 assert.equal(chooseBossAction(request,()=>0,opponent('Darmanitan')),'move 1');
});

test('N ne tente pas de coup interdit quand un PP est épuisé',()=>{
 const request={active:[{moves:[move('Bolt Strike',0),move('Dragon Claw')]}],
   side:{pokemon:[mon('Zekrom','100/100',true)]}};
 assert.equal(chooseBossAction(request,()=>0,opponent('Gyarados')),'move 2');
});
