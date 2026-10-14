import type {BattleFrame,MonView,ViewState} from '../engine/showdown';

/** Corrige uniquement l'affichage du Pokémon copié par Illusion ; le simulateur reste intact. */
export class IllusionPresentation {
  private latest:ViewState|null=null;
  private appearance:{slot:number;before:MonView}|null=null;
  private restored=new Map<number,MonView>();
  private revealed:{slot:number;hp:number;maxHp:number;condition:string;fainted:boolean}|null=null;

  frame(frame:BattleFrame):BattleFrame {
    if(frame.actor==='p2' && frame.kind==='switch') {
      this.revealed=null;
      const slot=frame.state.foeActive;
      const before=this.latest?.foes[slot]??frame.state.foes[slot];
      this.restored.delete(slot);
      this.appearance=before?{slot,before:{...before}}:null;
    }
    if(frame.actor==='p2' && frame.kind==='replace' && this.appearance && frame.state.foeActive!==this.appearance.slot) {
      const shown=this.latest?.foes[this.appearance.slot];
      if(shown) this.revealed={slot:frame.state.foeActive,hp:shown.hp,maxHp:shown.maxHp,condition:shown.condition,fainted:shown.fainted};
      this.restored.set(this.appearance.slot,{...this.appearance.before,active:false});
      this.appearance=null;
    }
    if(frame.actor==='p2' && ['-damage','-heal','-sethp','faint'].includes(frame.kind)) this.revealed=null;
    return {...frame,state:this.state(frame.state)};
  }

  state(raw:ViewState):ViewState {
    const foes=raw.foes.map(mon=>({...mon}));
    for(const [slot,original] of this.restored) {
      if(slot!==raw.foeActive && foes[slot]) foes[slot]={...original,active:false};
    }
    if(this.revealed?.slot===raw.foeActive && foes[this.revealed.slot]) {
      foes[this.revealed.slot]={...foes[this.revealed.slot],hp:this.revealed.hp,maxHp:this.revealed.maxHp,condition:this.revealed.condition,fainted:this.revealed.fainted};
    }
    this.latest={...raw,foes};
    return this.latest;
  }
}
