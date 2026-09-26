/**
 * Les jours de l'application sont ceux de Paris, pas ceux du serveur : à
 * 23 h 30 à Paris, un serveur en UTC est encore « hier » ou déjà « demain ».
 */
const PARIS = 'Europe/Paris';

/** Jour au format AAAA-MM-JJ à Paris, décalé de `offset` jours. */
export function parisDay(offset = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** « Samedi 26 septembre ». */
export function parisDateLabel(): string {
  const label = new Intl.DateTimeFormat('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}
