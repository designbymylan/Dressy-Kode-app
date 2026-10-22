/**
 * Kodi, version démo : des réponses écrites à la main, choisies selon la
 * question, la météo et l'agenda. Dans l'app réelle, c'est la fonction
 * supabase/functions/kode qui répond ; le format (texte + tenue + raison)
 * est le même, pour que l'interface ne change pas au branchement.
 */
import { EVENTS, WEATHER, type Piece } from '../data/wardrobe';
import { canCompose, missingForOutfit, suggestOutfits } from './outfits';
import type { Profile } from './profile';

export type KodeOutfit = { title: string; pieces: string[]; why: string };
export type KodeLink = { label: string; route: 'Offers' | 'Event' | 'Shop' | 'Compose' | 'AddPiece'; params?: Record<string, unknown> };
export type KodeMessage = {
  id: string;
  from: 'me' | 'kode';
  text: string;
  outfit?: KodeOutfit;
  link?: KodeLink;
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const has = (s: string, words: string[]) => words.some((w) => s.includes(w));

/** Les questions prêtes à poser, tirées de l'agenda, du quotidien et du dressing. */
export function kodeStarters(profile: Profile, pieces: Piece[]): string[] {
  const list: string[] = [];
  if (profile.agenda && EVENTS.some((e) => e.id === 'e2')) list.push('Pour le dîner chez Léa');
  list.push('Une tenue pour demain');
  if (profile.occasions.includes('Bureau') || profile.occasions.includes('Télétravail')) list.push('Une tenue de bureau');
  if (profile.occasions.includes('Événements')) list.push('Pour un mariage cet automne');
  if (profile.occasions.includes('Sorties')) list.push('Pour une soirée');
  list.push(pieces.length >= 8 ? 'Qu’est-ce que je ne porte jamais ?' : 'Qu’est-ce qui me manque vraiment ?');
  return list.slice(0, 4);
}

type Reply = Omit<KodeMessage, 'id' | 'from'>;

/**
 * Répond avec les pièces de l'utilisatrice. Tant qu'aucune tenue n'est
 * possible, Kodi le dit et propose d'ajouter ce qui manque ; si la réponse
 * écrite pour la démo cite des pièces absentes, il compose avec les siennes.
 */
export function kodeReply(question: string, pieces: Piece[], profile: Profile): Reply {
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
  const reply = curated(question, pieces);
  if (reply.outfit && reply.outfit.pieces.length >= 3) return reply;
  const mine = suggestOutfits(pieces)[0];
  const w = WEATHER[0];
  const q = norm(question);
  const topic = has(q, ['diner', 'soir', 'soiree', 'lea', 'apero'])
    ? 'Pour ce soir, avec tes pièces à toi'
    : has(q, ['bureau', 'travail', 'reunion', 'client'])
      ? 'Pour le bureau, avec tes pièces à toi'
      : has(q, ['mariage', 'ceremonie'])
        ? 'Pour un mariage, il te faudra sans doute une pièce habillée. En attendant, avec ce que tu as'
        : has(q, ['demain'])
          ? `Pour demain (${WEATHER[1].t}°, ${WEATHER[1].label}), avec tes pièces à toi`
          : `Avec tes pièces à toi, pour ${w.t}° et des ${w.label}${profile.city ? ` à ${profile.city}` : ''}`;
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
