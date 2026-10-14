/**
 * Les indices des requêtes Showdown sont dans l'ordre de combat (leader en premier),
 * tandis que l'interface utilise l'ordre fixe de l'équipe quotidienne.
 * Avant le combat, seul le leader choisi fait foi.
 */
export function activeTeamIndex(
  teamSize: number,
  lead: number,
  order: readonly number[] | null,
  activeSlot: number | null,
): number {
  const fallback = Number.isInteger(lead) && lead >= 0 && lead < teamSize ? lead : 0;
  if (!order || activeSlot === null) return fallback;
  const originalIndex = order[activeSlot];
  return Number.isInteger(originalIndex) && originalIndex >= 0 && originalIndex < teamSize
    ? originalIndex
    : fallback;
}

/** L'état des Pokémon contient aussi des drapeaux `active`, plus fiables qu'un index ancien. */
export function visibleActiveSlot(mons: readonly {active: boolean}[] | undefined, slot: number): number {
  const flagged = mons?.findIndex(mon => mon.active) ?? -1;
  return flagged >= 0 ? flagged : slot;
}

/**
 * Pour le sprite de combat, l'ID publié par le moteur fait foi.
 * Ne pas re-déduire le Pokémon à partir des indices du banc.
 */
export function activeSpecies<T extends {id: number}>(
  catalog: readonly T[], shown: {id: number} | null | undefined, fallbackIndex=0,
): T {
  const match = shown && catalog.find(p => p.id === shown.id);
  return match || catalog[fallbackIndex] || catalog[0];
}

/** Un indice Showdown décrit la requête courante, pas l'ordre fixe du banc. */
export function requestTeamIndex<T extends {label:string;species:string}>(
  mon: {ident:string;details?:string}, catalog: readonly T[],
): number {
  const name=mon.ident.replace(/^p[12][a-z]?: /,'').trim();
  const named=catalog.findIndex(p=>p.label===name);
  if(named>=0)return named;
  const species=(mon.details||'').split(',')[0];
  return catalog.findIndex(p=>p.species===species);
}
