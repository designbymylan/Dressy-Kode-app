/**
 * La politique de confidentialité, copiée de mobile/src/data/legal.ts par
 * tools/politique.mjs. Ne pas modifier ici : changer legal.ts, puis relancer
 * `node tools/politique.mjs`.
 */

export type Section = { titre: string; texte?: string[]; liste?: { titre: string; texte: string }[] };

export const POLITIQUE_VERSION = "Version 1.1 du 7 novembre 2026";

export const EDITEUR: { nom: string; forme: string | null; adresse: string | null; siren: string | null; contact: string | null; directeur: string | null; mediateur: string | null } = {
  "nom": "Dresskode",
  "forme": null,
  "adresse": null,
  "siren": null,
  "contact": null,
  "directeur": null,
  "mediateur": null
};

export const POLITIQUE: Section[] = [
  {
    "titre": "En bref",
    "liste": [
      {
        "titre": "Une seule raison",
        "texte": "Tes données servent à t’habiller avec ce que tu as. Rien n’est vendu, rien ne sert à de la publicité, aucun traceur publicitaire."
      },
      {
        "titre": "Ton corps, avec ton accord",
        "texte": "Ta taille, ta silhouette et tes mesures ne sont demandées qu’avec ton accord explicite, retirable à tout moment. Ton poids n’est plus demandé."
      },
      {
        "titre": "Tout reprendre",
        "texte": "Tu peux tout télécharger ou tout effacer depuis Réglages › Tes données dans l’app, ou Profil › Paramètres sur le site."
      },
      {
        "titre": "En Europe",
        "texte": "Ton compte et ton dressing sont hébergés dans l’Union européenne, en Irlande."
      }
    ]
  },
  {
    "titre": "Qui est responsable",
    "texte": [
      "Le responsable du traitement est l’éditeur de Dresskode, dont l’identité figure en bas de cette page.",
      "Pour toute question sur tes données, ou pour exercer tes droits, écris à l’adresse de contact indiquée en bas de page."
    ]
  },
  {
    "titre": "Ce que nous gardons, et pourquoi",
    "liste": [
      {
        "titre": "Ton compte",
        "texte": "E-mail, mot de passe (chiffré, illisible même pour nous), prénom, nom, pseudo et photo de profil, si tu les donnes. Pour créer et protéger ton compte. Base : le contrat qui nous lie (art. 6.1.b du RGPD)."
      },
      {
        "titre": "Ton dressing",
        "texte": "Les photos que tu confies à Kodi, les pièces qu’il en dessine, leurs étiquettes, leurs prix, tes ports et tes prêts (avec le prénom de la personne, tel que tu l’écris). Pour ranger ton dressing et composer tes tenues. Base : le contrat. Les photos confiées sont effacées 30 jours après l’envoi ; les pièces restent jusqu’à ce que tu les retires."
      },
      {
        "titre": "Ton style",
        "texte": "Styles, couleurs aimées et évitées, occasions, tailles de vêtements, ville et tranche d’âge. Pour des tenues à ton goût et adaptées à ta météo. Base : le contrat."
      },
      {
        "titre": "Mes choix",
        "texte": "Les pièces et les tenues que tu aimes (cœurs). Pour les retrouver dans « Mes choix ». Base : le contrat. Si tu acceptes que Kodi apprenne de tes choix, il garde aussi, en phrases, ce que tu aimes et ce que tu écartes, pour mieux te proposer. Base : ton accord « Kodi apprend de mes choix », que tu retires d’un geste : ces souvenirs sont alors effacés aussitôt."
      },
      {
        "titre": "Ta silhouette",
        "texte": "Ta taille, ta silhouette et tes mesures, seulement si tu as donné ton accord. Pour choisir tes coupes et tes longueurs. Base : ton consentement explicite (art. 9.2.a), que tu retires d’un geste : tout est alors effacé."
      },
      {
        "titre": "Ton agenda et Kodi",
        "texte": "Tes rendez-vous, voyages, tenues prévues et conversations avec Kodi. Pour préparer tes tenues. Base : le contrat. Conversations gardées 12 mois (2 mois une fois archivées)."
      },
      {
        "titre": "Tes « Pas pour moi »",
        "texte": "Les tenues que tu écartes et leur raison. Pour ne plus te proposer ce qui ne te plaît pas. Base : le contrat. Gardées 6 mois."
      },
      {
        "titre": "Ton abonnement",
        "texte": "Ton offre et ton historique de paiement. Pour te facturer. Base : le contrat et nos obligations comptables. Tes coordonnées bancaires ne passent jamais par nous : elles restent chez le prestataire de paiement, qui garde les factures 10 ans comme la loi l’exige."
      },
      {
        "titre": "Les rappels",
        "texte": "Si tu les acceptes, ton téléphone programme lui-même les rappels de ton planning. Rien ne part de nos serveurs. Base : ton accord, que tu changes dans Réglages."
      },
      {
        "titre": "La sécurité",
        "texte": "Des journaux techniques (erreurs, connexions) gardés quelques jours chez notre hébergeur. Pour faire fonctionner et protéger le service. Base : notre intérêt légitime."
      }
    ]
  },
  {
    "titre": "Kodi est une intelligence artificielle",
    "texte": [
      "Pour te répondre, Kodi envoie à un prestataire d’intelligence artificielle : la liste de tes pièces (avec leur type, leur saison et leur matière), ton profil de style, ton agenda des deux semaines à venir, tes tenues écartées, la météo du jour, tes cœurs et les souvenirs qui se rapprochent de ta question ; ta silhouette, ta taille et tes tailles habituelles si tu as donné ton accord. Jamais ton nom, ton e-mail, ton poids ni tes mesures.",
      "Pour dessiner tes pièces, les photos que tu confies sont analysées et redessinées par des prestataires d’intelligence artificielle.",
      "Ces prestataires agissent pour nous, sous contrat : ils n’utilisent pas tes données pour entraîner leurs modèles et les effacent au plus tard 30 jours après le traitement, sauf obligation légale.",
      "Kodi peut se tromper : ses tenues sont des idées, jamais des décisions qui t’engagent.",
      "Un conseil : évite de montrer ton visage sur les photos de vêtements, et ne note pas d’information de santé dans tes rendez-vous."
    ]
  },
  {
    "titre": "Qui reçoit tes données",
    "texte": [
      "Seulement les prestataires qui font tourner Dresskode, liés par contrat et tenus à la confidentialité : hébergement et base de données (Union européenne, Irlande), intelligence artificielle (États-Unis), paiement, et distribution des mises à jour de l’app (sans aucune donnée de ton compte).",
      "Les données du jour (météo, jours fériés, vacances) sont demandées par nos serveurs à des services publics et ouverts, avec le nom de ta ville seulement, sans rien qui te désigne.",
      "Si tu as accepté que Kodi apprenne de tes choix, les souvenirs qu’il retient sont transformés en vecteurs de sens par un service d’intelligence artificielle (Google), pour être retrouvés selon ta question. Seul le texte court d’un souvenir part, jamais ton nom ni ton e-mail.",
      "La liste nominative de nos prestataires t’est envoyée sur simple demande. Personne d’autre : aucune vente, aucun partage publicitaire."
    ]
  },
  {
    "titre": "Hors de l’Union européenne",
    "texte": [
      "Les prestataires d’intelligence artificielle et de paiement peuvent traiter des données aux États-Unis. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne et, quand le prestataire y adhère, par le cadre de protection des données entre l’Union européenne et les États-Unis."
    ]
  },
  {
    "titre": "Combien de temps",
    "liste": [
      {
        "titre": "Ton compte et ton dressing",
        "texte": "Tant que ton compte existe. Supprimé, tout est effacé aussitôt (les copies de sauvegarde disparaissent d’elles-mêmes sous quelques jours)."
      },
      {
        "titre": "Les photos confiées à Kodi",
        "texte": "30 jours après l’envoi."
      },
      {
        "titre": "Les conversations avec Kodi",
        "texte": "12 mois, 2 mois une fois archivées."
      },
      {
        "titre": "Les tenues écartées",
        "texte": "6 mois."
      },
      {
        "titre": "Les souvenirs de Kodi",
        "texte": "12 mois, ou jusqu’à ce que tu les effaces ou retires ton accord."
      },
      {
        "titre": "Les demandes de dessin",
        "texte": "90 jours (la pièce dessinée reste dans ton dressing)."
      },
      {
        "titre": "Les factures",
        "texte": "10 ans, chez le prestataire de paiement, comme le code de commerce l’exige."
      }
    ]
  },
  {
    "titre": "Comment elles sont protégées",
    "texte": [
      "Échanges chiffrés, données chiffrées sur nos serveurs, chaque dressing cloisonné : seule sa propriétaire peut le lire. Tes photos ne sont jamais publiques ; elles s’affichent par des liens qui expirent. Aucune clé secrète n’est dans l’app.",
      "En cas de fuite qui pourrait te toucher, nous prévenons la CNIL sous 72 heures et toi sans tarder."
    ]
  },
  {
    "titre": "Tes droits",
    "texte": [
      "Tu peux accéder à tes données, les corriger, les effacer, les emporter (portabilité), en limiter l’usage, t’opposer à un traitement fondé sur notre intérêt légitime, retirer ton accord à tout moment, et laisser des directives sur ce qu’elles deviennent après ton décès.",
      "Dans l’app : Réglages › Tes données pour tout télécharger, retirer ton accord, effacer ta silhouette ou supprimer ton compte ; Moi › ton profil pour corriger. Sur le site : Profil › Paramètres pour tout télécharger ou supprimer ton compte. Pour le reste, écris-nous : nous répondons sous un mois.",
      "Si tu estimes que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07)."
    ]
  },
  {
    "titre": "À partir de 15 ans",
    "texte": [
      "Dresskode est ouverte à partir de 15 ans, l’âge auquel la loi française permet de consentir seul au traitement de ses données en ligne."
    ]
  },
  {
    "titre": "Sans compte",
    "texte": [
      "Sans compte, tout reste sur ton téléphone : rien n’est envoyé à nos serveurs. Supprimer l’app ou « Effacer ce téléphone » dans Tes données efface tout."
    ]
  },
  {
    "titre": "Cookies et traceurs",
    "texte": [
      "L’app n’utilise aucun traceur publicitaire ni de mesure d’audience. Le site n’utilise que les cookies nécessaires à ta connexion, qui ne demandent pas d’accord."
    ]
  },
  {
    "titre": "Si ce texte change",
    "texte": [
      "Pour tout changement important, nous te prévenons dans l’app avant qu’il s’applique."
    ]
  }
];

export const CONDITIONS_VERSION = "Version 1.0 du 7 novembre 2026";

export const HEBERGEURS: string[] = [
  "Site : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.",
  "Données : Supabase, sur des serveurs situés dans l’Union européenne (Irlande)."
];

export const CONDITIONS: Section[] = [
  {
    "titre": "En bref",
    "liste": [
      {
        "titre": "Gratuit pour commencer",
        "texte": "Découverte : 15 pièces, 4 générations offertes, 5 questions à Kodi par mois, sans carte bancaire."
      },
      {
        "titre": "Au mois, sans engagement",
        "texte": "Fashion à 8,99 € et Sapologue à 18,99 € par mois, TTC. Tu résilies quand tu veux : l’offre court jusqu’à la fin du mois payé."
      },
      {
        "titre": "Des places en plus",
        "texte": "+10 places à 1,99 €, +30 places à 4,99 €, en paiement unique. Elles restent tant que ton compte existe."
      },
      {
        "titre": "Kodi conseille",
        "texte": "Kodi est une intelligence artificielle : ses tenues sont des idées, il peut se tromper. C’est toi qui décides de ce que tu portes."
      }
    ]
  },
  {
    "titre": "À quoi servent ces conditions",
    "texte": [
      "Elles encadrent l’usage de Dresskode, l’app iPhone et le site, édités par l’éditeur indiqué en bas de page. Créer un compte, ou utiliser l’app sans compte, vaut acceptation de ces conditions et de la politique de confidentialité.",
      "Dresskode s’adresse aux particuliers, pour un usage personnel."
    ]
  },
  {
    "titre": "Ton compte",
    "texte": [
      "Dresskode est ouverte à partir de 15 ans. Un compte correspond à une personne ; garde ton mot de passe pour toi. Tu es responsable de ce qui se fait depuis ton compte.",
      "Sans compte, tout reste sur ton téléphone : le supprimer efface tout."
    ]
  },
  {
    "titre": "Ce que fait Dresskode",
    "texte": [
      "Ranger ton dressing (Kodi repère les pièces sur tes photos, les détoure ou les dessine), te proposer une tenue chaque jour avec la météo et ton agenda, préparer tes rendez-vous et tes voyages, et te montrer ce que tu portes et ce qui dort.",
      "Nous faisons de notre mieux pour que le service soit disponible et juste, sans pouvoir garantir qu’il le soit à chaque instant : une maintenance, une panne d’un prestataire ou d’une source de données (météo, calendrier) peut l’interrompre ou le dégrader."
    ]
  },
  {
    "titre": "Kodi et l’intelligence artificielle",
    "texte": [
      "Les tenues, les conseils et les dessins de pièces sont produits automatiquement. Ce sont des propositions : un dessin peut différer de ta pièce, une tenue peut ne pas te convenir. « Rendu incorrect » permet de faire reprendre une pièce, et « Pas pour moi » d’écarter une tenue.",
      "Kodi ne donne aucun avis médical, et ses conseils ne remplacent pas celui d’un professionnel."
    ]
  },
  {
    "titre": "Tes photos et tes contenus",
    "texte": [
      "Tes photos restent à toi. Tu nous autorises seulement à les traiter pour te rendre le service (repérer, détourer, dessiner tes pièces), le temps nécessaire, comme le décrit la politique de confidentialité.",
      "N’envoie que des photos que tu as le droit d’utiliser, de préférence sans visage, et jamais de contenu illicite ou portant atteinte aux droits d’une autre personne."
    ]
  },
  {
    "titre": "Les offres et les prix",
    "texte": [
      "Les prix sont en euros, toutes taxes comprises, et affichés avant chaque paiement. Découverte est gratuite et sans limite de durée ; ses 4 générations sont offertes une fois, sans renouvellement.",
      "Fashion (50 pièces, 50 générations par mois, 30 questions à Kodi par mois) et Sapologue (100 pièces, 100 générations par mois, Kodi sans limite) se paient chaque mois. Les générations et les questions repartent à zéro chaque mois ; celles qui ne sont pas utilisées ne se reportent pas.",
      "Une génération est un nouveau dessin d’une pièce (« Image propre », seconde reprise d’un rendu incorrect). Elle n’est comptée que si le dessin aboutit.",
      "Les packs de places s’ajoutent à la limite de ton offre et restent tant que ton compte existe. Ce sont des places, jamais des générations."
    ]
  },
  {
    "titre": "Le paiement",
    "texte": [
      "Le paiement se fait par carte bancaire, chez notre prestataire de paiement (Stripe), qui seul voit ta carte. Un abonnement est prélevé le jour de la souscription, puis chaque mois à la même date, jusqu’à sa résiliation.",
      "Si un prélèvement échoue, nous te prévenons ; sans régularisation, ton compte repasse en Découverte. Tes pièces au-delà de la limite restent visibles, mais tu ne peux plus en ajouter."
    ]
  },
  {
    "titre": "Résilier",
    "texte": [
      "Tu résilies à tout moment, en quelques gestes, depuis « Gérer mon abonnement » (Profil sur le site). La résiliation prend effet à la fin du mois déjà payé : tu gardes ton offre jusque-là, rien n’est plus prélevé ensuite, et le mois commencé n’est pas remboursé au prorata."
    ]
  },
  {
    "titre": "Ton droit de rétractation",
    "texte": [
      "Pour un abonnement, tu disposes de 14 jours à compter de la souscription pour te rétracter, sans motif (code de la consommation, art. L221-18). En t’abonnant, tu demandes que l’offre commence tout de suite : si tu te rétractes, seule la part correspondant au temps déjà écoulé reste due (art. L221-25), et le reste t’est remboursé dans les 14 jours.",
      "Pour un pack de places, fourni dès le paiement, tu demandes son ajout immédiat et reconnais perdre ton droit de rétractation une fois les places ajoutées (art. L221-28, 13°).",
      "Pour te rétracter, écris à l’adresse de contact indiquée en bas de page, par exemple : « Je me rétracte de mon abonnement à Dresskode souscrit le [date], avec l’adresse [e-mail du compte]. »"
    ]
  },
  {
    "titre": "Responsabilité",
    "texte": [
      "Dresskode t’aide à choisir, sans décider pour toi : nous ne répondons pas des choix vestimentaires faits à partir de ses propositions, ni des écarts d’une prévision météo fournie par des sources tierces. Notre responsabilité reste engagée dans les cas prévus par la loi, notamment pour les dommages directs causés par une faute de notre part."
    ]
  },
  {
    "titre": "Suspension",
    "texte": [
      "En cas de manquement grave à ces conditions (contenu illicite, contournement des limites, usage abusif du service), nous pouvons suspendre le compte, en te prévenant d’abord sauf urgence."
    ]
  },
  {
    "titre": "Tes données",
    "texte": [
      "Ce que nous gardons, pourquoi et combien de temps : tout est dans la politique de confidentialité. Tu peux tout télécharger ou supprimer ton compte à tout moment."
    ]
  },
  {
    "titre": "Si ces conditions changent",
    "texte": [
      "Nous te prévenons avant qu’un changement important s’applique. Si tu ne l’acceptes pas, tu peux résilier sans frais avant son entrée en vigueur."
    ]
  },
  {
    "titre": "Litiges",
    "texte": [
      "Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d’abord : nous cherchons une solution amiable. Tu peux ensuite saisir gratuitement le médiateur de la consommation indiqué en bas de page, puis le tribunal compétent."
    ]
  }
];
