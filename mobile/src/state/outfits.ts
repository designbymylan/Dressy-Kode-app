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
  ['Ta tenue,\n', 'déjà prête.'],
  ['Une autre\n', 'allure.'],
  ['Plus simple,\nencore ', 'plus juste.'],
];
/** Le tout premier jour (rien encore porté) : le moment où l'app tient sa promesse. */
const FIRST: [string, string] = ['Ta première\ntenue, ', 'déjà prête.'];

/** Au-delà de deux mois au repos, une pièce « dort » : c'est elle que Kodi ressort. */
const DORT = 60;
/** Une pièce déjà retenue dans une tenue du jour pèse moins pour la suivante : trois tenues, trois allures. */
const DEJA_PRISE = 40;

/** L'accord d'une pièce avec la température du jour : 0 va bien, négatif à éviter (un gros pull à 25°, une robe d'été à 8°). */
export function accordMeteo(s: Piece['season'], t: number | null): number {
  if (t === null) return 0;
  if (s === 'hiver') return t >= 22 ? -100 : t >= 18 ? -35 : 0;
  if (s === 'été') return t <= 11 ? -100 : t <= 16 ? -35 : 0;
  if (s === 'mi-saison') return t >= 28 || t <= 3 ? -35 : 0;
  return 0;
}

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

/**
 * Jusqu'à trois tenues, composées des propres pièces de la personne (même
 * moteur que le site, web/src/lib/outfits.ts, essayé par `npm run
 * test:tenues`). Toutes les combinaisons haut et bas, et chaque robe, sont
 * pesées : les pièces au repos depuis longtemps d'abord (Kodi fait tourner le
 * dressing), celles qui vont avec la météo du jour, un cœur compte pour un
 * mois de repos en plus ; une pièce écartée seule (« Pas pour moi ») passe en
 * dernier. Les trois tenues partagent le moins de pièces possible. Au-dessous
 * de 17° (21° s'il pleut), une veste s'ajoute si le dressing en a une.
 */
export function suggestOutfits(pieces: Piece[], w: Weather | null = WEATHER[0], av: Evite = RIEN): Outfit[] {
  const t = w ? w.t : null;
  const poids = (p: Piece) =>
    (av.retrait.has(p.id) ? -500 : 0) + Math.min(p.lastWorn ?? DORT, DORT) + (av.aimees.has(p.id) ? 30 : 0) + accordMeteo(p.season, t);
  const by = (c: Piece['category']) => pieces.filter((p) => p.category === c).sort((a, b) => poids(b) - poids(a));
  // Un cardigan se porte par-dessus : il compte comme une couche, sauf s'il n'y a pas d'autre haut.
  const hauts = by('hauts');
  const plain = hauts.filter((p) => p.kind !== 'cardigan');
  const tops = plain.length ? plain : hauts;
  const coats = [...by('manteaux'), ...hauts.filter((p) => !tops.includes(p))];
  const bottoms = by('bas'), dresses = by('robes'), shoes = by('chaussures'), accs = by('accessoires');

  type Base = { pieces: Piece[]; score: number };
  const bases: Base[] = [
    ...tops.flatMap((top) => bottoms.map((bottom) => ({ pieces: [top, bottom], score: (poids(top) + poids(bottom)) / 2 }))),
    ...dresses.map((d) => ({ pieces: [d], score: poids(d) })),
  ];
  const used = new Set<string>();
  const libre = (p: Piece) => poids(p) - (used.has(p.id) ? DEJA_PRISE : 0);
  const meilleure = (list: Piece[]) => (list.length ? list.reduce((a, b) => (libre(b) > libre(a) ? b : a)) : undefined);
  const pluie = w?.kind === 'pluie' || w?.kind === 'averses';
  const froid = t !== null && (t < 17 || (pluie && t < 21));
  const firstDay = pieces.every((p) => p.wears === 0);
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

  const out: Outfit[] = [];
  const leads = new Set<string>();
  const tried = new Set<Base>();
  while (out.length < 3) {
    let base: Base | undefined;
    let best = -Infinity;
    for (const b of bases) {
      if (tried.has(b)) continue;
      const sc = b.score - DEJA_PRISE * b.pieces.filter((p) => used.has(p.id)).length;
      if (sc > best) [base, best] = [b, sc];
    }
    if (!base) break;
    tried.add(base);
    const coat = froid ? meilleure(coats) : undefined;
    const shoe = meilleure(shoes);
    const acc = meilleure(accs);
    const list = [...(coat ? [coat] : []), ...base.pieces, ...(shoe ? [shoe] : []), ...(acc ? [acc] : [])];
    const key = cleTenue(list.map((p) => p.id));
    if (av.tenues.has(key)) continue;
    for (const p of list) used.add(p.id);

    // La raison : ce que la tenue réunit, puis la pièce qui dormait ou la météo.
    const [a, b] = base.pieces;
    const line1 = b
      ? `${cap(a.name)} avec ${lcFirst(b.name)}${coat ? ` et ${lcFirst(coat.name)} par-dessus` : ''}.`
      : `${cap(a.name)} en pièce centrale${coat ? `, ${lcFirst(coat.name)} par-dessus` : ''}.`;
    const star = [...base.pieces, ...(coat ? [coat] : []), ...(shoe ? [shoe] : [])]
      .filter((p) => (p.lastWorn === null ? p.addedDaysAgo >= 30 : p.lastWorn > DORT))
      .sort((x, y) => (y.lastWorn ?? y.addedDaysAgo) - (x.lastWorn ?? x.addedDaysAgo))[0];
    // La pièce qui ouvre la phrase n'est pas renommée.
    const qui = star && star !== a ? `${cap(star.name)} : ` : '';
    const line2 = star
      ? star.lastWorn === null
        ? ` ${qui}${qui ? 'p' : 'P'}remière sortie en ${star.addedDaysAgo} jours.`
        : ` ${qui}${qui ? 'a' : 'A'}u repos depuis ${star.lastWorn} jours.`
      : !w
        ? ''
        : coat
          ? ` ${w.t}°, ${w.label}.`
          : w.t < 15
            ? ` Il fera ${w.t}° : une veste irait bien, dès que tu en ajoutes une.`
            : ` ${w.t}°, ${w.label} : c’est la bonne épaisseur.`;
    const wanted: [string, string] | null = star
      ? star.lastWorn === null ? ['Son tour\nest ', 'venu.'] : ['Ressortie\ndu ', 'placard.']
      : coat && pluie ? ['Pluie prévue,\nallure ', 'nette.'] : null;
    const lead =
      (wanted && !leads.has(wanted.join('')) && wanted) ||
      (out.length === 0 && firstDay ? FIRST : LEADS.find((l) => !leads.has(l.join(''))) ?? LEADS[0]);
    leads.add(lead.join(''));
    out.push({ id: `g-${key}`, lead: lead[0], em: lead[1], pieces: list.map((p) => p.id), why: `${line1}${line2}` });
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
