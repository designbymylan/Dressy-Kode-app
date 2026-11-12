/**
 * Ce que la loi demande d'afficher (09/10) : l'éditeur, responsable du
 * traitement, et la politique de confidentialité, écrite pour être lue
 * (RGPD art. 12 à 14 ; loi Informatique et Libertés). C'est la source :
 * docs/rgpd/politique-de-confidentialite.md, docs/rgpd/conditions-generales.md
 * et la page /confidentialite du site en sont tirés par
 * `node tools/politique.mjs`, à relancer après toute modification (et une
 * nouvelle version si elle compte, avec son avis dans `AVIS`, plus bas).
 *
 * L'identité de l'éditeur est renseignée (08/11, d'après l'extrait INPI).
 * Restent à compléter avant la sortie : l'e-mail et le téléphone de contact,
 * et le médiateur de la consommation (voir docs/rgpd/README.md). Tant qu'ils
 * manquent, l'écran le dit.
 */

/**
 * L'éditeur. Les champs vides ne s'affichent pas. Nom commercial : Agence
 * E-commerce Mylan Francois (INPI) ; Dresskode appartient à cette agence.
 *  - contact : une adresse e-mail ET un numéro de téléphone (LCEN, art. 6 III,
 *    le téléphone est exigé pour une personne physique). Format : « e-mail · téléphone ».
 *  - mediateur : le médiateur de la consommation auquel tu adhères, avec son
 *    nom, son adresse et son site. Obligatoire pour un professionnel qui vend
 *    aux particuliers (code de la consommation, art. L612-1).
 */
export const EDITEUR: { nom: string; forme: string | null; adresse: string | null; siren: string | null; contact: string | null; directeur: string | null; mediateur: string | null } = {
  nom: 'Agence E-commerce Mylan Francois',
  forme: 'Mylan Francois, entrepreneur individuel, SIRET 983 972 662 00016',
  adresse: '69 bis avenue de Strasbourg, 77120 Coulommiers, France',
  siren: '983 972 662',
  contact: null,
  directeur: 'Mylan Francois',
  mediateur: null,
};

/** Les hébergeurs (LCEN, art. 6 III) : le site, et les données. */
export const HEBERGEURS = [
  'Site : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.',
  'Comptes, dressing et photos : Supabase, serveurs situés dans l’Union européenne (Irlande).',
];

export const POLITIQUE_VERSION = 'Version 1.3 du 12 novembre 2026';

/**
 * Prévenir d'un changement (12/11) : les conditions le promettent (« Nous te
 * prévenons dans l'app avant qu'un changement important s'applique »), et le
 * RGPD le demande quand la politique change ce que nous faisons des données.
 *
 * Un avis par changement qui compte, le plus récent en tête. Il s'affiche en
 * bandeau beurre en tête de l'accueil (app et site) pour un compte créé avant
 * `publie`, jusqu'à « Compris » ; la date de lecture est gardée avec le compte
 * (`avis_lus`, métadonnées du compte), elle sert de preuve. Pas de fenêtre
 * qui s'ouvre seule (règle « jamais de pop-up »), pas d'e-mail tant qu'aucun
 * service d'envoi n'est choisi.
 *
 * Pour un changement important des conditions, `effet` se pose au moins un
 * mois après `publie` (temps de résilier sans frais).
 *  - id : jamais réutilisé (« politique-1.3 », « conditions-1.3 »).
 *  - publie, effet : AAAA-MM-JJ.
 *  - texte : une ou deux phrases, ce qui change pour la personne.
 */
export type Avis = { id: string; doc: 'politique' | 'conditions'; publie: string; effet: string; titre: string; texte: string };

export const AVIS: Avis[] = [
  {
    id: 'politique-1.3',
    doc: 'politique',
    publie: '2026-11-12',
    effet: '2026-11-12',
    titre: 'Notre politique de confidentialité change',
    texte: 'Nous comptons, en chiffres d’ensemble seulement, combien de personnes portent une tenue et reviennent. Rien de nouveau n’est collecté, et tu peux t’y opposer.',
  },
];

/**
 * L'avis à montrer : le plus récent, publié après l'inscription (`inscritLe`,
 * horodatage du compte) et pas encore lu. Le même calcul sur le site
 * (`web/src/lib/avis.ts`).
 */
export function avisAMontrer(inscritLe: string | null, lus: readonly string[]): Avis | null {
  if (!inscritLe) return null;
  const jour = inscritLe.slice(0, 10);
  return AVIS.find((a) => jour < a.publie && !lus.includes(a.id)) ?? null;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « À partir du 15 décembre » tant que le changement attend, « Depuis le 12 novembre » ensuite. `aujourdhui` : AAAA-MM-JJ. */
export function avisQuand(a: Avis, aujourdhui: string): string {
  const [, m, j] = a.effet.split('-').map(Number);
  const date = `${j === 1 ? '1er' : j} ${MOIS[m - 1]}`;
  return aujourdhui < a.effet ? `À partir du ${date}` : `Depuis le ${date}`;
}

/** Les durées de conservation, les mêmes que celles appliquées chaque nuit (fonction `menage`). */
export const DUREES = {
  photos: '30 jours après l’envoi',
  conversations: '12 mois (2 mois une fois la conversation archivée)',
  ecarts: '6 mois',
  souvenirs: '12 mois, ou jusqu’à ce que tu les effaces ou retires l’accord « Kodi apprend de mes choix »',
  coeurs: 'tant que tu les gardes',
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
      { titre: 'Tout reprendre', texte: 'Tu peux tout télécharger ou tout effacer depuis Réglages › Tes données dans l’app, ou Profil › Paramètres sur le site.' },
      { titre: 'En Europe', texte: 'Ton compte et ton dressing sont hébergés dans l’Union européenne, en Irlande.' },
    ],
  },
  {
    titre: 'Qui est responsable',
    texte: [
      'Le responsable du traitement est Mylan Francois, entrepreneur individuel, qui exerce sous le nom commercial Agence E-commerce Mylan Francois. Dresskode appartient à cette agence. Ses coordonnées figurent en bas de cette page.',
      'Nous n’avons pas de délégué à la protection des données. Pour toute question sur tes données ou pour exercer tes droits, écris à l’adresse de contact indiquée en bas de page.',
    ],
  },
  {
    titre: 'Ce que nous gardons, et pourquoi',
    liste: [
      { titre: 'Ton compte', texte: 'E-mail, mot de passe (chiffré, illisible même pour nous), prénom, nom, pseudo et photo de profil, si tu les donnes. Pour créer et protéger ton compte. Base : le contrat qui nous lie (art. 6.1.b du RGPD).' },
      { titre: 'Ton dressing', texte: 'Les photos que tu confies à Kodi, les pièces qu’il en dessine, leurs étiquettes, leurs prix, tes ports et tes prêts (avec le prénom de la personne, tel que tu l’écris). Pour ranger ton dressing et composer tes tenues. Base : le contrat. Les photos confiées sont effacées 30 jours après l’envoi ; les pièces restent jusqu’à ce que tu les retires.' },
      { titre: 'Ton style', texte: 'Styles, couleurs aimées et évitées, occasions, tailles de vêtements, ville et tranche d’âge. Pour des tenues à ton goût et adaptées à ta météo. Base : le contrat.' },
      { titre: 'Mes choix', texte: 'Les pièces et les tenues que tu aimes (cœurs). Pour les retrouver dans « Mes choix ». Base : le contrat. Si tu acceptes que Kodi apprenne de tes choix, il garde aussi, en phrases, ce que tu aimes et ce que tu écartes, pour mieux te proposer. Base : ton accord « Kodi apprend de mes choix », que tu retires d’un geste : ces souvenirs sont alors effacés aussitôt.' },
      { titre: 'Ta silhouette', texte: 'Ta taille, ta silhouette et tes mesures, seulement si tu as donné ton accord. Pour choisir tes coupes et tes longueurs. Base : ton consentement explicite (art. 9.2.a), que tu retires d’un geste : tout est alors effacé.' },
      { titre: 'Ton agenda et Kodi', texte: 'Tes rendez-vous, voyages, tenues prévues et conversations avec Kodi. Pour préparer tes tenues. Base : le contrat. Conversations gardées 12 mois (2 mois une fois archivées).' },
      { titre: 'Tes « Pas pour moi »', texte: 'Les tenues que tu écartes et leur raison. Pour ne plus te proposer ce qui ne te plaît pas. Base : le contrat. Gardées 6 mois.' },
      { titre: 'Ton abonnement', texte: 'Ton offre et ton historique de paiement. Pour te facturer. Base : le contrat et nos obligations comptables. Tes coordonnées bancaires ne passent jamais par nous : elles restent chez le prestataire de paiement, qui garde les factures 10 ans comme la loi l’exige.' },
      { titre: 'Les rappels', texte: 'Si tu les acceptes, ton téléphone programme lui-même les rappels de ton planning. Rien ne part de nos serveurs. Base : ton accord, que tu changes dans Réglages.' },
      { titre: 'La sécurité', texte: 'Des journaux techniques (erreurs, connexions) gardés quelques jours chez notre hébergeur. Pour faire fonctionner et protéger le service. Base : notre intérêt légitime.' },
      // Mesure de l'usage (12/11, vue `usage_funnel`) : des totaux sur des dates déjà gardées, rien de collecté en plus.
      { titre: 'Des chiffres d’ensemble', texte: 'Pour savoir si Dresskode tient sa promesse, nous comptons combien de comptes portent une première tenue, reviennent le lendemain ou dans la semaine, et posent une question à Kodi. Ces chiffres se calculent sur nos serveurs, à partir de dates déjà gardées : création du compte, pièce ajoutée, port noté, question posée. Il n’en sort que des totaux, jamais ton nom, ton e-mail ni le contenu de ton dressing. Rien de nouveau n’est collecté, rien n’est gardé en plus, et rien ne part chez un prestataire de mesure. Base : notre intérêt légitime à améliorer le service. Tu peux t’y opposer en nous écrivant : ton compte sort alors du calcul.' },
    ],
  },
  {
    titre: 'Ce que tu n’es pas obligé de donner',
    texte: [
      'Pour créer un compte, il faut une adresse e-mail et un mot de passe. Sans compte, rien ne quitte ton téléphone.',
      'Tout le reste est facultatif : prénom, ville, silhouette, mesures, âge, photo de profil. Sans ta ville, Dresskode ne peut pas te donner la météo ; sans ta silhouette, les coupes qu’il te propose sont moins précises. Le service fonctionne quand même.',
    ],
  },
  {
    titre: 'Kodi est une intelligence artificielle',
    texte: [
      'Pour te répondre, Kodi envoie à Anthropic, qui fournit son intelligence artificielle (États-Unis) : la liste de tes pièces (avec leur type, leur saison et leur matière), ton profil de style, ton agenda des deux semaines à venir, tes tenues écartées, la météo du jour, tes cœurs et les souvenirs qui se rapprochent de ta question ; ta silhouette, ta taille et tes tailles habituelles si tu as donné ton accord. Jamais ton nom, ton e-mail, ton poids ni tes mesures.',
      'Pour dessiner tes pièces, les photos que tu confies sont analysées par Anthropic (États-Unis), puis redessinées par Google (Gemini, États-Unis).',
      'Ces prestataires agissent pour nous, sous contrat : ils n’utilisent pas tes données pour entraîner leurs modèles et les effacent au plus tard 30 jours après le traitement, sauf obligation légale.',
      'Kodi peut se tromper : ses tenues sont des idées, jamais des décisions qui t’engagent. Kodi ne prend aucune décision automatisée qui produise un effet juridique ou comparable à ton égard (art. 22 du RGPD) : ce que Kodi te propose ne vaut que si tu le valides.',
      'Un conseil : évite de montrer ton visage sur les photos de vêtements, et ne note pas d’information de santé dans tes rendez-vous.',
    ],
  },
  {
    titre: 'Qui reçoit tes données',
    texte: [
      'Seulement les prestataires qui font tourner Dresskode, liés par contrat et tenus à la confidentialité : Supabase (base de données et fichiers, Union européenne, Irlande), Vercel (site, États-Unis), Anthropic (intelligence artificielle de Kodi, États-Unis), Google (dessin des pièces et mémoire de Kodi, États-Unis), Stripe (paiement) et Expo (distribution des mises à jour de l’app, États-Unis, sans aucune donnée de ton compte).',
      'Les données du jour (météo, lieux, jours fériés, vacances scolaires) viennent de services publics et ouverts, dont la liste et les licences sont dans Réglages › Sources des données. Nos serveurs leur envoient la position de la ville de ton compte, ou celle d’un voyage, jamais ton nom ni ton e-mail.',
      'Si tu as accepté que Kodi apprenne de tes choix, les souvenirs qu’il retient sont transformés en vecteurs de sens par un service d’intelligence artificielle (Google), pour être retrouvés selon ta question. Seul le texte court d’un souvenir part, jamais ton nom ni ton e-mail.',
      'La liste nominative de nos prestataires t’est envoyée sur simple demande. Personne d’autre : aucune vente, aucun partage publicitaire.',
    ],
  },
  {
    titre: 'Hors de l’Union européenne',
    texte: [
      'Anthropic, Google, Stripe, Vercel et Expo traitent des données aux États-Unis : l’intelligence artificielle de Kodi, le paiement, l’hébergement du site (Vercel ne garde que des journaux techniques) et la distribution des mises à jour de l’app (sans donnée de ton compte ni de ton dressing).',
      'Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne et, quand le prestataire y adhère, par le cadre de protection des données entre l’Union européenne et les États-Unis.',
    ],
  },
  {
    titre: 'Combien de temps',
    liste: [
      { titre: 'Ton compte et ton dressing', texte: 'Tant que ton compte existe. Supprimé, tout est effacé de nos bases aussitôt ; les copies de sauvegarde disparaissent au plus tard 30 jours après.' },
      { titre: 'Les photos confiées à Kodi', texte: '30 jours après l’envoi.' },
      { titre: 'Les conversations avec Kodi', texte: '12 mois, 2 mois une fois archivées.' },
      { titre: 'Les tenues écartées', texte: '6 mois.' },
      { titre: 'Les souvenirs de Kodi', texte: '12 mois, ou jusqu’à ce que tu les effaces ou retires ton accord.' },
      { titre: 'Les demandes de dessin', texte: '90 jours (la pièce dessinée reste dans ton dressing).' },
      { titre: 'Les factures', texte: '10 ans, chez le prestataire de paiement, comme le code de commerce l’exige.' },
    ],
  },
  {
    titre: 'Comment elles sont protégées',
    texte: [
      'Échanges chiffrés, données chiffrées sur nos serveurs, chaque dressing cloisonné : seule sa propriétaire peut le lire. Tes photos ne sont jamais publiques ; elles s’affichent par des liens qui expirent. Aucune clé secrète n’est dans l’app.',
      'En cas de violation de données susceptible de te toucher, nous prévenons la CNIL sous 72 heures et toi sans tarder.',
    ],
  },
  {
    titre: 'Tes droits',
    texte: [
      'Tu peux accéder à tes données, les corriger, les effacer, les emporter (portabilité), en limiter l’usage, t’opposer à un traitement fondé sur notre intérêt légitime, retirer ton accord à tout moment, et laisser des directives sur ce qu’elles deviennent après ton décès.',
      'Dans l’app : Réglages › Tes données pour tout télécharger, retirer ton accord, effacer ta silhouette ou supprimer ton compte ; Moi › ton profil pour corriger. Sur le site : Profil › Paramètres pour tout télécharger ou supprimer ton compte. Pour le reste, écris-nous : nous répondons dans un délai d’un mois.',
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
    texte: [
      'L’app iPhone n’utilise aucun traceur publicitaire ni de mesure d’audience.',
      'Les chiffres d’ensemble décrits plus haut ne passent par aucun traceur : ils se calculent sur nos serveurs, sans rien lire sur ton téléphone ni dans ton navigateur.',
      'Le site n’utilise que des cookies strictement nécessaires : ta connexion, et ton choix de thème clair ou sombre. Ils ne demandent pas d’accord. Il n’y a ni cookie publicitaire, ni mesure d’audience.',
    ],
  },
  {
    titre: 'Si ce texte change',
    texte: ['Pour tout changement important, nous te prévenons dans l’app avant qu’il s’applique.'],
  },
];

/* ---- Conditions générales d'utilisation et de vente (07/11, revues le 08/11) ---- */

export const CONDITIONS_VERSION = 'Version 1.2 du 8 novembre 2026';

/** Les conditions se lisent sur le site (publiques, sans compte) ; l'app y renvoie. */
export const CONDITIONS_URL = 'https://dresskode-app.vercel.app/conditions';

/**
 * Les conditions générales d'utilisation et de vente, fidèles à ce que fait
 * l'app et le site (offres de web/src/lib/plans.ts, résiliation et factures
 * par le portail Stripe, rétractation du checkout de supabase/functions/billing).
 * À faire relire par un professionnel du droit avant la sortie. Copiées vers le
 * site et le dossier RGPD par `node tools/politique.mjs`.
 */
export const CONDITIONS: Section[] = [
  {
    titre: 'En bref',
    liste: [
      { titre: 'Gratuit pour commencer', texte: 'Découverte : 15 pièces, 4 générations offertes, 5 questions à Kodi par mois, sans carte bancaire.' },
      { titre: 'Au mois ou à l’année', texte: 'Fashion à 8,99 € et Sapologue à 18,99 € par mois, TTC. À l’année, 30 % moins cher : 75 € et 159 €. Tu résilies quand tu veux : l’offre court jusqu’à la fin de la période payée.' },
      { titre: 'Des places en plus', texte: '+10 places à 1,99 €, +30 places à 4,99 €, en paiement unique. Elles restent tant que ton compte existe.' },
      { titre: 'Kodi conseille', texte: 'Kodi est une intelligence artificielle : ses tenues sont des idées, il peut se tromper. C’est toi qui décides de ce que tu portes.' },
    ],
  },
  {
    titre: 'Qui vend, et à qui',
    texte: [
      'Dresskode, l’application iPhone et le site web, appartient à l’Agence E-commerce Mylan Francois, nom commercial sous lequel exerce Mylan Francois, entrepreneur individuel. Ses coordonnées figurent en bas de cette page.',
      'Dresskode s’adresse aux particuliers, pour un usage personnel et non professionnel. Créer un compte, ou utiliser Dresskode, vaut acceptation de ces conditions et de la politique de confidentialité.',
      'La langue du contrat est le français.',
    ],
  },
  {
    titre: 'Ton compte',
    texte: [
      'Dresskode est ouverte à partir de 15 ans. Si tu as moins de 15 ans, ne crée pas de compte.',
      'Un compte correspond à une personne. Garde ton mot de passe pour toi, et sois responsable de ce qui se fait depuis ton compte. Préviens-nous sans délai si tu constates un accès qui n’est pas le tien.',
      'Sans compte, tout reste sur ton téléphone : supprimer l’app, ou « Effacer ce téléphone », efface tout.',
    ],
  },
  {
    titre: 'Les cases à cocher',
    texte: [
      'Dresskode te demande de cocher une case avant certaines étapes. Chacune compte.',
      'À l’inscription : que tu as 15 ans ou plus, et que tu as lu et accepté ces conditions et la politique de confidentialité. La version acceptée et l’heure sont gardées avec ton compte.',
      'Avant un abonnement : que tu demandes qu’il commence tout de suite. Tu peux toujours te rétracter dans les 14 jours, et tu ne paies alors que le temps déjà écoulé.',
      'Avant un pack de places : que tu demandes leur ajout immédiat, et que tu renonces à ton droit de rétractation une fois qu’elles sont ajoutées.',
      'Sans case cochée, rien ne se crée et rien ne se paie.',
    ],
  },
  {
    titre: 'Ce que fait Dresskode',
    texte: [
      'Dresskode range ton dressing (Kodi repère les pièces sur tes photos, les détoure ou les dessine), te propose une tenue chaque jour selon la météo et ton agenda, prépare tes rendez-vous et tes voyages, et te montre ce que tu portes et ce qui dort.',
      'Certaines fonctions (Kodi, la météo, la sauvegarde de ton compte) demandent une connexion internet.',
      'Les données du jour (météo, jours fériés, vacances scolaires) viennent de sources publiques et ouvertes. Leur attribution est donnée dans Réglages › Sources des données. Une prévision peut se tromper : nous ne garantissons pas leur exactitude.',
      'Nous faisons de notre mieux pour que le service soit disponible, sans pouvoir garantir qu’il le sera à chaque instant : une maintenance, la panne d’un prestataire ou d’une source de données peut l’interrompre ou le dégrader.',
    ],
  },
  {
    titre: 'Kodi et l’intelligence artificielle',
    texte: [
      'Kodi est une intelligence artificielle. Les tenues, les conseils et les dessins de pièces sont produits automatiquement : ce sont des propositions. Un dessin peut différer de ta pièce, une tenue peut ne pas te convenir. « Rendu incorrect » fait reprendre un dessin, « Pas pour moi » écarte une tenue.',
      'Kodi ne donne ni avis médical, ni conseil juridique ou financier. Ses conseils ne remplacent pas ceux d’un professionnel. C’est toi qui décides de ce que tu portes.',
      'Les contenus produits par Kodi (tenues, dessins, textes) sont à ton usage personnel. Nous ne garantissons pas leur originalité.',
    ],
  },
  {
    titre: 'Tes photos et tes contenus',
    texte: [
      'Tes photos et tes textes restent à toi. Tu nous autorises seulement à les héberger et à les traiter pour te rendre le service (repérer, détourer, dessiner tes pièces, préparer tes tenues), pendant le temps décrit dans la politique de confidentialité.',
      'N’envoie que des images que tu as le droit d’utiliser, de préférence sans visage. Ne photographie pas une personne sans son accord. Aucun contenu illicite, offensant, ou qui porte atteinte aux droits d’une autre personne n’est autorisé.',
      'Ce que tu écris sur d’autres personnes (le prénom de quelqu’un à qui tu as prêté une pièce, un rendez-vous) ne doit être noté que si tu peux le partager.',
    ],
  },
  {
    titre: 'Les marques et les logos',
    texte: [
      'Les vêtements photographiés ou dessinés peuvent porter une marque ou un logo. Dresskode les montre tels qu’ils sont, sans les modifier. Ces marques restent la propriété de leurs titulaires.',
      'Dresskode n’est affilié à aucune marque, aucune enseigne et aucun fabricant. Les textes de l’app ne nomment aucune marque.',
    ],
  },
  {
    titre: 'Les offres et les prix',
    texte: [
      'Les prix sont en euros, toutes taxes comprises, et affichés avant chaque paiement. Le régime de TVA de l’éditeur figure sur les factures.',
      'Découverte est gratuite, sans carte bancaire et sans limite de durée : 15 pièces, 5 questions à Kodi par mois, et 4 générations offertes une seule fois, sans renouvellement.',
      'Fashion (8,99 € par mois ou 75 € par an) : jusqu’à 50 pièces, 50 générations et 30 questions à Kodi par mois. Sapologue (18,99 € par mois ou 159 € par an) : jusqu’à 100 pièces, 100 générations et Kodi sans limite. Une fonction signalée « bientôt » dans l’app ne fait pas partie de l’offre et n’est pas vendue.',
      'Les générations et les questions se renouvellent chaque mois, y compris avec un abonnement annuel ; celles qui ne sont pas utilisées ne se reportent pas.',
      'Une génération est un nouveau dessin d’une pièce (« Image propre », ou la seconde reprise d’un rendu incorrect). Elle n’est comptée que si le dessin aboutit.',
      'Les packs de places (+10 places pour 1,99 €, +30 places pour 4,99 €) s’ajoutent à la limite de ton offre et restent tant que ton compte existe. Ce sont des places, jamais des générations. Le paiement est unique.',
      'Nous pouvons modifier nos offres et nos prix. Une hausse du prix d’un abonnement t’est annoncée au moins un mois avant son entrée en vigueur ; tu peux alors résilier sans frais avant qu’elle s’applique.',
    ],
  },
  {
    titre: 'Souscrire et payer',
    texte: [
      'Pour souscrire, choisis ton offre et valide le paiement sur la page sécurisée de notre prestataire de paiement, Stripe. Ton accès est activé dès que le paiement est confirmé, et le contrat est alors conclu.',
      'Nous archivons les éléments de ta commande. Tu peux en demander une copie à l’adresse de contact. Les factures sont disponibles dans « Gérer mon abonnement ».',
      'Un abonnement est prélevé le jour de la souscription, puis chaque mois (ou chaque année pour un abonnement annuel) à la même date. L’abonnement annuel est payé en une fois et se renouvelle chaque année tant que tu ne résilies pas ; tu peux résilier à tout moment, l’offre court alors jusqu’à la fin de l’année payée. Tes coordonnées bancaires ne passent jamais par nous : elles restent chez Stripe.',
      'Si un prélèvement échoue, Stripe renouvelle la tentative. Sans régularisation, l’abonnement est arrêté et ton compte repasse en Découverte. Tes pièces au-delà de la limite restent visibles, mais tu ne peux plus en ajouter.',
    ],
  },
  {
    titre: 'Résilier',
    texte: [
      'Tu peux résilier à tout moment, sans frais : dans l’app, Réglages › Mon abonnement, puis « Résilier mon abonnement » ; sur le site, Profil › Gérer mon abonnement. Dans les deux cas, tu arrives sur la page sécurisée de notre prestataire de paiement, où tu choisis « Résilier l’abonnement ». Cette page permet aussi de changer d’offre ou de carte, et de télécharger tes factures.',
      'La résiliation prend effet à la fin de la période déjà payée (le mois, ou l’année pour un abonnement annuel) : tu gardes ton offre jusque-là, et rien n’est prélevé ensuite. La période commencée n’est pas remboursée au prorata, sauf si la loi t’ouvre un droit de rétractation (voir ci-dessous).',
      'Un pack de places n’est pas remboursable une fois ses places ajoutées, sauf dans les cas prévus par la loi.',
    ],
  },
  {
    titre: 'Ton droit de rétractation',
    texte: [
      'Pour un abonnement, tu disposes de 14 jours à compter de la souscription pour te rétracter, sans avoir à te justifier (code de la consommation, art. L221-18). En cochant la case avant de payer, tu demandes que l’offre commence tout de suite : si tu te rétractes, tu ne paies que le temps déjà écoulé (art. L221-25), et le reste t’est remboursé dans les 14 jours (art. L221-24).',
      'Pour un pack de places, fourni dès le paiement, tu demandes son ajout immédiat en cochant la case avant de payer, et tu reconnais perdre ton droit de rétractation une fois les places ajoutées (art. L221-28, 13°).',
      'Pour te rétracter, écris à l’adresse de contact de cette page, ou utilise le formulaire type ci-dessous.',
      'Formulaire type de rétractation (à renvoyer seulement si tu veux te rétracter) : À l’attention de Mylan Francois, à l’adresse de contact de cette page. Je te notifie par la présente ma rétractation du contrat portant sur [l’abonnement Fashion, l’abonnement Sapologue ou le pack de places], souscrit le [date de la souscription], compte [e-mail du compte]. Nom : [nom]. Date : [date].',
    ],
  },
  {
    titre: 'Garanties',
    texte: [
      'Dresskode est un service numérique. Il bénéficie de la garantie légale de conformité (code de la consommation, art. L224-25-12 et suivants) : il doit correspondre à ce qui est décrit dans ces conditions et dans l’app, et fonctionner comme tu peux raisonnablement l’attendre. En cas de défaut, tu peux demander sa mise en conformité sans frais ; si elle n’est pas possible ou tarde, tu peux obtenir une réduction du prix ou la résolution du contrat.',
      'Tu peux aussi faire jouer la garantie contre les défauts cachés de la chose vendue (code civil, art. 1641 et suivants).',
      'Ces garanties s’ajoutent à ton droit de rétractation et ne sont pas limitées par ces conditions.',
    ],
  },
  {
    titre: 'Responsabilité',
    texte: [
      'Dresskode t’aide à choisir, sans décider pour toi. Nous ne répondons pas des choix vestimentaires faits à partir de ses propositions, ni des écarts d’une prévision météo ou d’une source de données tierce.',
      'Dans les limites permises par la loi, notre responsabilité est limitée aux dommages directs causés par une faute de notre part. Rien dans ces conditions n’exclut ni ne limite la responsabilité pour un dommage corporel, pour une faute lourde ou intentionnelle, ni les droits que la loi te garantit.',
    ],
  },
  {
    titre: 'Propriété intellectuelle',
    texte: [
      'Dresskode (nom, logo, orbe, interface, textes, illustrations et logiciels) appartient à son éditeur et est protégé par le droit d’auteur et le droit des marques.',
      'Tu peux utiliser l’app pour toi. Tu ne peux pas copier, revendre ou modifier ses éléments, ni en extraire une base de données.',
    ],
  },
  {
    titre: 'Bon usage',
    texte: [
      'Il est interdit de contourner les limites d’une offre (par exemple, en créant plusieurs comptes pour une même personne), d’extraire les données du service par un moyen automatisé, de perturber ou de rétro-concevoir le service dans des conditions contraires à la loi, de partager ton compte, ou d’utiliser Dresskode pour nuire à quelqu’un.',
      'Nous pouvons limiter les usages abusifs (débit, blocage) pour protéger le service et les autres personnes.',
    ],
  },
  {
    titre: 'Force majeure',
    texte: [
      'Nous ne sommes pas responsables des retards ou défaillances causés par un événement échappant à notre contrôle : panne d’électricité ou d’internet, défaillance d’un prestataire ou d’une source de données, attaque informatique malgré les précautions, catastrophe naturelle, décision publique. Ces événements suspendent nos obligations le temps qu’ils durent.',
    ],
  },
  {
    titre: 'Suspension et fin du compte',
    texte: [
      'En cas de manquement grave à ces conditions (contenu illicite, contournement des limites, usage abusif), nous pouvons suspendre le compte, en te prévenant d’abord, sauf urgence ou obligation légale.',
      'Tu peux supprimer ton compte à tout moment dans l’app (Réglages › Tes données) ou sur le site (Profil › Paramètres). La suppression met fin au service et efface tes données, comme le décrit la politique de confidentialité. Un abonnement en cours est alors arrêté.',
    ],
  },
  {
    titre: 'Tes données',
    texte: ['Ce que nous gardons, pourquoi et combien de temps : tout est dans la politique de confidentialité, qui fait partie de ces conditions. Tu peux tout télécharger ou supprimer ton compte à tout moment.'],
  },
  {
    titre: 'Preuve et archivage',
    texte: ['Les enregistrements de nos systèmes (commandes, paiements, consentements) font foi entre nous, sauf preuve contraire. Ils ne limitent pas tes droits. Tu peux en demander une copie.'],
  },
  {
    titre: 'Réclamations',
    texte: ['Pour toute réclamation, écris-nous à l’adresse de contact. Nous accusons réception et répondons dans un délai de 30 jours.'],
  },
  {
    titre: 'Si ces conditions changent',
    texte: ['Nous pouvons faire évoluer ces conditions. Nous te prévenons dans l’app avant qu’un changement important s’applique. Si tu ne l’acceptes pas, tu peux résilier sans frais avant son entrée en vigueur.'],
  },
  {
    titre: 'Si une clause est nulle',
    texte: ['Si une clause de ces conditions est déclarée nulle ou inapplicable, les autres restent en vigueur.'],
  },
  {
    titre: 'Droit applicable et litiges',
    texte: [
      'Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d’abord pour chercher une solution amiable.',
      'Tu peux ensuite saisir gratuitement le médiateur de la consommation indiqué dans les mentions légales, dans l’année qui suit ta réclamation écrite. Tu peux aussi saisir les tribunaux, et notamment celui de ton domicile.',
    ],
  },
];
