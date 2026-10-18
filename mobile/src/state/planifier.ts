/**
 * Prévoir plusieurs jours d'un coup (07/10) : une tenue par jour, qui vise le
 * niveau d'habillage du rendez-vous (de 0, le sport, à 3, la tenue de
 * soirée), suit la météo, et évite de remettre les mêmes pièces deux jours
 * de suite. C'est la version qui tourne sur le téléphone (démonstration,
 * hors ligne) ; un compte connecté passe par Kode (fonction `kode`, action
 * `planifier`), qui en sait bien plus.
 */
import type { Piece, Weather } from '../data/wardrobe';
import type { GarmentKind } from '../ui/Garment';
import type { Iso, RdvEvent, Trip } from './planning';
import type { Planned } from './remote';

/** Le niveau d'habillage d'une pièce, de 0 (sport) à 3 (soirée). */
const FORMEL: Record<GarmentKind, number> = {
  blazer: 3, trench: 2.4, veste: 1.4, pull: 1.4, cardigan: 1.5, chemise: 2.5, mariniere: 1, tshirt: 0.5, debardeur: 0.6,
  jean: 1, pantalon: 2.2, short: 0.3, jupe: 2, robe: 2.4, baskets: 0.5, mocassins: 2.5, bottines: 1.8, escarpins: 3,
  sac: 2, foulard: 2, ceinture: 1.6,
};

const CODES: Record<string, number> = {
  'Décontracté': 1, 'Casual chic': 1.6, 'Confort': 0.8, 'Smart': 2, 'Business': 2.4, 'Chic': 2.6, 'Habillé': 2.8, 'Tenue de soirée': 3, 'Sportswear': 0.3, 'À thème': 1.5,
};

const SPORT = /sport|randonn|plage|match/i;
const HABILLE = /entretien|présentation|réunion importante|gala|mariage|obsèques|restaurant chic|théâtre|cérémonie|diplôme|belle-famille/i;
const SOIGNE = /rendez-vous amoureux|premier rendez-vous|tête-à-tête|client|vernissage|anniversaire de couple|baptême/i;

/** Ce qu'un jour demande, de 0 à 3. */
export function niveau(e: RdvEvent | undefined, trip?: Trip | null): number {
  if (!e) return trip?.purpose === 'Travail' ? 2 : 1.2;
  const code = e.dressCode ? CODES[e.dressCode] : undefined;
  let n = code ?? (e.kind && SPORT.test(e.kind) ? 0.3 : e.kind && HABILLE.test(e.kind) ? 2.5 : e.kind && SOIGNE.test(e.kind) ? 2 : 1.4);
  if (e.stake === 'Décisif') n += 0.3;
  if (e.constraints.includes('Pas de talons') || e.constraints.includes('Beaucoup marcher')) n = Math.min(n, 2.4);
  return Math.min(3, n);
}

type Contexte = {
  meteo: (date: Iso) => Weather | null;
  events: RdvEvent[];
  trip?: Trip | null;
};

const moyenne = (ps: Piece[]) => ps.reduce((n, p) => n + (FORMEL[p.kind] ?? 1.4), 0) / Math.max(1, ps.length);
const proche = (list: Piece[], cible: number, sauf: Set<string>) =>
  [...list].sort((a, b) => Math.abs((FORMEL[a.kind] ?? 1.4) - cible) + (sauf.has(a.id) ? 0.6 : 0) - (Math.abs((FORMEL[b.kind] ?? 1.4) - cible) + (sauf.has(b.id) ? 0.6 : 0)))[0];

/** Une tenue par date, ou rien pour une date que le dressing ne permet pas d'habiller. */
export function proposer(pieces: Piece[], dates: Iso[], ctx: Contexte): Record<Iso, Planned> {
  const cat = (c: Piece['category']) => pieces.filter((p) => p.category === c);
  const hauts = cat('hauts').filter((p) => p.kind !== 'cardigan' || cat('hauts').length === 1);
  const couches = [...cat('manteaux'), ...cat('hauts').filter((p) => p.kind === 'cardigan')];
  const bas = cat('bas');
  const robes = cat('robes');
  const chaussures = cat('chaussures');
  const accessoires = cat('accessoires');
  const bases: Piece[][] = [...hauts.flatMap((h) => bas.map((b) => [h, b])).slice(0, 60), ...robes.map((r) => [r])];
  const out: Record<Iso, Planned> = {};
  if (!bases.length) return out;

  const porte = new Map<string, number>();
  let veille = new Set<string>();
  // En voyage, une valise : on réutilise ce qui est déjà dedans, sans remettre la même tenue deux jours de suite.
  const valise = ctx.trip ? new Set<string>() : null;
  // Une valise raisonnable : environ une pièce par jour, plus quelques basiques.
  const taille = Math.min(14, Math.ceil(dates.length * 0.8) + 4);
  dates.forEach((date, i) => {
    const e = ctx.events.find((x) => x.date === date);
    const w = ctx.meteo(date);
    const cible = niveau(e, ctx.trip);
    const score = (b: Piece[]) =>
      Math.abs(moyenne(b) - cible) * 2 +
      (valise
        ? b.reduce((n, p) => n + (valise.has(p.id) ? 0 : valise.size < taille ? 0.25 : 1.4) + (veille.has(p.id) ? (p.category === 'bas' ? 0.3 : 1.6) : 0) + (p.category === 'bas' ? 0 : (porte.get(p.id) ?? 0) * 0.6), 0)
        : b.reduce((n, p) => n + (porte.get(p.id) ?? 0) * 0.9 + (veille.has(p.id) ? 1.2 : 0), 0)) +
      // Les pièces oubliées passent un peu devant.
      b.reduce((n, p) => n - Math.min(1, (p.lastWorn ?? 120) / 120) * 0.3, 0) +
      ((w?.kind === 'pluie' || w?.kind === 'averses') && b.some((p) => p.kind === 'short') ? 2 : 0) +
      (w && w.t >= 24 && b.some((p) => p.kind === 'pull') ? 1.5 : 0) +
      (w && w.t <= 10 && b.some((p) => p.kind === 'short' || p.kind === 'debardeur') ? 2 : 0);
    const base = [...bases].sort((x, z) => score(x) - score(z))[0];
    const tenue = [...base];
    const froid = !w || w.t < 17;
    // En voyage, les couches et les chaussures déjà dans la valise passent devant.
    const choix = (list: Piece[], c2: number) => (valise ? proche(list.filter((p) => valise.has(p.id)).length ? list.filter((p) => valise.has(p.id)) : list, c2, new Set()) : proche(list, c2, veille));
    if (froid && couches.length) tenue.unshift(choix(couches, cible));
    if (chaussures.length) tenue.push(choix(chaussures, e?.constraints.includes('Pas de talons') ? Math.min(cible, 2.4) : cible));
    const sac = accessoires.find((p) => p.kind === 'sac');
    if (sac && cible >= 1.5) tenue.push(sac);
    for (const p of tenue) {
      porte.set(p.id, (porte.get(p.id) ?? 0) + 1);
      valise?.add(p.id);
    }
    veille = new Set(tenue.map((p) => p.id));
    out[date] = {
      title: e ? `Pour « ${e.title} »`.slice(0, 80) : ctx.trip ? `${ctx.trip.destination}, jour ${i + 1}` : 'Par Kode',
      pieces: tenue.map((p) => p.id),
      tripId: ctx.trip?.id ?? null,
    };
  });
  return out;
}
