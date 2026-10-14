import {hash32, rng, dragonFor} from './daily';
import pool from './pool.json';

export interface TeamMon {
  id: number;
  label: string;
  species: string; // National Dex ID, reconnu par Pokémon Showdown comme espèce
  types: string[];
  ability: string;
  item: string;
  moves: string[];
  base: number[];
  nature?: string;
  evs?: {hp: number; atk: number; def: number; spa: number; spd: number; spe: number};
}
export type PokemonSet = {
  name: string; species: string; ability: string; item: string;
  moves: string[]; nature: string; evs: Record<string,number>;
  ivs: Record<string,number>; level: number;
};
const CATALOG = pool as TeamMon[];
export function teamFor(key: string): TeamMon[] {
  const random = rng(hash32(`daily-n-team-v2:${key}`));
  const left = [...CATALOG];
  return Array.from({length: 6}, () => left.splice(Math.floor(random()*left.length), 1)[0]);
}
export function bossFor(key: string): TeamMon[] {
  const dragon = dragonFor(key);
  const legendary: TeamMon = dragon === 'Zekrom'
    ? {id:644,label:'Zekrom',species:'Zekrom',types:['Dragon','Electric'],base:[100,150,120,120,100,90],ability:'Teravolt',item:'Life Orb',moves:['Bolt Strike','Dragon Claw','Zen Headbutt','Stone Edge'],nature:'Adamant',evs:{hp:4,atk:252,def:0,spa:0,spd:0,spe:252}}
    : {id:643,label:'Reshiram',species:'Reshiram',types:['Dragon','Fire'],base:[100,120,100,150,120,90],ability:'Turboblaze',item:'Life Orb',moves:['Blue Flare','Dragon Pulse','Earth Power','Focus Blast'],nature:'Modest',evs:{hp:4,atk:0,def:0,spa:252,spd:0,spe:252}};
  return [legendary,
    {id:565,label:'Mégapagos',species:'Carracosta',types:['Water','Rock'],base:[74,108,133,83,65,32],ability:'Sturdy',item:'Leftovers',moves:['Waterfall','Stone Edge','Aqua Jet','Crunch'],nature:'Adamant',evs:{hp:252,atk:252,def:4,spa:0,spd:0,spe:0}},
    {id:584,label:'Sorbouboul',species:'Vanilluxe',types:['Ice'],base:[71,95,85,110,95,79],ability:'Ice Body',item:'Life Orb',moves:['Ice Beam','Blizzard','Flash Cannon','Hail'],nature:'Modest',evs:{hp:4,atk:0,def:0,spa:252,spd:0,spe:252}},
    {id:567,label:'Aéroptéryx',species:'Archeops',types:['Rock','Flying'],base:[75,140,65,112,65,110],ability:'Defeatist',item:'Flying Gem',moves:['Stone Edge','Acrobatics','Earthquake','U-turn'],nature:'Jolly',evs:{hp:4,atk:252,def:0,spa:0,spd:0,spe:252}},
    {id:571,label:'Zoroark',species:'Zoroark',types:['Dark'],base:[60,105,60,120,60,105],ability:'Illusion',item:'Life Orb',moves:['Dark Pulse','Flamethrower','Focus Blast','U-turn'],nature:'Timid',evs:{hp:4,atk:0,def:0,spa:252,spd:0,spe:252}},
    {id:601,label:'Cliticlic',species:'Klinklang',types:['Steel'],base:[60,100,115,70,85,90],ability:'Clear Body',item:'Air Balloon',moves:['Gear Grind','Wild Charge','Return','Shift Gear'],nature:'Adamant',evs:{hp:4,atk:252,def:0,spa:0,spd:0,spe:252}}
  ];
}
// Les répartitions sont de la préparation d'équipe, pas une modification du moteur.
// En 5G, 252/252/4 dépense les points utiles (les 2 EV restants ne changent aucune stat).
const specialMoves = new Set([
  'Energy Ball', 'Sludge Bomb', 'Flamethrower', 'Air Slash', 'Dragon Pulse',
  'Focus Blast', 'Surf', 'Ice Beam', 'Dark Pulse', 'Thunderbolt', 'Psychic',
  'Shadow Ball', 'Leaf Storm', 'Fire Blast', 'Earth Power', 'Flash Cannon',
  'Blizzard', 'Frost Breath', 'Bug Buzz', 'Hyper Beam', 'Signal Beam', 'Solar Beam',
  'Grass Knot', 'Aura Sphere',
]);
const statusMoves = new Set([
  'Toxic', 'Thunder Wave', 'Recover', 'Roost', 'Swords Dance', 'Calm Mind',
  'Metal Sound', 'Hail', 'Shift Gear', 'Shell Smash', 'Dragon Dance', 'Synthesis',
  'Moonlight', 'Nasty Plot', 'Cotton Guard', 'Glare', 'Sleep Powder', 'Bulk Up',
  'Quiver Dance',
]);
function training(mon: TeamMon) {
  if (mon.evs && mon.nature) return {evs: mon.evs, nature: mon.nature};
  const [hp, atk, def, spa, spd, spe] = mon.base;
  const physical = mon.moves.filter(m => !specialMoves.has(m) && !statusMoves.has(m)).length;
  const special = mon.moves.filter(m => specialMoves.has(m)).length;
  const defensive = mon.moves.filter(m => statusMoves.has(m)).length >= 2 && hp >= 80;
  const evs = {hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0};
  if (defensive) {
    evs.hp = 252;
    if (def >= spd) {evs.def = 252; evs.spd = 4;}
    else {evs.spd = 252; evs.def = 4;}
    return {evs, nature: special >= physical ? (def >= spd ? 'Bold' : 'Calm') : (def >= spd ? 'Impish' : 'Careful')};
  }
  const physicalSweeper = physical > special || (physical === special && atk >= spa);
  evs[physicalSweeper ? 'atk' : 'spa'] = 252;
  if (spe >= 85 || hp < 80) evs.spe = 252;
  else evs.hp = 252;
  evs[evs.hp ? 'def' : 'hp'] = 4;
  // Les attaquants mixtes préservent leurs deux statistiques offensives.
  const mixed = physical > 0 && special > 0 && Math.abs(atk - spa) <= 20;
  return {evs, nature: mixed && spe >= 85 ? 'Naive' : physicalSweeper ? (spe >= 85 ? 'Jolly' : 'Adamant') : (spe >= 85 ? 'Timid' : 'Modest')};
}
export function asSet(mon: TeamMon): PokemonSet {
  const {evs, nature} = training(mon);
  return {
    name: mon.label, species: mon.species, ability: mon.ability, item: mon.item,
    moves: mon.moves, level: 100, nature,
    evs, ivs: {hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31},
  };
}
export const TYPE_FR: Record<string,string> = {Normal:'NORMAL',Fire:'FEU',Water:'EAU',Electric:'ÉLECTRIK',Grass:'PLANTE',Ice:'GLACE',Fighting:'COMBAT',Poison:'POISON',Ground:'SOL',Flying:'VOL',Psychic:'PSY',Bug:'INSECTE',Rock:'ROCHE',Ghost:'SPECTRE',Dragon:'DRAGON',Dark:'TÉNÈBRES',Steel:'ACIER'};
export const art = (id:number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
export const sprite = (id:number, back = false) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${back?'back/':''}${id}.gif`;
