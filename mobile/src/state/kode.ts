/**
 * Kodi, version démo : des réponses écrites à la main, choisies selon la
 * question, la météo et l'agenda. Dans l'app réelle, c'est la fonction
 * supabase/functions/kode qui répond ; le format (texte + tenue + raison)
 * est le même, pour que l'interface ne change pas au branchement.
 */
import { EVENTS, WEATHER, lcFirst, type Piece, type Weather } from '../data/wardrobe';
import { isoOf, type RdvEvent } from './planning';
import { canCompose, missingForOutfit, suggestOutfits } from './outfits';
import type { Profile } from './profile';

export type KodeOutfit = { title: string; pieces: string[]; why: string };
export type KodeLink = { label: string; route: 'Offers' | 'Event' | 'Shop' | 'Compose' | 'AddPiece'; params?: Record<string, unknown> };
/** La variante d'une réponse (Kodi v2, 13/11) : déjà contrôlée, servie sans question décomptée. */
export type KodeVariante = { direction: string; titre: string; pieces: string[]; servie: boolean };

export type KodeMessage = {
  id: string;
  from: 'me' | 'kode';
  text: string;
  outfit?: KodeOutfit;
  link?: KodeLink;
  /** La question de Kodi, s'il en pose une : y répondre ne compte pas. */
  question?: string;
  /** Ce qui manque au dressing pour bien répondre (un type de pièce, jamais une marque). */
  manque?: string;
  variante?: KodeVariante;
};

/** Le nom d'une direction de variante, celui de sa puce (le même que DIRECTION_LIBELLES, supabase/functions/kode/prompt.ts). */
export const VARIANTE_LIBELLES: Record<string, string> = {
  plus_habillee: 'Plus habillée',
  plus_decontractee: 'Plus décontractée',
  plus_chaude: 'Plus chaude',
  plus_legere: 'Plus légère',
  plus_audacieuse: 'Plus audacieuse',
  plus_sobre: 'Plus sobre',
  piece_oubliee: 'Avec une pièce oubliée',
  autre_base: 'Sur une autre base',
};

/** La dernière bulle est une question de Kodi : y répondre est gratuit (la base le décide aussi, `kode_ask`). */
export const reponseGratuite = (messages: KodeMessage[]) => {
  const m = messages.at(-1);
  return m?.from === 'kode' && !!m.question;
};

/**
 * Les puces sous la dernière réponse : les trois de toujours (chacune compte
 * comme une question), et celle de la variante, déjà prête, qui ne compte pas.
 * Si la variante va dans une direction qui a déjà sa puce, c'est cette puce
 * qui devient prête.
 */
export function suitesDe(m: KodeMessage): { label: string; prete: boolean }[] {
  const v = m.variante && !m.variante.servie ? VARIANTE_LIBELLES[m.variante.direction] : undefined;
  const base = KODE_SUITES.map((label) => ({ label: label as string, prete: label === v }));
  return v && !base.some((x) => x.prete) ? [...base, { label: v, prete: true }] : base;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const has = (s: string, words: string[]) => words.some((w) => s.includes(w));

/** Les questions prêtes à poser, tirées de l'agenda, du quotidien et du dressing. */
export function kodeStarters(profile: Profile, pieces: Piece[], events: RdvEvent[] = []): string[] {
  const list: string[] = [];
  // Le prochain rendez-vous noté dans la semaine (le sien, jamais celui de la démo).
  const today = isoOf(0), inAWeek = isoOf(7);
  const next = events.filter((e) => e.date >= today && e.date <= inAWeek).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) list.push(`Pour ${lcFirst(next.title)}`);
  list.push('Une tenue pour demain');
  if (profile.occasions.includes('Bureau') || profile.occasions.includes('Télétravail')) list.push('Une tenue de bureau');
  if (profile.occasions.includes('Événements')) list.push('Pour un mariage cet automne');
  if (profile.occasions.includes('Sorties')) list.push('Pour une soirée');
  list.push(pieces.length >= 8 ? 'Qu’est-ce que je ne porte jamais ?' : 'Qu’est-ce qui me manque vraiment ?');
  return list.slice(0, 4);
}

type Reply = Omit<KodeMessage, 'id' | 'from'>;

/**
 * Les suites d'une réponse (12/11) : sous la dernière tenue de Kodi, trois
 * puces pour l'ajuster sans retaper. Le serveur relit la conversation ; ici,
 * la version de secours fait de son mieux avec le moteur de tenues.
 */
export const KODE_SUITES = ['Une autre idée', 'Plus habillée', 'Plus décontractée'] as const;

/** Les pièces de la dernière tenue proposée par Kodi, pour ne pas la redonner. */
export function derniereTenue(messages: KodeMessage[]): string[] | undefined {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === 'kode' && messages[i].outfit) return messages[i].outfit!.pieces;
  return undefined;
}

/** La question parle-t-elle d'aujourd'hui ? Alors la tenue se porte, elle ne se prévoit pas pour demain. */
export function pourAujourdhui(question: string): boolean {
  const q = norm(question);
  if (has(q, ['demain', 'week-end', 'weekend', 'semaine'])) return false;
  return has(q, ['ce soir', 'aujourd', 'ce matin', 'ce midi', 'cet apres', 'maintenant', 'tout de suite', 'la journee']);
}

const HABILLE = ['blazer', 'chemise', 'escarpins', 'mocassins', 'robe', 'pantalon', 'trench', 'manteau', 'jupe'];
const DETENDU = ['baskets', 'tshirt', 't-shirt', 'jean', 'sweat', 'pull', 'short', 'blouson', 'mariniere'];
const cle = (ids: string[]) => [...ids].sort().join(',');

/** Une suite, en version simple : une autre tenue que la dernière, la plus habillée ou la plus décontractée de celles possibles. */
function suite(question: string, pieces: Piece[], w: Weather | null, last?: string[]): Reply | null {
  const q = norm(question);
  const mode = has(q, ['plus habille']) ? 'habille' : has(q, ['plus decontracte']) ? 'detendu' : has(q, ['autre idee']) ? 'autre' : null;
  if (!mode) return null;
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const avoid = last ? cle(last) : '';
  const others = suggestOutfits(pieces, w).filter((o) => cle(o.pieces) !== avoid);
  if (!others.length) return { text: 'Avec tes pièces du moment, je n’ai pas d’autre tenue à te proposer. Ajoute une pièce ou deux et j’aurai plus de choix.', link: { label: 'Ajouter une pièce', route: 'AddPiece' } };
  const words = mode === 'habille' ? HABILLE : DETENDU;
  const score = (ids: string[]) => ids.reduce((n, id) => n + (words.some((k) => norm(`${byId.get(id)?.kind ?? ''} ${byId.get(id)?.name ?? ''}`).includes(k)) ? 1 : 0), 0);
  const pick = mode === 'autre' ? others[0] : [...others].sort((a, b) => score(b.pieces) - score(a.pieces))[0];
  return {
    text: mode === 'habille' ? 'Plus habillée, avec ce que tu as :' : mode === 'detendu' ? 'Plus décontractée, avec ce que tu as :' : 'Une autre piste, avec tes pièces :',
    outfit: { title: mode === 'habille' ? 'Un cran au-dessus' : mode === 'detendu' ? 'Plus simple' : 'Autre idée', pieces: pick.pieces, why: pick.why },
  };
}

/**
 * Répond avec les pièces de l'utilisatrice. Tant qu'aucune tenue n'est
 * possible, Kodi le dit et propose d'ajouter ce qui manque ; si la réponse
 * écrite pour la démo cite des pièces absentes, il compose avec les siennes.
 */
/** `jours` : la météo connue (aujourd'hui, demain…) ; sans compte, elle ne l'est pas et Kodi n'en parle pas. */
export function kodeReply(question: string, pieces: Piece[], profile: Profile, jours: (Weather | null)[] = WEATHER, last?: string[]): Reply {
  const first = profile.name ? `${profile.name}, ` : '';
  if (!canCompose(pieces)) {
    const missing = missingForOutfit(pieces);
    const knows = [profile.silhouette && profile.silhouette !== 'inconnue' ? 'ta silhouette' : '', profile.styles.length ? 'ton style' : ''].filter(Boolean).join(' et ');
    return {
      text: pieces.length
        ? `${first}j’ai déjà ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} à toi. Pour composer une vraie tenue, il me manque ${missing}. Ajoute-la et je te réponds avec ton dressing.`
        : (() => {
            const rest = `${knows ? `je connais déjà ${knows}. Pour` : 'pour'} te répondre avec tes vêtements à toi, ajoute trois pièces que tu portes souvent : ${missing}.`;
            return first ? `${first}${rest}` : rest[0].toUpperCase() + rest.slice(1);
          })(),
      link: { label: 'Ajouter une pièce', route: 'AddPiece' },
    };
  }
  // Une suite (« Une autre idée », « Plus habillée »…) repart de la dernière tenue, pas d'une réponse écrite d'avance.
  const next = suite(question, pieces, jours[0] ?? null, last);
  if (next) return next;
  const reply = curated(question, pieces);
  if (reply.outfit && reply.outfit.pieces.length >= 3) return reply;
  const w = jours[0] ?? null;
  const w1 = jours[1] ?? null;
  const mine = suggestOutfits(pieces, w)[0];
  const q = norm(question);
  const topic = has(q, ['diner', 'soir', 'soiree', 'lea', 'apero'])
    ? 'Pour ce soir, avec tes pièces à toi'
    : has(q, ['bureau', 'travail', 'reunion', 'client'])
      ? 'Pour le bureau, avec tes pièces à toi'
      : has(q, ['mariage', 'ceremonie'])
        ? 'Pour un mariage, il te faudra sans doute une pièce habillée. En attendant, avec ce que tu as'
        : has(q, ['demain'])
          ? `Pour demain${w1 ? ` (${w1.t}°, ${w1.label})` : ''}, avec tes pièces à toi`
          : `Avec tes pièces à toi${w ? `, pour ${w.t}°, ${w.label}${profile.city ? ` à ${profile.city}` : ''}` : ''}`;
  return {
    text: `${topic} :`,
    outfit: mine ? { title: 'Composée avec ton dressing', pieces: mine.pieces, why: mine.why } : undefined,
    link: pieces.length < 8 ? { label: 'Ajouter des pièces pour plus de choix', route: 'AddPiece' } : undefined,
  };
}

function curated(question: string, pieces: Piece[]): Reply {
  const q = norm(question);
  const w = WEATHER[0];
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const exists = (ids: string[]) => ids.filter((id) => byId.has(id));

  if (has(q, ['diner', 'soir', 'resto', 'lea', 'apero'])) {
    const dinner = EVENTS.find((e) => e.id === 'e2');
    return {
      text: `Pour le dîner chez Léa demain à ${dinner?.time ?? '20 h'} : il fera ${WEATHER[1].low}° en rentrant, alors le blazer passe par-dessus sans alourdir.`,
      outfit: {
        title: 'Noir sur noir, mais doux',
        pieces: exists(['r1', 'm2', 'c5', 'a2']),
        why: 'La robe noire n’est sortie que sept fois ; avec le blazer, elle devient une tenue de soirée sans effort. Tu pourrais ajouter le foulard soie pour une touche de couleur.',
      },
    };
  }
  if (has(q, ['bureau', 'travail', 'reunion', 'client', 'presentation', 'boulot'])) {
    return {
      text: 'Pour ta réunion client de 10 h, une tenue nette qui tient jusqu’au soir.',
      outfit: {
        title: 'Net, sans raideur',
        pieces: exists(['m2', 'h5', 'b4', 'c2', 'a1']),
        why: 'Le blazer noir et la chemise blanche posent le cadre ; les mocassins cognac et le cabas réchauffent l’ensemble.',
      },
    };
  }
  if (has(q, ['mariage', 'ceremonie', 'bapteme', 'occasion'])) {
    return {
      text: 'Pour le mariage de Juliette et Tom, le code est « chic champêtre ». J’ai une première idée avec tes pièces :',
      outfit: {
        title: 'Terracotta au jardin',
        pieces: exists(['r2', 'm3', 'c4', 'a3']),
        why: 'La robe terracotta et le blazer lin, jamais porté, sont faits pour une fin d’après-midi dehors. Les escarpins nude allongent sans voler la vedette.',
      },
      link: { label: 'Préparer l’événement en détail', route: 'Event', params: { id: 'e5' } },
    };
  }
  if (has(q, ['jamais', 'oubli', 'dort', 'porte pas', 'plus porte'])) {
    const sleeping = pieces
      .filter((p) => p.lastWorn === null || p.lastWorn > 90)
      .sort((a, b) => (b.lastWorn ?? 999) - (a.lastWorn ?? 999))
      .slice(0, 4);
    return {
      text: `${sleeping.length} pièces dorment depuis plus de trois mois : ${sleeping.map((p) => p.name.toLowerCase()).join(', ')}. Tu pourrais en remettre une en jeu cette semaine, voilà comment :`,
      outfit: {
        title: 'Réveiller le blazer lin',
        pieces: exists(['m3', 'h6', 'b2', 'c1', 'a1']),
        why: 'Porté sur le t-shirt écru et le jean large, le blazer lin perd son côté habillé. Samedi, il fera 19° et grand beau.',
      },
    };
  }
  if (has(q, ['acheter', 'achat', 'manque', 'besoin', 'nouveau', 'shopping'])) {
    return {
      text: 'Avant d’acheter : tu as déjà trois pièces qui jouent le rôle d’une veste de mi-saison, dont deux portées moins de cinq fois. Si tu veux, je te montre comment les faire tourner ce mois-ci. Et si un vrai manque apparaît, l’audit de garde-robe le chiffre précisément.',
      link: { label: 'Voir l’audit de garde-robe', route: 'Shop' },
    };
  }
  if (has(q, ['sans le jean', 'sans jean', 'autre', 'change', 'pas le jean'])) {
    return {
      text: `Sans le jean, et toujours prêt pour les ${w.label} :`,
      outfit: {
        title: 'Olive et écru',
        pieces: exists(['m1', 'h8', 'b3', 'c3', 'a2']),
        why: 'La jupe plissée n’a pas bougé depuis six semaines ; avec les bottines, tu restes au sec sous l’averse de midi.',
      },
    };
  }
  if (has(q, ['froid', 'chaud', 'pluie', 'meteo', 'temps', 'soleil'])) {
    return {
      text: `Aujourd’hui : ${w.t}°, ${w.label}. Il fera ${w.low}° ce soir. Une tenue en couches, qui s’ajuste dans la journée :`,
      outfit: {
        title: 'En couches',
        pieces: exists(['m6', 'h9', 'b4', 'c3']),
        why: 'Le blouson zippé s’enlève au bureau, le pull gris garde la chaleur sans épaisseur.',
      },
    };
  }
  return {
    text: 'Voilà ce que je te proposerais, avec la météo du jour et ce que tu as prévu :',
    outfit: {
      title: 'Simple et juste',
      pieces: exists(['m4', 'h1', 'b2', 'c1', 'a1']),
      why: `La marinière avec le trench marine, pour ${w.t}° et des ${w.label}. Le trench n’est sorti que trois fois : c’est le moment.`,
    },
  };
}
