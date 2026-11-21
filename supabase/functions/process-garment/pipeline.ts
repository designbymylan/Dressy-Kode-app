/**
 * Le traitement d'une photo, d'un bout à l'autre (spec, « Pipeline
 * technique ») : détourage et étiquetage EN MÊME TEMPS, puis un seul
 * contrôle qualité, puis la sortie standard. Aucun modèle génératif.
 *
 * Logique pure : réseau, décodeurs et encodeur passent par les `ports`, ce
 * qui permet de tout essayer sans rien appeler (pipeline.test.ts). Le même
 * traitement sert à l'app (index.ts) et au banc d'essai.
 */
import type { Raster } from '../dressy-agent/cutout.ts';
import type { Etiquettes } from '../_shared/taxonomy.ts';
import type { Resultat as ResultatEtiquetage } from './etiquetage.ts';
import { analyser, etirer, opaciteDe, type Analyse } from './masque.ts';
import { epurer } from './epuration.ts';
import { SAM_CATEGORY, SAM_KIND } from '../dressy-agent/sam.ts';
import { couleurMediane, decouper, reduire } from './normaliser.ts';
import { decider, type RaisonReprise } from './qualite.ts';
import { ETIQUETAGE, SEUILS, SORTIE } from './reglages.ts';

export type Ports = {
  decoderJpeg(octets: Uint8Array): Raster;
  decoderPng(octets: Uint8Array): Raster;
  encoderWebp(r: Raster, qualite: number): Promise<Uint8Array>;
  /** Le PNG du masque (ou de la pièce détourée), reprises comprises. */
  detourer(jpeg: Uint8Array): Promise<{ png: Uint8Array; essais: number; erreurs: string[] }>;
  /** L'étiquetage complet (un nouvel essai compris), sur la même photo. */
  etiqueter(): Promise<ResultatEtiquetage>;
  /**
   * Facultatif : les masques de SAM 3 pour un type de pièce (« jacket »…),
   * pour l'épuration (ne garder que la pièce). Absent : pas d'épuration.
   */
  segmenter?(jpeg: Uint8Array, prompt: string): Promise<{ png: Uint8Array; score: number | null }[]>;
  maintenant(): number;
};

export type Mesures = {
  detourage_ms: number | null;
  etiquetage_ms: number | null;
  controle_ms: number | null;
  essais_detourage: number;
  essais_etiquetage: number;
  cout_etiquetage_usd: number;
  modele_etiquetage: string | null;
  /** L'épuration : appliquée ou non, et pourquoi (journal) ; `prompt` : le dernier essayé. */
  epuration: { prompt: string; appliquee: boolean; raison?: string; part?: number; masques?: number } | null;
  epuration_ms: number | null;
  /** Appels à SAM 3 (un, ou deux avec le second essai), pour le coût. */
  epuration_appels: number;
  erreurs: string[];
};

export type Sortie =
  | {
    statut: 'ready';
    cutout: Uint8Array;
    thumb: Uint8Array;
    largeur: number;
    hauteur: number;
    couleurHex: string | null;
    etiquettes: Etiquettes | null;
    analyse: Analyse;
    mesures: Mesures;
  }
  | { statut: 'needs_retake'; raison: RaisonReprise; etiquettes: Etiquettes | null; analyse: Analyse; mesures: Mesures }
  | { statut: 'failed'; raison: 'provider_error' | 'unexpected'; erreur: string; mesures: Mesures };

const VIDE: ResultatEtiquetage = { etiquettes: null, essais: 0, modele: null, coutUsd: 0, erreurs: [] };

/** L'étiquetage, borné : au-delà du plafond, la pièce sera rangée avec une fiche vide. */
function borne(p: Promise<ResultatEtiquetage>, ms: number): Promise<ResultatEtiquetage> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve({ ...VIDE, erreurs: [`étiquetage : pas de réponse en ${ms} ms`] }), ms);
    p.then(
      (r) => { clearTimeout(t); resolve(r); },
      (err) => { clearTimeout(t); resolve({ ...VIDE, erreurs: [String(err instanceof Error ? err.message : err)] }); },
    );
  });
}

export async function traiter(original: Uint8Array, ports: Ports, opts: { plafondEtiquetageMs?: number } = {}): Promise<Sortie> {
  const mesures: Mesures = {
    detourage_ms: null, etiquetage_ms: null, controle_ms: null,
    essais_detourage: 0, essais_etiquetage: 0, cout_etiquetage_usd: 0, modele_etiquetage: null,
    epuration: null, epuration_ms: null, epuration_appels: 0, erreurs: [],
  };
  const t0 = ports.maintenant();

  // Les deux appels partent ensemble, avant tout calcul local.
  const detourage = ports.detourer(original).then(
    (r) => { mesures.detourage_ms = ports.maintenant() - t0; return r; },
    (err) => { mesures.detourage_ms = ports.maintenant() - t0; throw err; },
  );
  const etiquetage = borne(ports.etiqueter(), opts.plafondEtiquetageMs ?? ETIQUETAGE.plafondMs).then((r) => {
    mesures.etiquetage_ms = ports.maintenant() - t0;
    mesures.essais_etiquetage = r.essais;
    mesures.cout_etiquetage_usd = r.coutUsd;
    mesures.modele_etiquetage = r.modele;
    mesures.erreurs.push(...r.erreurs.map((e) => `étiquetage : ${e}`));
    return r;
  });

  let photo: Raster;
  try {
    photo = ports.decoderJpeg(original);
    if (Math.max(photo.width, photo.height) > SORTIE.cote) photo = reduire(photo, SORTIE.cote);
  } catch (err) {
    detourage.catch(() => undefined);
    return { statut: 'failed', raison: 'unexpected', erreur: `photo illisible : ${err instanceof Error ? err.message : err}`, mesures };
  }

  let png: Uint8Array;
  try {
    const d = await detourage;
    png = d.png;
    mesures.essais_detourage = d.essais;
    mesures.erreurs.push(...d.erreurs.map((e) => `détourage : ${e}`));
  } catch (err) {
    const e = err as Error & { essais?: number; erreurs?: string[] };
    mesures.essais_detourage = e.essais ?? 1;
    mesures.erreurs.push(...(e.erreurs ?? [String(e.message ?? err)]).map((x) => `détourage : ${x}`));
    return { statut: 'failed', raison: 'provider_error', erreur: String(e.message ?? err), mesures };
  }

  const tc = ports.maintenant();
  try {
    const rendu = ports.decoderPng(png);
    let alpha = etirer(opaciteDe(rendu), rendu.width, rendu.height, photo.width, photo.height);
    // Le calcul local seulement : l'attente de l'étiquetage est comptée à part.
    const avant = ports.maintenant() - tc;
    const etiquettes = (await etiquetage).etiquettes;

    // L'épuration : ne garder que la pièce (sans cintre, boîte, patère), guidée par son type.
    // Si SAM ne trouve rien avec le type (« dress » pour un top), un second essai plus large :
    // la catégorie, sinon « clothing ». Deux appels au plus.
    if (ports.segmenter) {
      const te = ports.maintenant();
      const parType = (etiquettes && SAM_KIND[etiquettes.type]) || 'clothing';
      const parCategorie = (etiquettes && SAM_CATEGORY[etiquettes.categorie]) || 'clothing';
      const prompts = [...new Set([parType, parCategorie !== parType ? parCategorie : 'clothing'])];
      for (const prompt of prompts) {
        try {
          mesures.epuration_appels++;
          const bruts = await ports.segmenter(original, prompt);
          // Gardés à leur taille (512 px) : la zone s'y calcule, sans agrandir chaque masque.
          const masques = bruts.map((b) => {
            const r = ports.decoderPng(b.png);
            return { alpha: opaciteDe(r), largeur: r.width, hauteur: r.height, score: b.score };
          });
          const e = epurer(alpha, masques, photo.width, photo.height);
          if (e.appliquee) alpha = e.alpha;
          mesures.epuration = e.appliquee
            ? { prompt, appliquee: true, part: Math.round(e.part * 1000) / 1000, masques: e.masques }
            : { prompt, appliquee: false, raison: e.raison, ...(e.part !== undefined ? { part: Math.round(e.part * 1000) / 1000 } : {}), masques: e.masques };
          // Seul « rien trouvé » mérite le second essai ; un morceau seulement (« trop_peu ») non.
          if (e.appliquee || e.raison !== 'aucun_masque') break;
        } catch (err) {
          // SAM en panne : la pièce garde son détourage, rien n'échoue pour autant.
          mesures.epuration = { prompt, appliquee: false, raison: 'erreur' };
          mesures.erreurs.push(`épuration : ${err instanceof Error ? err.message : err}`);
          break;
        }
      }
      mesures.epuration_ms = ports.maintenant() - te;
    }

    const t1 = ports.maintenant();
    const { analyse, propre } = analyser({ largeur: photo.width, hauteur: photo.height, alpha }, SEUILS);
    const decision = decider(analyse, etiquettes);
    if (decision.statut === 'needs_retake') {
      mesures.controle_ms = avant + (ports.maintenant() - t1);
      return { statut: 'needs_retake', raison: decision.raison, etiquettes, analyse, mesures };
    }
    const piece = reduire(decouper(photo, propre, analyse.boite!, SORTIE.marge), SORTIE.cote);
    const vignette = reduire(piece, SORTIE.vignette);
    const [cutout, thumb] = await Promise.all([
      ports.encoderWebp(piece, SORTIE.qualite),
      ports.encoderWebp(vignette, SORTIE.qualiteVignette),
    ]);
    mesures.controle_ms = avant + (ports.maintenant() - t1);
    return {
      statut: 'ready', cutout, thumb, largeur: piece.width, hauteur: piece.height,
      couleurHex: couleurMediane(piece), etiquettes, analyse, mesures,
    };
  } catch (err) {
    return { statut: 'failed', raison: 'unexpected', erreur: err instanceof Error ? err.message : String(err), mesures };
  }
}
