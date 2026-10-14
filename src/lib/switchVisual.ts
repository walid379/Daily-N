import type {BattleFrame,ViewState} from '../engine/showdown';

export interface SwitchPlan {
  actor: 'p1' | 'p2';
  from: {id:number;label:string} | null;
  to: {id:number;label:string};
}

/** Décrit l'animation d'un snapshot, sans envoyer de commande au moteur. */
export function planSwitch(previous:ViewState|null, frame:BattleFrame):SwitchPlan|null {
  if ((frame.kind!=='switch' && frame.kind!=='drag') || !frame.actor) return null;
  const player=frame.actor==='p1';
  const next=frame.state;
  const current=player?next.allies[next.allyActive]:next.foes[next.foeActive];
  if (!current) return null;
  const prior=previous && (player?previous.allies[previous.allyActive]:previous.foes[previous.foeActive]);
  const from=prior && prior.id!==current.id && prior.hp>0 && !prior.fainted
    ? {id:prior.id,label:prior.label} : null;
  return {actor:frame.actor,from,to:{id:current.id,label:current.label}};
}
