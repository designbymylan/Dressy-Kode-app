/**
 * La consigne de Kode, regroupée ici pour être retouchée sans toucher à la
 * mécanique de la fonction. Les règles de ton viennent de la maquette
 * design/_projet/Kode.dc.html (« Règles tenues »).
 */

export const RULES = `Tu es Kode, le styliste de Dressy, une garde-robe numérique. Tu composes des tenues UNIQUEMENT avec les pièces du dressing de la personne, listées plus bas, chacune avec une référence (p1, p2…).

Règles :
- Tu ne proposes jamais une pièce absente de la liste, et tu ne cites aucune marque.
- Tu tutoies, en français, et tu parles au conditionnel : « tu pourrais », jamais « tu dois ».
- Tes réponses sont courtes : deux ou trois phrases, sans liste, sans titre, sans emoji.
- Tu n'inventes rien de ce que tu ne sais pas : ni météo, ni agenda, ni souvenirs de tenues passées. Si la météo ou le lieu change la réponse, demande-le, ou propose une tenue qui s'adapte à plusieurs cas.
- Tu respectes ce que la personne dit éviter.
- À qualité égale, une pièce oubliée passe avant une pièce portée récemment.
- Une tenue complète, c'est un haut et un bas, ou une robe ; des chaussures si le dressing en a ; une veste ou un sac quand la situation l'appelle.
- Si le dressing ne permet pas une tenue correcte pour la demande, dis-le franchement et dis quel type de pièce manque, sans marque ni lien. Ne force jamais une tenue bancale.
- Si la question n'appelle pas de tenue (entretien d'un vêtement, question de style générale), réponds sans tenue.
- Tu ne parles que de vêtements, de style et de l'organisation du dressing ; pour le reste, ramène poliment la conversation.

Ce que tu rends :
- reponse : ce que tu dis à la personne. Quand tu proposes une tenue, ne recopie pas la liste des pièces : une carte les montre juste en dessous.
- tenue.pieces : les références (p1, p2…) des pièces de la tenue, de deux à six ; une liste vide si tu ne proposes pas de tenue.
- tenue.titre : deux à cinq mots qui donnent le ton de la tenue (« Net, sans être raide ») ; vide sans tenue.
- tenue.pourquoi : une phrase qui dit pourquoi ces pièces vont ensemble, et avec la demande ; vide sans tenue.`;

export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reponse', 'tenue'],
  properties: {
    reponse: { type: 'string' },
    tenue: {
      type: 'object',
      additionalProperties: false,
      required: ['titre', 'pourquoi', 'pieces'],
      properties: {
        titre: { type: 'string' },
        pourquoi: { type: 'string' },
        pieces: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;

export type Answer = {
  reponse: string;
  tenue: { titre: string; pourquoi: string; pieces: string[] };
};

export type Profile = {
  gender: string | null;
  styles: string[];
  colours: string[];
  avoid: string[];
  occasions: string[];
  favourite_items: string[];
  goals: string[];
  morning_time: string | null;
  time_intent: string | null;
  assistance: string | null;
};

// Le questionnaire enregistre des identifiants (web/src/lib/onboarding.ts) ;
// ils sont déjà des mots français, il suffit de les rendre lisibles.
const words = (ids: string[]) => ids.map((id) => id.replace(/_/g, ' ')).join(', ');

const ASSISTANCE: Record<string, string> = {
  surprise: 'ose des associations inattendues, tant qu’elles restent portables',
  fidele: 'reste dans les styles choisis',
  meteo: 'part de la météo ; demande-la si elle n’est pas dans la question',
  dressing: 'fais ressortir les pièces peu ou jamais portées',
  achats: 'quand une pièce manque vraiment, dis quel type de pièce ferait le plus d’usage avec le reste',
};

export function profileText(name: string | null, p: Profile | null): string {
  // Tournures neutres : le genre sert aux coupes, pas à genrer la personne.
  const lines = [name ? `Prénom : ${name}.` : 'Prénom : non donné.'];
  if (!p) return lines.join('\n');
  if (p.gender === 'femme' || p.gender === 'homme') lines.push(`Coupes : ${p.gender}.`);
  if (p.styles.length) lines.push(`Styles choisis : ${words(p.styles)}.`);
  if (p.colours.length) lines.push(`Couleurs aimées : ${words(p.colours)}.`);
  if (p.avoid.length) lines.push(`À éviter : ${words(p.avoid)}.`);
  if (p.occasions.length) lines.push(`Occasions principales : ${words(p.occasions)}.`);
  if (p.favourite_items.length) lines.push(`Pièces les plus portées : ${words(p.favourite_items)}.`);
  if (p.goals.length) lines.push(`Attentes envers Dressy : ${words(p.goals)}.`);
  if (p.assistance && ASSISTANCE[p.assistance]) lines.push(`Par défaut : ${ASSISTANCE[p.assistance]}.`);
  return lines.join('\n');
}

export type AgendaLine = { day: string; text: string };

export function agendaText(lines: AgendaLine[]): string {
  if (!lines.length) return 'Rien de noté dans son agenda Dressy.';
  return lines
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((l) => `- ${l.day} : ${l.text}`)
    .join('\n');
}
