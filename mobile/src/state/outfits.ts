/**
 * Les tenues du jour. Pour le compte de démonstration, des tenues écrites
 * à la main ; pour une nouvelle utilisatrice, des tenues composées à partir
 * de ses propres pièces, avec une raison lisible (météo, pièce peu portée).
 * La météo est celle du jour : la vraie pour un compte connecté (fonction
 * `donnees`), la simulée en démonstration, aucune si elle n'est pas connue.
 */
import { TODAY_OUTFITS, WEATHER, lcFirst, type Outfit, type Piece, type Weather } from '../data/wardrobe';
import { RIEN, cleTenue, type Evite } from './ecarts';

const LEADS: [string, string][] = [
  ['Ta première\ntenue, ', 'déjà prête.'],
  ['Même base,\nautre ', 'humeur.'],
  ['Plus simple,\nencore ', 'plus juste.'],
];

/** Une tenue est possible avec un haut et un bas, ou une robe. */
export function canCompose(pieces: Piece[]) {
  const has = (c: Piece['category']) => pieces.some((p) => p.category === c);
  return has('robes') || (has('hauts') && has('bas'));
}

/** Ce qui manque encore pour une première tenue, dit simplement. */
export function missingForOutfit(pieces: Piece[]): string | null {
  if (canCompose(pieces)) return null;
  const has = (c: Piece['category']) => pieces.some((p) => p.category === c);
  if (has('hauts')) return 'un bas (pantalon, jean, jupe) ou une robe';
  if (has('bas')) return 'un haut';
  return 'un haut et un bas, ou une robe';
}

export function suggestOutfits(pieces: Piece[], w: Weather | null = WEATHER[0], av: Evite = RIEN): Outfit[] {
  // Les moins portées d'abord : Kodi fait tourner le dressing. Une pièce écartée seule (« Pas pour moi ») passe en dernier.
  const by = (c: Piece['category']) =>
    pieces.filter((p) => p.category === c).sort((a, b) => Number(av.retrait.has(a.id)) - Number(av.retrait.has(b.id)) || (b.lastWorn ?? 999) - (a.lastWorn ?? 999));
  // Un cardigan se porte par-dessus : il compte comme une couche, pas comme le haut.
  const layers = [...by('manteaux'), ...by('hauts').filter((p) => p.kind === 'cardigan')];
  const tops = by('hauts').filter((p) => p.kind !== 'cardigan' || by('hauts').length === 1);
  const bottoms = by('bas'), dresses = by('robes'), shoes = by('chaussures'), accs = by('accessoires');
  const coats = layers.filter((p) => !tops.includes(p));
  const out: Outfit[] = [];
  const seen = new Set<string>();
  // Jusqu'à trois tenues ; on cherche plus loin quand certaines ont été écartées.
  for (let i = 0; i < 12 && out.length < 3; i++) {
    const useDress = dresses.length > 0 && (i % 2 === 1 || !tops.length || !bottoms.length);
    const base = useDress ? [dresses[i % dresses.length]] : tops.length && bottoms.length ? [tops[i % tops.length], bottoms[i % bottoms.length]] : [];
    if (!base.length) break;
    const list = [...base];
    const coat = w && w.t < 17 && coats.length ? coats[i % coats.length] : undefined;
    if (coat) list.unshift(coat);
    if (shoes.length) list.push(shoes[i % shoes.length]);
    if (accs.length) list.push(accs[i % accs.length]);
    const key = cleTenue(list.map((p) => p.id));
    if (seen.has(key) || av.tenues.has(key)) continue;
    seen.add(key);
    const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
    const baseLine = useDress ? `${cap(lcFirst(base[0].name))} en pièce centrale.` : `${cap(lcFirst(base[0].name))} avec ${lcFirst(base[1].name)}.`;
    const weatherLine = !w
      ? ''
      : coat
        ? ` ${coat.name} par-dessus : ${w.t}°, ${w.label}.`
        : w.t < 15
          ? ` Il fera ${w.t}° : une veste irait bien par-dessus, dès que tu en ajoutes une.`
          : ` ${w.t}°, ${w.label} : c’est la bonne épaisseur.`;
    out.push({
      id: `g${i}`,
      lead: LEADS[out.length][0],
      em: LEADS[out.length][1],
      pieces: list.map((p) => p.id),
      why: `${baseLine}${weatherLine}`,
    });
  }
  return out;
}

/**
 * Les tenues proposées aujourd'hui pour ce dressing, selon la météo du jour
 * (null : inconnue), sans celles écartées par « Pas pour moi ». Si tout a
 * été écarté, les tenues reviennent : la journée n'est jamais vide.
 */
export function todayOutfits(pieces: Piece[], w: Weather | null = WEATHER[0], av: Evite = RIEN): Outfit[] {
  const ids = new Set(pieces.map((p) => p.id));
  const curated = TODAY_OUTFITS.filter((o) => o.pieces.every((id) => ids.has(id)) && !av.tenues.has(cleTenue(o.pieces)));
  if (curated.length) return curated;
  const fresh = suggestOutfits(pieces, w, av);
  return fresh.length || av === RIEN ? fresh : todayOutfits(pieces, w);
}
