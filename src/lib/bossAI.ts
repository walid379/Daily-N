import {Dex} from '@pkmn/sim';
import type {SimRequest, RequestPokemon} from '../engine/showdown';
import type {TeamMon} from '../data/teams';

const gen=Dex.mod('gen5');
const powerOverrides:Record<string,number>={return:102,geargrind:100,acrobatics:55};

function speciesOf(mon:RequestPokemon) {
  return gen.species.get(mon.details.split(',')[0].trim());
}

function attackScore(moveName:string, attacker:ReturnType<typeof gen.species.get>, target:TeamMon):number {
  const move=gen.moves.get(moveName);
  const defender=gen.species.get(target.species);
  if(!move.exists || move.category==='Status' || !defender.exists) return 0;
  if(!gen.getImmunity(move.type,defender)) return 0;
  const effectiveness=Math.pow(2,gen.getEffectiveness(move.type,defender));
  const stab=attacker.types.includes(move.type)?1.5:1;
  const accuracy=typeof move.accuracy==='number'?move.accuracy/100:1;
  const atk=move.category==='Physical'?attacker.baseStats.atk:attacker.baseStats.spa;
  const def=move.category==='Physical'?defender.baseStats.def:defender.baseStats.spd;
  return (powerOverrides[move.id]||move.basePower||40)*accuracy*stab*effectiveness*atk/Math.max(1,def);
}

function viableBench(request:SimRequest):Array<{slot:number;mon:RequestPokemon}> {
  return (request.side?.pokemon||[]).flatMap((mon,i)=>
    !mon.active && !mon.condition.includes('fnt') && !mon.condition.startsWith('0') ? [{slot:i+1,mon}] : []);
}

function bestSwitch(request:SimRequest, target:TeamMon, random:()=>number):string {
  const bench=viableBench(request);
  if(!bench.length) return 'pass';
  const scored=bench.map(({slot,mon})=>{
    const species=speciesOf(mon);
    const best=Math.max(0,...mon.moves.map(move=>attackScore(move,species,target)));
    const defender=gen.species.get(target.species);
    const resistance=defender.types.reduce((score,type)=>{
      if(!gen.getImmunity(type,species)) return score+2;
      return score+Math.max(0,-gen.getEffectiveness(type,species));
    },0);
    return {slot,score:best*(1+resistance*.1)+random()*.001};
  });
  scored.sort((a,b)=>b.score-a.score);
  return `switch ${scored[0].slot}`;
}

/** Décisions du boss seulement : les règles et dégâts restent ceux de Showdown. */
export function chooseBossAction(request:SimRequest, random:()=>number, target:TeamMon):string {
  if(request.wait) return '';
  if(request.teamPreview) return 'team 123456';
  if(request.forceSwitch?.some(Boolean)) return bestSwitch(request,target,random);
  const active=request.active?.[0];
  if(!active) return 'pass';
  const attacker=request.side?.pokemon.find(mon=>mon.active);
  const species=attacker?speciesOf(attacker):gen.species.get('Zekrom');
  const scored=active.moves.map((move,i)=>({move,i}))
    .filter(({move})=>!move.disabled && move.pp>0)
    .map(({move,i})=>({i,score:attackScore(move.id||move.move,species,target)+random()*.001}));
  if(!scored.length) return 'move 1'; // Lutte si aucun PP utilisable.
  scored.sort((a,b)=>b.score-a.score);
  if(scored[0].score<1 && !active.trapped && viableBench(request).length)
    return bestSwitch(request,target,random);
  return `move ${scored[0].i+1}`;
}
