/**
 * Un scénario du banc d'essai de Kodi (13/11) : le vrai Kodi (kode/repondre.ts)
 * répond, le code note ce qui se vérifie, un relecteur note le reste selon
 * une grille écrite. Une ligne de `banc_ia` par scénario :
 *
 *   mode `kodi`, params { scenario, version, model?, effort?, juge?: false }
 *
 * La répétitivité entre scénarios se calcule ensuite, sur l'ensemble d'un
 * passage (tools du banc, côté éditeur).
 */
import { askClaude, readJson, servedBy, type Effort, type Reponse } from '../kode/claude.ts';
import { agendaEvent, type Dossier } from '../kode/demande.ts';
import { repondre, planifier } from '../kode/repondre.ts';
import { conditionsDuJour, type Conditions } from '../kode/meteo.ts';
import { controler, type PieceControle } from '../kode/controle.ts';
import type { Garment, Picked } from '../kode/wardrobe.ts';
import { dayLabel, weekday } from '../kode/dates.ts';
import { coutClaude } from './tarifs.ts';
import { AUJOURDHUI, DRESSINGS, EVENEMENTS_PLAN, PROFILS, SCENARIOS, type Scenario } from './scenarios.ts';
import type { Banc, Rendu } from '../_shared/banc.ts';

const LABELS = new Map([['hauts', 'Hauts'], ['bas', 'Bas'], ['robes', 'Robes'], ['vestes', 'Vestes et manteaux'], ['chaussures', 'Chaussures'], ['sacs', 'Sacs'], ['bijoux', 'Bijoux'], ['accessoires', 'Accessoires']]);

function dossier(s: Scenario): Dossier {
  const events = s.events ?? EVENEMENTS_PLAN[s.id] ?? [];
  return {
    today: AUJOURDHUI,
    style: PROFILS[s.profil],
    corps: null,
    coeurs: null,
    labels: LABELS,
    wardrobe: DRESSINGS[s.dressing],
    agenda: events.map((e) => agendaEvent(e, weekday(e.day))),
    events,
    plannedNames: new Map(),
    turns: [],
    ecarts: [],
  };
}

const phrases = (t: string) => (t.match(/[^.!?…]+[.!?…]+/g) ?? [t]).filter((x) => x.trim().length > 2).length;
const pc = (ref: string, g: Garment): PieceControle => ({ id: g.id, ref, name: g.name, category_id: g.category_id, kind: g.kind, colors: g.colors, size: g.size ?? null });

/** La notation par le code d'une tenue. */
function noterTenue(s: Scenario, refs: Map<string, Garment>, proposees: string[], gardees: Picked[], interdit: Map<string, string>) {
  const refOf = new Map([...refs].map(([r, g]) => [g.id, r]));
  const inventees = proposees.filter((r) => !refs.has(String(r).trim().toLowerCase()));
  const meteo = proposees.map((r) => refs.get(String(r).trim().toLowerCase())).filter((g): g is Garment => !!g && interdit.has(g.id)).map((g) => g.id);
  const interdits = gardees.filter((p) => s.attendu.interdits?.includes(p.garment.id)).map((p) => p.garment.id);
  const p = PROFILS[s.profil];
  const chaussuresDispo = DRESSINGS[s.dressing].some((g) => g.category_id === 'chaussures' && !interdit.has(g.id));
  const controle = gardees.length
    ? controler(gardees.map((x) => pc(refOf.get(x.garment.id)!, x.garment)), { avoidColours: p?.avoid_colours ?? [], metals: p?.metals ?? [] }, chaussuresDispo)
    : null;
  return { inventees, meteo, interdits, controle: controle?.erreurs ?? null };
}

const JUGE_SYSTEME = `Tu relis les réponses de Kodi, le styliste d'une application de garde-robe, pour en mesurer la qualité. Tu reçois ce que Kodi savait (profil, dressing, agenda, date, météo, question) et ce qu'il a répondu (texte et tenue). Note chaque critère de 1 à 5, sévèrement : 5 est rare et veut dire qu'un excellent styliste humain n'aurait pas fait mieux.

- justesse : la réponse respecte l'occasion, le niveau d'habillage, la météo, l'agenda, ce que la personne évite ; la tenue est portable et complète. Pour une question hors du style (santé, corps, sujet sans rapport, demande de marques), la justesse est de ramener poliment vers le style sans répondre au reste.
- raison : le choix est expliqué par une raison concrète (couleur, volume, matière, occasion), pas par un adjectif creux.
- personnalisation : la réponse part des styles, des couleurs aimées et des pièces de cette personne, et fait vivre une pièce peu portée quand c'est pertinent.
- ton : un styliste ami, tutoiement, conditionnel (« tu pourrais »), ni flatterie, ni leçon, aucun commentaire sur le corps.
- brievete : lisible d'un coup d'œil sur un téléphone ; une à trois phrases pour une tenue, jusqu'à cinq pour un conseil.
- honnetete : dit franchement quand le dressing ne permet pas une bonne tenue et ce qui manque ; n'invente ni pièce, ni rendez-vous, ni fait.

Rends aussi « commentaire » : une phrase, le défaut principal ou ce qui est réussi.`;

const JUGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['justesse', 'raison', 'personnalisation', 'ton', 'brievete', 'honnetete', 'commentaire'],
  properties: {
    justesse: { type: 'integer' }, raison: { type: 'integer' }, personnalisation: { type: 'integer' },
    ton: { type: 'integer' }, brievete: { type: 'integer' }, honnetete: { type: 'integer' }, commentaire: { type: 'string' },
  },
} as const;

const borne = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n)) || 1));

async function juger(contexte: string, recu: string, rendu: string, attendu: string): Promise<{ notes: Record<string, number | string>; res: Reponse }> {
  const res = await askClaude(JUGE_SYSTEME, contexte, [{
    role: 'user',
    content: `Ce que Kodi a reçu avec la question :\n${recu}\n\nCe que Kodi a rendu :\n${rendu}\n\nCe que le banc attendait (repère pour toi, pas pour Kodi) : ${attendu}`,
  }], JUGE_SCHEMA, { model: 'claude-opus-5-5', effort: 'medium', maxTokens: 4000 });
  const r = readJson<Record<string, unknown>>(res);
  const notes: Record<string, number | string> = {};
  for (const k of ['justesse', 'raison', 'personnalisation', 'ton', 'brievete', 'honnetete']) notes[k] = borne(r[k]);
  notes.commentaire = String(r.commentaire ?? '').slice(0, 300);
  return { notes, res };
}

const attenduTexte = (s: Scenario) => [
  `intention ${s.attendu.intention.join(' ou ')}`,
  s.attendu.tenue === true ? 'une tenue attendue' : s.attendu.tenue === false ? 'pas de tenue attendue' : 'tenue facultative',
  s.attendu.interdits?.length ? `pièces à ne pas proposer : ${s.attendu.interdits.join(', ')}` : '',
  s.attendu.aDire ? `à dire : ${s.attendu.aDire}` : '',
].filter(Boolean).join(' ; ');

export async function essaiKodi(b: Banc, p: Record<string, unknown>): Promise<Rendu> {
  const s = SCENARIOS.find((x) => x.id === p.scenario);
  if (!s) throw new Error(`scénario inconnu : ${p.scenario}`);
  const model = typeof p.model === 'string' ? p.model : undefined;
  const effort = typeof p.effort === 'string' ? p.effort as Effort : undefined;
  const d = dossier(s);
  const t0 = Date.now();
  let cost = 0;

  let rendu: string, recu: string, contexte: string, code: Record<string, unknown>, sortie: Record<string, unknown>, appels: Reponse[];

  if (s.plan) {
    const conditions = new Map<string, Conditions>();
    const byDay = new Map<string, string>();
    for (const [jour, m] of Object.entries(s.plan.meteo ?? {})) {
      conditions.set(jour, conditionsDuJour(m));
      byDay.set(jour, `${m.min}° à ${m.max}°, ${m.ciel}${m.pluie ? `, ${m.pluie} mm de pluie` : ''}`);
    }
    const trip = s.plan.voyage ? { ...s.plan.voyage, lat: null, lon: null } : null;
    const r = await planifier(d, s.plan.jours, { trip, consigne: s.plan.voyage ? null : s.question, meteo: { byDay, conditions, extra: '' }, souvenirs: [] }, { model, effort });
    appels = r.appels;
    contexte = r.demande.context;
    recu = r.demande.turns[0].content;
    const refOf = new Map([...r.demande.refs].map(([ref, g]) => [g.id, ref]));
    const jours = r.jours.map((j) => ({
      date: j.date, titre: j.titre,
      pieces: j.pieces.map((x) => `${refOf.get(x.garment.id)} ${x.garment.name}`),
      ...noterTenue(s, r.demande.refs, j.pieces.map((x) => refOf.get(x.garment.id)!), j.pieces, r.demande.interditsParJour.get(j.date) ?? new Map()),
    }));
    const hautsDeSuite = jours.slice(1).filter((j, i) => {
      const h = (x: typeof j) => r.jours.find((y) => y.date === x.date)!.pieces.filter((q) => q.garment.category_id === 'hauts').map((q) => q.garment.id);
      return h(j).some((id) => h(jours[i]).includes(id));
    }).length;
    code = {
      jours_rendus: r.jours.length, jours_demandes: s.plan.jours.length,
      jours_sans_tenue: jours.filter((j) => !j.pieces.length).length,
      jours_controle_ko: jours.filter((j) => j.controle && j.controle.length).length,
      meme_haut_jours_suivis: hautsDeSuite,
      phrases: phrases(r.message),
    };
    sortie = { message: r.message, jours };
    rendu = `${r.message}\n${jours.map((j) => `- ${dayLabel(j.date)} « ${j.titre} » : ${j.pieces.join(', ') || 'aucune tenue'}`).join('\n')}`;
  } else {
    const meteo = s.meteo ? conditionsDuJour(s.meteo) : null;
    const r = await repondre(d, s.question, { texte: '', meteo }, [], { model, effort });
    appels = r.appels;
    contexte = r.demande.context;
    recu = r.demande.turns.at(-1)!.content;
    const a = r.answer as unknown as Record<string, unknown> & { reponse: string; tenue: { titre: string; pourquoi: string; pieces: string[] } };
    const refOf = new Map([...r.demande.refs].map(([ref, g]) => [g.id, ref]));
    const tenue = r.pieces.map((x) => `${refOf.get(x.garment.id)} ${x.garment.name}`);
    const intention = typeof a.intention === 'string' ? a.intention : (r.pieces.length ? 'tenue' : 'conseil');
    const max = intention === 'tenue' ? 3 : intention === 'conseil' ? 5 : 2;
    code = {
      ...noterTenue(s, r.demande.refs, a.tenue.pieces, r.pieces, r.demande.interdit),
      intention, intention_ok: s.attendu.intention.includes(intention as never) || (intention === 'conseil' && s.attendu.intention.includes('hors_sujet') && !r.pieces.length),
      tenue_ok: s.attendu.tenue === null || (s.attendu.tenue === r.pieces.length > 0),
      phrases: phrases(a.reponse), longueur_ok: phrases(a.reponse) <= max,
      relances: r.appels.length - 1,
    };
    sortie = { ...a, tenue_gardee: tenue };
    rendu = `${a.reponse}\nTenue : ${tenue.length ? `« ${a.tenue.titre} » : ${tenue.join(', ')}. ${a.tenue.pourquoi}` : 'aucune'}${Object.entries(a).filter(([k, v]) => !['reponse', 'tenue'].includes(k) && v && (typeof v !== 'object' || Object.keys(v as object).length)).map(([k, v]) => `\n${k} : ${JSON.stringify(v)}`).join('')}`;
  }

  for (const res of appels) cost += coutClaude(model ?? res.model, res.usage);
  const ms = Date.now() - t0;
  let juge: Record<string, number | string> | null = null;
  if (p.juge !== false) {
    const j = await juger(contexte, recu, rendu, attenduTexte(s));
    juge = j.notes;
    cost += coutClaude('claude-opus-5-5', j.res.usage);
  }
  b.log(`${s.id} ${p.version ?? ''} : ${JSON.stringify(code).slice(0, 200)} ${juge ? JSON.stringify(juge).slice(0, 160) : ''}`);
  return {
    result: {
      scenario: s.id, famille: s.famille, version: p.version ?? null, servi: appels.map(servedBy), ms,
      usage: appels.map((x) => x.usage), sortie, code, juge,
    },
    cost,
  };
}

/** La relecture seule d'une réponse déjà rendue (pour rejuger sans refaire répondre). */
export function essaiJuge(_b: Banc, _p: Record<string, unknown>): Promise<Rendu> {
  return Promise.reject(new Error('mode juge : la relecture se fait dans le mode kodi'));
}
