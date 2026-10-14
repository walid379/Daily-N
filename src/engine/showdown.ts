/**
 * Adaptateur Pokémon Showdown Gen 5. Toute la physique (statuts, talents, dégâts,
 * objets, météo, recharge, Illusion...) est déléguée à @pkmn/sim.
 * On ne simule ici que les décisions du bot et la présentation du protocole.
 */
import {BattleStreams, Teams, Dex} from '@pkmn/sim';
import {battleSeed, hash32, rng} from '../data/daily';
import {asSet, bossFor, teamFor, type TeamMon} from '../data/teams';

export type Outcome = 'win' | 'loss' | 'draw';
export interface RequestMove {move: string; id: string; pp: number; maxpp: number; disabled?: boolean; target?: string}
export interface RequestPokemon {ident: string; details: string; condition: string; active: boolean; moves: string[]; baseAbility?: string; item?: string}
export interface SideRequest {name: string; id: string; pokemon: RequestPokemon[]}
export interface SimRequest {wait?: boolean; teamPreview?: boolean; forceSwitch?: boolean[]; active?: Array<{moves: RequestMove[]; trapped?: boolean; maybeTrapped?: boolean}>; side?: SideRequest}
export interface MonView {id: number; label: string; hp: number; maxHp: number; condition: string; active: boolean; fainted: boolean}
export interface FieldState {
  weather: string | null;
  global: string[];
  ally: string[];
  foe: string[];
}
export interface ViewState {
  field: FieldState;
  started: boolean; busy: boolean; turn: number; request: SimRequest | null;
  allies: MonView[]; foes: MonView[]; allyActive: number; foeActive: number;
  logs: string[]; outcome: Outcome | null; error: string | null;
}
export interface BattleFrame {state: ViewState; kind: string; actor: 'p1' | 'p2' | null; message: string}
export type Choice = string; // 'move 1', 'switch 3', 'team 123456'

function condition(raw: string): {hp: number; maxHp: number; status: string} {
  const hp = /^(\d+)\/(\d+)/.exec(raw || '');
  if (!hp) return {hp: raw?.startsWith('0') ? 0 : 100, maxHp: 100, status: raw?.includes('fnt') ? 'fnt' : ''};
  return {hp:Number(hp[1]),maxHp:Number(hp[2]), status: raw.split(' ').slice(1).join(' ')};
}
function toView(spec: TeamMon, active = false): MonView {
  return {id:spec.id, label:spec.label, hp:100,maxHp:100,condition:'',active,fainted:false};
}
const statName = (key:string):string => ({atk:'son Attaque',def:'sa Défense',spa:'son Attaque Spé.',spd:'sa Défense Spé.',spe:'sa Vitesse',accuracy:'sa Précision',evasion:'son Esquive'} as Record<string,string>)[key] || key;
const FIELD_LABELS: Record<string,string> = {
  raindance:'Pluie', sunnyday:'Soleil', sandstorm:'Tempête de sable', hail:'Grêle',
  trickroom:'Distorsion', wonderroom:'Zone Étrange', magicroom:'Zone Magique',
  gravity:'Gravité', lightcreen:'Mur Lumière', lightscreen:'Mur Lumière',
  reflect:'Protection', safeguard:'Rune Protect', mist:'Brume', tailwind:'Vent Arrière',
  spikes:'Picots', toxicspikes:'Pics Toxik', stealthrock:'Piège de Roc', stickyweb:'Toile Gluante',
  grassyterrain:'Champ Herbu', electricterrain:'Champ Électrifié',
  mistyterrain:'Champ Brumeux', psychicterrain:'Champ Psychique',
};
function effectName(raw: string): string {
  const name = raw.replace(/^(move|ability):\s*/i,'').trim();
  return FIELD_LABELS[name.toLowerCase().replace(/[^a-z]/g,'')] || name;
}
const PRESENTATION_KINDS = new Set([
  'move','switch','drag','replace','-damage','-heal','faint','-status','-curestatus',
  '-weather','-fieldstart','-fieldend','-sidestart','-sideend',
  '-miss','cant','-fail','win','tie',
]);
export function shouldPresent(kind: string): boolean {return PRESENTATION_KINDS.has(kind);}
function setEffect(list: string[], effect: string, enabled: boolean): void {
  const i=list.indexOf(effect);
  if(enabled && i<0) list.push(effect);
  if(!enabled && i>=0) list.splice(i,1);
}
const SNAMES: Record<string,string> = {
  brn:'brûlure', par:'paralysie', psn:'empoisonnement', tox:'empoisonnement grave', slp:'sommeil', frz:'gel'
};
function prettify(id: string): string {return id.replace(/^p[12][a-z]?: /,'').trim();}

function logMessage(line: string): string | null {
  const [ ,kind, ...a] = line.split('|');
  const who = prettify(a[0] || '');
  switch(kind) {
    case 'start': return 'Le combat commence !';
    case 'turn': return `Tour ${a[0]}`;
    case 'switch': case 'drag': case 'replace': return `${who} entre sur le terrain.`;
    case 'move': return `${who} utilise ${a[1]}.`;
    case '-damage': return `${who} perd des PV.`;
    case '-heal': return `${who} récupère des PV.`;
    case 'faint': return `${who} est K.O. !`;
    case '-supereffective': return 'C’est super efficace !';
    case '-resisted': return 'Ce n’est pas très efficace…';
    case '-immune': return 'Cela n’affecte pas sa cible.';
    case '-crit': return 'Coup critique !';
    case '-miss': return 'L’attaque a raté.';
    case 'cant': return `${who} ne peut pas attaquer.`;
    case '-status': return `${who} subit : ${SNAMES[a[1]] || a[1]}.`;
    case '-curestatus': return `${who} n’a plus de problème de statut.`;
    case '-weather': return a[0] === 'none' ? 'La météo se calme.' : `Météo : ${effectName(a[0])}.`;
    case '-fieldstart': return `${effectName(a[0])} entre en jeu.`;
    case '-fieldend': return `${effectName(a[0])} prend fin.`;
    case '-sidestart': return `${effectName(a[1])} : ${a[0]?.startsWith('p1')?'votre camp':'camp de N'}.`;
    case '-sideend': return `${effectName(a[1])} disparaît.`;
    case '-ability': return `Talent activé : ${a[1] || '?'}.`;
    case '-item': return `${who} révèle ${a[1]}.`;
    case '-boost': return `${who} augmente ${statName(a[1])}${a[2] ? ` (+${a[2]})` : ''}.`;
    case '-unboost': return `${who} baisse ${statName(a[1])}${a[2] ? ` (−${a[2]})` : ''}.`;
    case '-fail': return 'L’attaque a échoué.';
    case '-recharge': return `${who} doit se reposer.`;
    case 'win': return `Victoire de ${a[0]}.`;
    case 'tie': return 'Match nul.';
    default: return null;
  }
}

/** Score de décision tactique basique : l'IA n'altère jamais les règles de combat. */
function aiDecision(req: SimRequest, random: () => number, target: TeamMon): string {
  if (req.wait) return '';
  if (req.teamPreview) return 'team 123456';
  if (req.forceSwitch?.some(Boolean)) {
    const options = (req.side?.pokemon || []).flatMap((p,i) => !p.active && !condition(p.condition).status.includes('fnt') && condition(p.condition).hp > 0 ? [i+1] : []);
    return options.length ? `switch ${options[Math.floor(random() * options.length)]}` : 'pass';
  }
  const active = req.active?.[0];
  if (!active) return 'pass';
  const candidates = active.moves.map((m,i) => ({m,i})).filter(({m}) => !m.disabled && m.pp > 0);
  if (!candidates.length) return 'move 1'; // Lutte : Pokémon Showdown la gère quand PP épuisés.
  const gen = Dex.mod('gen5');
  const scored = candidates.map(({m,i}) => {
    const move = gen.moves.get(m.id || m.move);
    const species = gen.species.get(target.species);
    // Les mouvements de statut conservent une probabilité d'utilisation.
    const effectiveness = move.exists && species.exists ? Math.pow(2, gen.getEffectiveness(move.type, species)) : 1;
    const power = (move.basePower || 32) * Math.max(.2, effectiveness);
    const accuracy = typeof move.accuracy === 'number' ? move.accuracy / 100 : 1;
    return {i,score: power * accuracy + random() * 26};
  });
  scored.sort((a,b)=>b.score-a.score);
  return `move ${scored[0].i+1}`;
}

export class DailyBattle {
  private key: string;
  private callbacks: {onState: (value: ViewState) => void; onEnd: (result: Outcome) => void; onEvent?: (frame: BattleFrame) => void};
  private players: ReturnType<typeof BattleStreams.getPlayerStreams> | null = null;
  private order: number[];
  private team: TeamMon[];
  private enemy: TeamMon[];
  private random: () => number;
  private replay: Choice[];
  private completedChoices: Choice[] = [];
  private active = true;
  private replaying = false;
  private state: ViewState;
  public readonly isPractice: boolean;

  constructor(options: {
    key: string; lead: number; isPractice: boolean; replay?: Choice[];
    onState: (value: ViewState) => void; onEnd: (result: Outcome) => void; onEvent?: (frame: BattleFrame) => void;
  }) {
    this.key = options.key;
    this.isPractice = options.isPractice;
    this.callbacks = {onState: options.onState, onEnd: options.onEnd, onEvent: options.onEvent};
    const player = teamFor(this.key);
    const lead = Math.min(5, Math.max(0, options.lead));
    this.order = [lead, ...player.map((_,i)=>i).filter(i=>i!==lead)];
    this.team = this.order.map(i=>player[i]);
    this.enemy = bossFor(this.key);
    this.random = rng(hash32(`daily-n-ai-v2:${this.key}`));
    this.replay = [...(options.replay || [])];
    this.replaying = this.replay.length > 0;
    this.state = {
      started: true, busy: false, turn: 0, request: null,
      allies:this.team.map((p,i)=>toView(p,i===0)),
      foes:this.enemy.map((p,i)=>toView(p,i===0)), allyActive:0, foeActive:0,
      field:{weather:null,global:[],ally:[],foe:[]},
      logs:[],
      outcome:null,error:null,
    };
  }
  get snapshot(): ViewState { return structuredClone(this.state); }
  get actions(): Choice[] { return [...this.completedChoices]; }
  get teamOrder(): number[] { return [...this.order]; }
  get isReplaying(): boolean {return this.replaying;}
  private emit(): void { if (this.active) this.callbacks.onState(this.snapshot); }
  private write(command: string): void {void this.players?.omniscient.write(command);}
  private addLog(message: string): void {
    if (!message || this.state.logs.at(-1) === message) return;
    this.state.logs.push(message); this.state.logs = this.state.logs.slice(-50);
  }

  async start(): Promise<void> {
    try {
      this.players = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
      void this.readPlayer(this.players.p1, 'p1');
      void this.readPlayer(this.players.p2, 'p2');
      // Ne pas lire omniscient : les flux joueurs filtrent déjà les vues privées.
      const spec = {formatid:'gen5customgame',seed:battleSeed(this.key), rated:false};
      // Cast structurel : @pkmn/sim déclare davantage de champs optionnels.
      const p1spec = {name:'Dresseur',team:Teams.pack(this.team.map(asSet) as Parameters<typeof Teams.pack>[0])};
      const p2spec = {name:'N',team:Teams.pack(this.enemy.map(asSet) as Parameters<typeof Teams.pack>[0])};
      this.write(`>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`);
      this.emit();
    } catch (error) {this.fail(error);}
  }
  private async readPlayer(stream: AsyncIterable<string>, side:'p1'|'p2'): Promise<void> {
    try {
      for await (const chunk of stream) {
        if (!this.active) break;
        for (const line of String(chunk).split('\n')) {
          if (!line) continue;
          if(line.startsWith('|request|')) {
            const raw = line.slice('|request|'.length);
            if (!raw) continue;
            const request = JSON.parse(raw) as SimRequest;
            if(side==='p1') this.onRequest(request);
            else if(!request.wait && !this.state.outcome) {
              const target = this.team[this.state.allyActive] || this.team[0];
              const choice = aiDecision(request,this.random,target);
              if(choice) this.write(`>p2 ${choice}`);
            }
          } else if(side==='p1') this.onProtocol(line);
        }
        this.emit();
      }
    } catch(error) {if (this.active) this.fail(error);}
  }
  private onRequest(request: SimRequest): void {
    this.state.request = request;
    this.state.busy = false;
    if(request.side) {
      for(const view of this.state.allies) view.active=false;
      request.side.pokemon.forEach((mon) => {
        const name=prettify(mon.ident);
        const species=(mon.details||'').split(',')[0];
        const slot=this.team.findIndex(p=>p.label===name || p.species===species);
        const view=this.state.allies[slot]; if(!view) return;
        const hp=condition(mon.condition);
        Object.assign(view,{hp:hp.hp,maxHp:hp.maxHp,condition:hp.status,active:mon.active,fainted:hp.hp<=0});
        if(mon.active) this.state.allyActive=slot;
      });
    }
    if (request.wait || this.state.outcome) return;
    if (request.teamPreview && this.replay.length === 0) {this.choose('team 123456');return;}
    if(this.replay.length) {
      const action = this.replay.shift()!;
      this.choose(action, true);
      if (!this.replay.length) this.replaying = false;
    } else if (this.replaying) {
      this.replaying = false;
    }
  }
  private onProtocol(line: string): void {
    const parts = line.split('|'); const type = parts[1];
    if(type==='turn') this.state.turn = Number(parts[2]) || this.state.turn;
    let fieldChanged=true;
    if(type==='-weather') {
      const nextWeather=parts[2] === 'none'?null:effectName(parts[2] || '');
      fieldChanged=this.state.field.weather!==nextWeather;
      this.state.field.weather=nextWeather;
    }
    if(type==='-fieldstart' || type==='-fieldend') {
      const effect=effectName(parts[2] || '');
      fieldChanged=this.state.field.global.includes(effect)!==(type==='-fieldstart');
      setEffect(this.state.field.global,effect,type==='-fieldstart');
    }
    if(type==='-sidestart' || type==='-sideend') {
      const side=parts[2]?.startsWith('p1')?this.state.field.ally:this.state.field.foe;
      const effect=effectName(parts[3] || '');
      fieldChanged=side.includes(effect)!==(type==='-sidestart');
      setEffect(side,effect,type==='-sidestart');
    }
    if(type==='error') {this.state.error = parts.slice(2).join(' | '); this.state.busy = false;}
    if(['switch','drag','replace'].includes(type)) {
      const id = parts[2] || '';
      const playerSide = id.startsWith('p1');
      const list = playerSide ? this.team : this.enemy;
      const species = (parts[3] || '').split(',')[0];
      let index = list.findIndex(mon=>mon.species.toLowerCase()===species.toLowerCase() || mon.label.toLowerCase()===prettify(id).toLowerCase());
      if(index<0) index = list.findIndex(mon=>mon.label.toLowerCase()===prettify(id).toLowerCase());
      if(index>=0) {
        const mons = playerSide ? this.state.allies : this.state.foes;
        for(const mon of mons) mon.active=false;
        mons[index].active=true;
        if(playerSide) this.state.allyActive=index; else this.state.foeActive=index;
      }
    }
    if(['switch','drag','replace','-damage','-heal','-sethp'].includes(type)) {
      const id=parts[2]||'', playerSide=id.startsWith('p1');
      const mon = playerSide ? this.state.allies[this.state.allyActive] : this.state.foes[this.state.foeActive];
      const raw = ['switch','drag','replace'].includes(type) ? parts[4] : parts[3];
      // L'Illusion peut masquer l'identité adverse, mais les PV restent ceux de l'actif.
      if(mon && raw) {
        const hp=condition(raw);
        Object.assign(mon,{hp:hp.hp,maxHp:hp.maxHp,condition:hp.status,fainted:hp.hp<=0});
      }
    }
    if(type==='faint') {
      const id=parts[2]||'', playerSide=id.startsWith('p1');
      const mon = playerSide ? this.state.allies[this.state.allyActive] : this.state.foes[this.state.foeActive];
      if(mon){mon.hp=0;mon.fainted=true;}
    }
    if(type==='win' || type==='tie') {
      const outcome: Outcome = type==='tie' ? 'draw' : parts[2] === 'Dresseur' ? 'win' : 'loss';
      if(!this.state.outcome) {this.state.outcome=outcome;this.state.busy=false;this.state.request=null;this.callbacks.onEnd(outcome);}
    }
    const message = logMessage(line);
    if(message && fieldChanged) {
      const before=this.state.logs.at(-1);
      this.addLog(message);
      if(before!==this.state.logs.at(-1)) {
        const actor: 'p1'|'p2'|null = (parts[2]||'').startsWith('p1')?'p1':(parts[2]||'').startsWith('p2')?'p2':null;
        if (shouldPresent(type)) this.callbacks.onEvent?.({state:this.snapshot,kind:type,actor,message});
      }
    }
  }
  choose(action: Choice, fromReplay=false): boolean {
    if(!this.active || this.state.outcome || !this.state.request || this.state.busy) return false;
    if (!/^(move [1-4]|switch [1-6]|team [1-6]{6}|pass)$/.test(action)) return false;
    // Le simulateur rejette toujours les décisions illégales ; l'UI vérifie aussi.
    const req = this.state.request;
    if(action.startsWith('move ')) {
      const slot = Number(action.split(' ')[1]) - 1;
      const move = req.active?.[0]?.moves[slot];
      if (!move || move.disabled || move.pp <= 0 || req.forceSwitch?.some(Boolean)) return false;
    }
    if(action.startsWith('switch ')) {
      const pos=Number(action.split(' ')[1])-1, mon=req.side?.pokemon[pos];
      if(!mon || mon.active || condition(mon.condition).hp <= 0 || (req.active?.[0]?.trapped && !req.forceSwitch?.some(Boolean))) return false;
    }
    this.state.busy = true;
    this.state.error = null;
    this.completedChoices.push(action);
    this.write(`>p1 ${action}`);
    if(!fromReplay) this.emit();
    return true;
  }
  private fail(error: unknown): void {
    this.state.busy = false;
    this.state.error = error instanceof Error ? error.message : String(error);
    this.addLog(`Erreur du simulateur : ${this.state.error}`);
    this.emit();
  }
  destroy(): void {this.active=false; this.players=null;}
}
