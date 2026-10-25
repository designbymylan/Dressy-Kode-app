/** Fenêtre sur laquelle une pièce compte comme « portée ». */
export const WINDOW_DAYS = 90;

export type Usage = {
  total: number;
  worn: number;
  pct: number;
  categories: { id: string; label: string; total: number; worn: number; pct: number }[];
};

/**
 * La part de la garde-robe vraiment portée ces 90 derniers jours, en tout
 * et par catégorie : la barre de progression du dressing (21/10). `last`
 * donne le dernier port de chaque pièce (vue garment_stats).
 */
export function usageOf(
  pieces: { id: string; category_id: string }[],
  last: Record<string, string | null | undefined>,
  categories: { id: string; label: string }[],
  since: string,
): Usage {
  const worn = (id: string) => Boolean(last[id] && last[id]! >= since);
  const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);
  const n = pieces.filter((p) => worn(p.id)).length;
  return {
    total: pieces.length,
    worn: n,
    pct: pct(n, pieces.length),
    categories: categories
      .map((c) => {
        const mine = pieces.filter((p) => p.category_id === c.id);
        const w = mine.filter((p) => worn(p.id)).length;
        return { id: c.id, label: c.label, total: mine.length, worn: w, pct: pct(w, mine.length) };
      })
      .filter((c) => c.total > 0),
  };
}

/** Ce que Kodi dit de la barre. */
export function usageLine(u: Pick<Usage, 'total' | 'worn' | 'pct'>): string {
  if (!u.total) return 'Ajoute tes pièces, je m’occupe du reste.';
  if (!u.worn) return 'Dis-moi ce que tu portes : « Je l’ai portée » dans la fiche d’une pièce, ou « Je la porte » sur ta tenue du jour.';
  if (u.pct < 25) return 'La plupart de tes pièces dorment. On en réveille une demain ?';
  if (u.pct < 50) return 'Bon début. L’autre moitié de ton dressing t’attend.';
  if (u.pct < 80) return 'Tu fais tourner ton dressing, c’est beau à voir.';
  return 'Presque tout ton dressing vit. Bravo !';
}
