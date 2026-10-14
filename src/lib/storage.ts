import {previousDate} from '../data/daily';
import type {Choice, Outcome} from '../engine/showdown';

export interface DailySave {
  date: string;
  lead: number;
  locked: boolean;
  choices: Choice[];
  result: Outcome | null;
}
export interface Stats {
  played: number; wins: number; streak: number; best: number;
  lastWin: string; results: Record<string,Outcome>;
}
const PREFIX = 'daily-n-v2';
const EMPTY_STATS: Stats = {played:0,wins:0,streak:0,best:0,lastWin:'',results:{}};
function getJson<T>(key: string, fallback:T): T {
  try {const raw=localStorage.getItem(key);return raw ? JSON.parse(raw) as T : fallback;}catch{return fallback;}
}
function setJson(key:string, value:unknown): void {try{localStorage.setItem(key,JSON.stringify(value));}catch{/* stockage indisponible */}}
export function readDaily(key:string): DailySave {
  const raw = getJson<DailySave | null>(`${PREFIX}:daily`,null);
  if(!raw || raw.date!==key) return {date:key,lead:0,locked:false,choices:[],result:null};
  return {date:key,lead:Math.max(0,Math.min(5,Number(raw.lead)||0)),locked:!!raw.locked,
    choices:Array.isArray(raw.choices)?raw.choices.filter(x=>typeof x==='string' && x.length<30):[],
    result:raw.result==='win'||raw.result==='loss'||raw.result==='draw'?raw.result:null};
}
export function writeDaily(save:DailySave):void {setJson(`${PREFIX}:daily`,save);}
export function readStats():Stats {
  const raw = getJson<Stats>(`${PREFIX}:stats`,EMPTY_STATS);
  return {...EMPTY_STATS,...raw,results:raw?.results||{}};
}
export function recordResult(stats:Stats, date:string, outcome:Outcome):Stats {
  if(stats.results[date]) return stats;
  const won=outcome==='win';
  const streak=won ? (stats.lastWin===previousDate(date)?stats.streak:0)+1 : 0;
  return {...stats,played:stats.played+1,wins:stats.wins+Number(won),streak,
    best:Math.max(stats.best,streak),lastWin:won?date:'',
    results:{...stats.results,[date]:outcome}};
}
export function writeStats(stats:Stats):void {setJson(`${PREFIX}:stats`,stats);}
export function wipeStorage():void {
  try {localStorage.removeItem(`${PREFIX}:daily`);localStorage.removeItem(`${PREFIX}:stats`);}catch{/* noop */}
}
