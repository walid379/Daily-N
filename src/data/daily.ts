/** Une date civile parisienne, commune aux joueurs indépendamment de leur fuseau. */
export const TIME_ZONE = 'Europe/Paris';
export const EPOCH = '2026-10-14';
export const DAY_MS = 86_400_000;

export function parisDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map(({type, value}) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function dateIndex(key: string): number {
  const [y,m,d] = key.split('-').map(Number);
  const [ey,em,ed] = EPOCH.split('-').map(Number);
  return Math.floor((Date.UTC(y,m-1,d)-Date.UTC(ey,em-1,ed))/DAY_MS);
}
export function dragonFor(key: string): 'Zekrom' | 'Reshiram' {
  return dateIndex(key) % 2 === 0 ? 'Zekrom' : 'Reshiram';
}
export function previousDate(key: string): string {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d)-DAY_MS).toISOString().slice(0,10);
}
export function hash32(text: string): number {
  let x = 2166136261;
  for(let i = 0; i < text.length; i++) { x ^= text.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Graines générées de façon stable : les 4 entiers sont utilisés par le moteur PS. */
export function battleSeed(key: string): [number,number,number,number] {
  const next = rng(hash32(`daily-n-battle-v2:${key}`));
  return [0,1,2,3].map(() => Math.floor(next() * 65536)) as [number,number,number,number];
}
export function parisNextMidnight(key: string): number {
  // Recherche binaire de la première milliseconde du jour suivant en Europe/Paris,
  // y compris aux changements d'heure (23 h / 25 h).
  const [y,m,d] = key.split('-').map(Number);
  const utcMidnight = Date.UTC(y,m-1,d+1);
  let lo = utcMidnight - 14 * 3600_000, hi = utcMidnight + 14 * 3600_000;
  while(lo < hi) { const mid = Math.floor((lo+hi)/2); if(parisDate(new Date(mid)) > key) hi = mid; else lo = mid+1; }
  return lo;
}
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms/1000));
  const pad = (n: number) => String(n).padStart(2,'0');
  return `${pad(Math.floor(total/3600))}:${pad(Math.floor(total%3600/60))}:${pad(total%60)}`;
}
