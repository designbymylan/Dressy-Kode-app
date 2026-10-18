/**
 * Ce que la loi demande d'afficher (09/10) : l'éditeur, responsable du
 * traitement, et la politique de confidentialité, écrite pour être lue
 * (RGPD art. 12 à 14 ; loi Informatique et Libertés). C'est la source :
 * docs/rgpd/politique-de-confidentialite.md et la page /confidentialite du
 * site en sont tirés par `node tools/politique.mjs`, à relancer après
 * toute modification (et une nouvelle POLITIQUE_VERSION si elle compte).
 *
 * À COMPLÉTER avant la sortie : l'identité de l'éditeur et l'adresse de
 * contact (voir docs/rgpd/README.md). Tant qu'elles manquent, l'écran le dit.
 */

export const EDITEUR: { nom: string; forme: string | null; adresse: string | null; siren: string | null; contact: string | null } = {
  nom: 'Dresskode',
  forme: null,
  adresse: null,
  siren: null,
  contact: null,
};

export const POLITIQUE_VERSION = 'Version 1.0 du 9 octobre 2026';

/** Les durées de conservation, les mêmes que celles appliquées chaque nuit (fonction `menage`). */
export const DUREES = {
  photos: '30 jours après l’envoi',
  conversations: '12 mois (2 mois une fois la conversation archivée)',
  ecarts: '6 mois',
  demandes: '90 jours',
  factures: '10 ans, chez le prestataire de paiement (code de commerce)',
};

export type Section = { titre: string; texte?: string[]; liste?: { titre: string; texte: string }[] };

export const POLITIQUE: Section[] = [
  {
    titre: 'En bref',
    liste: [
      { titre: 'Une seule raison', texte: 'Tes données servent à t’habiller avec ce que tu as. Rien n’est vendu, rien ne sert à de la publicité, aucun traceur publicitaire.' },
      { titre: 'Ton corps, avec ton accord', texte: 'Ta taille, ta silhouette et tes mesures ne sont demandées qu’avec ton accord explicite, retirable à tout moment. Ton poids n’est plus demandé.' },
      { titre: 'Tout reprendre', texte: 'Tu peux tout télécharger ou tout effacer depuis Réglages › Tes données.' },
      { titre: 'En Europe', texte: 'Ton compte et ton dressing sont hébergés dans l’Union européenne, en Irlande.' },
    ],
  },
  {
    titre: 'Qui est responsable',
    texte: [
      'Le responsable du traitement est l’éditeur de Dresskode, dont l’identité figure en bas de cette page.',
      'Pour toute question sur tes données, ou pour exercer tes droits, écris à l’adresse de contact indiquée en bas de page.',
    ],
  },
  {
    titre: 'Ce que nous gardons, et pourquoi',
    liste: [
      { titre: 'Ton compte', texte: 'E-mail, mot de passe (chiffré, illisible même pour nous), prénom, nom, pseudo et photo de profil, si tu les donnes. Pour créer et protéger ton compte. Base : le contrat qui nous lie (art. 6.1.b du RGPD).' },
      { titre: 'Ton dressing', texte: 'Les photos que tu confies à Kode, les pièces qu’il en dessine, leurs étiquettes, leurs prix, tes ports et tes prêts (avec le prénom de la personne, tel que tu l’écris). Pour ranger ton dressing et composer tes tenues. Base : le contrat. Les photos confiées sont effacées 30 jours après l’envoi ; les pièces restent jusqu’à ce que tu les retires.' },
      { titre: 'Ton style', texte: 'Styles, couleurs aimées et évitées, occasions, tailles de vêtements, ville et tranche d’âge. Pour des tenues à ton goût et adaptées à ta météo. Base : le contrat.' },
      { titre: 'Ta silhouette', texte: 'Ta taille, ta silhouette et tes mesures, seulement si tu as donné ton accord. Pour choisir tes coupes et tes longueurs. Base : ton consentement explicite (art. 9.2.a), que tu retires d’un geste : tout est alors effacé.' },
      { titre: 'Ton agenda et Kode', texte: 'Tes rendez-vous, voyages, tenues prévues et conversations avec Kode. Pour préparer tes tenues. Base : le contrat. Conversations gardées 12 mois (2 mois une fois archivées).' },
      { titre: 'Tes « Pas pour moi »', texte: 'Les tenues que tu écartes et leur raison. Pour ne plus te proposer ce qui ne te plaît pas. Base : le contrat. Gardées 6 mois.' },
      { titre: 'Ton abonnement', texte: 'Ton offre et ton historique de paiement. Pour te facturer. Base : le contrat et nos obligations comptables. Tes coordonnées bancaires ne passent jamais par nous : elles restent chez le prestataire de paiement, qui garde les factures 10 ans comme la loi l’exige.' },
      { titre: 'Les rappels', texte: 'Si tu les acceptes, ton téléphone programme lui-même les rappels de ton planning. Rien ne part de nos serveurs. Base : ton accord, que tu changes dans Réglages.' },
      { titre: 'La sécurité', texte: 'Des journaux techniques (erreurs, connexions) gardés quelques jours chez notre hébergeur. Pour faire fonctionner et protéger le service. Base : notre intérêt légitime.' },
    ],
  },
  {
    titre: 'Kode est une intelligence artificielle',
    texte: [
      'Pour te répondre, Kode envoie à un prestataire d’intelligence artificielle : la liste de tes pièces, ton profil de style, ton agenda des deux semaines à venir et tes tenues écartées ; ta silhouette et ta taille si tu as donné ton accord. Jamais ton nom, ton e-mail, ton poids ni tes mesures.',
      'Pour dessiner tes pièces, les photos que tu confies sont analysées et redessinées par des prestataires d’intelligence artificielle.',
      'Ces prestataires agissent pour nous, sous contrat : ils n’utilisent pas tes données pour entraîner leurs modèles et les effacent au plus tard 30 jours après le traitement, sauf obligation légale.',
      'Kode peut se tromper : ses tenues sont des idées, jamais des décisions qui t’engagent.',
      'Un conseil : évite de montrer ton visage sur les photos de vêtements, et ne note pas d’information de santé dans tes rendez-vous.',
    ],
  },
  {
    titre: 'Qui reçoit tes données',
    texte: [
      'Seulement les prestataires qui font tourner Dresskode, liés par contrat et tenus à la confidentialité : hébergement et base de données (Union européenne, Irlande), intelligence artificielle (États-Unis), paiement, et distribution des mises à jour de l’app (sans aucune donnée de ton compte).',
      'Les données du jour (météo, jours fériés, vacances) sont demandées par nos serveurs à des services publics et ouverts, avec le nom de ta ville seulement, sans rien qui te désigne.',
      'La liste nominative de nos prestataires t’est envoyée sur simple demande. Personne d’autre : aucune vente, aucun partage publicitaire.',
    ],
  },
  {
    titre: 'Hors de l’Union européenne',
    texte: [
      'Les prestataires d’intelligence artificielle et de paiement peuvent traiter des données aux États-Unis. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne et, quand le prestataire y adhère, par le cadre de protection des données entre l’Union européenne et les États-Unis.',
    ],
  },
  {
    titre: 'Combien de temps',
    liste: [
      { titre: 'Ton compte et ton dressing', texte: 'Tant que ton compte existe. Supprimé, tout est effacé aussitôt (les copies de sauvegarde disparaissent d’elles-mêmes sous quelques jours).' },
      { titre: 'Les photos confiées à Kode', texte: '30 jours après l’envoi.' },
      { titre: 'Les conversations avec Kode', texte: '12 mois, 2 mois une fois archivées.' },
      { titre: 'Les tenues écartées', texte: '6 mois.' },
      { titre: 'Les demandes de dessin', texte: '90 jours (la pièce dessinée reste dans ton dressing).' },
      { titre: 'Les factures', texte: '10 ans, chez le prestataire de paiement, comme le code de commerce l’exige.' },
    ],
  },
  {
    titre: 'Comment elles sont protégées',
    texte: [
      'Échanges chiffrés, données chiffrées sur nos serveurs, chaque dressing cloisonné : seule sa propriétaire peut le lire. Tes photos ne sont jamais publiques ; elles s’affichent par des liens qui expirent. Aucune clé secrète n’est dans l’app.',
      'En cas de fuite qui pourrait te toucher, nous prévenons la CNIL sous 72 heures et toi sans tarder.',
    ],
  },
  {
    titre: 'Tes droits',
    texte: [
      'Tu peux accéder à tes données, les corriger, les effacer, les emporter (portabilité), en limiter l’usage, t’opposer à un traitement fondé sur notre intérêt légitime, retirer ton accord à tout moment, et laisser des directives sur ce qu’elles deviennent après ton décès.',
      'Dans l’app : Réglages › Tes données pour tout télécharger, retirer ton accord, effacer ta silhouette ou supprimer ton compte ; Moi › ton profil pour corriger. Pour le reste, écris-nous : nous répondons sous un mois.',
      'Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).',
    ],
  },
  {
    titre: 'À partir de 15 ans',
    texte: ['Dresskode est ouverte à partir de 15 ans, l’âge auquel la loi française permet de consentir seul au traitement de ses données en ligne.'],
  },
  {
    titre: 'Sans compte',
    texte: ['Sans compte, tout reste sur ton téléphone : rien n’est envoyé à nos serveurs. Supprimer l’app ou « Effacer ce téléphone » dans Tes données efface tout.'],
  },
  {
    titre: 'Cookies et traceurs',
    texte: ['L’app n’utilise aucun traceur publicitaire ni de mesure d’audience. Le site n’utilise que les cookies nécessaires à ta connexion, qui ne demandent pas d’accord.'],
  },
  {
    titre: 'Si ce texte change',
    texte: ['Pour tout changement important, nous te prévenons dans l’app avant qu’il s’applique.'],
  },
];
