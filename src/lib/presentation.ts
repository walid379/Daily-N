/** Les temps ici contrôlent l'affichage uniquement : Showdown reste le moteur du tour. */
export type PlaybackSpeed = 'cinematic' | 'normal' | 'fast';
const times: Record<string, number> = {
  move:460, switch:1200, drag:1200, replace:440,
  '-damage':940, '-heal':940, faint:570,
  '-status':360, '-curestatus':320, '-weather':320,
  '-fieldstart':350, '-fieldend':300, '-sidestart':350, '-sideend':300,
  '-miss':460, cant:360, '-fail':300, win:750, tie:750,
};
const factors: Record<PlaybackSpeed, number> = {cinematic:1.4,normal:1,fast:.55};
export function frameDuration(kind:string,speed:PlaybackSpeed):number {
  return Math.round((times[kind] || 220) * factors[speed]);
}
export const animatesHP = (kind:string):boolean => kind==='-damage'||kind==='-heal';
