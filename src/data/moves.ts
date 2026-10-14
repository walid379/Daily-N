/** Métadonnées des attaques récupérées dans le dex Gen 5 du moteur Showdown.
 * Les descriptions originales viennent du simulateur; le résumé est une lecture FR des effets structurés.
 */
import {Dex} from '@pkmn/sim';
import {TYPE_FR} from './teams';
const gen5 = Dex.mod('gen5');
const detailsCache = new Map<string, MoveCard>();
const stats: Record<string,string> = {atk:'Attaque',def:'Défense',spa:'Attaque Spé.',spd:'Défense Spé.',spe:'Vitesse',accuracy:'Précision',evasion:'Esquive'};
const statuses: Record<string,string> = {brn:'brûlure',par:'paralysie',psn:'poison',tox:'poison grave',slp:'sommeil',frz:'gel'};
export interface MoveCard {
  name: string; type: string; typeFr: string; category: string; categoryFr: string;
  power: string; accuracy: string; priority: number; summary: string; original: string;
  target: string; effectiveness: string; contact: boolean;
}
function chance(effect: Record<string,unknown> | null): string {
  return typeof effect?.chance === 'number' ? ` (${effect.chance} %)` : '';
}
function boosts(part:unknown, prefix:string): string[] {
  if (!part || typeof part !== 'object') return [];
  return Object.entries(part).filter(([,v])=>typeof v==='number'&&v!==0).map(([name,n])=>`${prefix} ${stats[name]||name} ${Number(n)>0?'+':''}${n}`);
}
export function moveCard(id:string, foeSpecies?:string): MoveCard {
  const cacheKey = `${id.toLowerCase()}::${foeSpecies || ''}`;
  const saved = detailsCache.get(cacheKey);
  if(saved) return saved;
  const move = gen5.moves.get(id);
  const data = move as unknown as Record<string,any>;
  const effects:string[] = [];
  if(data.status) effects.push(`Peut infliger : ${statuses[data.status]||data.status}`);
  if(data.volatileStatus) effects.push(`Effet : ${data.volatileStatus==='confusion'?'confusion':data.volatileStatus==='flinch'?'apeurement':data.volatileStatus==='leechseed'?'Vampigraine':data.volatileStatus}`);
  for(const sec of [data.secondary,...(Array.isArray(data.secondaries)?data.secondaries:[])]) {
    if(!sec || typeof sec!=='object')continue;
    if(sec.status)effects.push(`Effet secondaire${chance(sec)} : ${statuses[String(sec.status)]||sec.status}`);
    if(sec.volatileStatus)effects.push(`Effet secondaire${chance(sec)} : ${sec.volatileStatus==='flinch'?'apeurement':sec.volatileStatus==='confusion'?'confusion':sec.volatileStatus}`);
    effects.push(...boosts(sec.boosts,'Cible :').map(t=>`${t}${chance(sec)}`));
  }
  if(data.boosts)effects.push(...boosts(data.boosts,'Cible :'));
  if(data.self?.boosts)effects.push(...boosts(data.self.boosts,'Utilisateur :'));
  if(Array.isArray(data.drain))effects.push(`Récupère ${Math.round(data.drain[0]/data.drain[1]*100)} % des dégâts infligés en PV`);
  if(Array.isArray(data.recoil))effects.push(`Recul : ${Math.round(data.recoil[0]/data.recoil[1]*100)} % des dégâts infligés`);
  if(Array.isArray(data.heal))effects.push(`Restaure environ ${Math.round(data.heal[0]/data.heal[1]*100)} % des PV max`);
  if(data.multihit) effects.push(Array.isArray(data.multihit)?`Frappe ${data.multihit[0]} à ${data.multihit[1]} fois`:`Frappe ${data.multihit} fois`);
  if(data.weather)effects.push(`Modifie la météo : ${data.weather}`);
  if(data.ohko)effects.push('Peut mettre K.O. en un coup (conditions spécifiques)');
  if(data.stallingMove)effects.push('Protège le lanceur ; les utilisations successives sont moins fiables');
  if(data.priority)effects.push(`Priorité ${data.priority>0?'+':''}${data.priority} sur les attaques classiques`);
  const categoryFr=data.category==='Physical'?'PHYSIQUE':data.category==='Special'?'SPÉCIALE':'STATUT';
  const typeFr=TYPE_FR[move.type] || move.type.toUpperCase();
  let effectiveness='';
  if(foeSpecies && data.category!=='Status') {
    const target=gen5.species.get(foeSpecies);
    if(target.exists) {
      const immune=!gen5.getImmunity(move.type,target);
      const multiplier=immune?0:Math.pow(2,gen5.getEffectiveness(move.type,target));
      effectiveness=multiplier===0?'Immunité (×0)':multiplier>1?`Super efficace (×${multiplier})`:multiplier<1?`Peu efficace (×${multiplier})`:'Dégâts neutres (×1)';
    }
  }
  const card: MoveCard = {
    name:move.name||id,type:move.type,typeFr,category:move.category,categoryFr,
    power:move.basePower?String(move.basePower):data.category==='Status'?'—':'Variable',
    accuracy:move.accuracy===true?'Toujours':`${move.accuracy} %`,
    priority:Number(data.priority)||0,
    summary:effects.join(' · ')|| (move.basePower?'Inflige des dégâts à la cible.':'Consultez la description détaillée ci-dessous.'),
    original:String(move.desc||move.shortDesc||'Aucune description disponible.'),
    target:String(data.target||'normal'),effectiveness,contact:Boolean(data.flags?.contact),
  };
  detailsCache.set(cacheKey,card);
  return card;
}
