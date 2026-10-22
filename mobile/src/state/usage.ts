import { CATEGORIES, type CategoryId, type Piece } from '../data/wardrobe';
import type { KodiMood } from '../ui/Kodi';

/** Fenêtre sur laquelle une pièce compte comme « portée » (web : lib/usage.ts). */
export const WINDOW_DAYS = 90;

export type Usage = {
  total: number;
  worn: number;
  pct: number;
  categories: { id: CategoryId; label: string; total: number; worn: number; pct: number }[];
};

const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0);
const worn = (p: Piece) => p.lastWorn !== null && p.lastWorn <= WINDOW_DAYS;

/**
 * La part de la garde-robe vraiment portée ces 90 derniers jours, en tout
 * et par catégorie : la barre de progression du dressing (21/10).
 */
export function usageOf(pieces: Piece[]): Usage {
  const n = pieces.filter(worn).length;
  return {
    total: pieces.length,
    worn: n,
    pct: pct(n, pieces.length),
    categories: CATEGORIES.map((c) => {
      const mine = pieces.filter((p) => p.category === c.id);
      const w = mine.filter(worn).length;
      return { id: c.id, label: c.short, total: mine.length, worn: w, pct: pct(w, mine.length) };
    }).filter((c) => c.total > 0),
  };
}

/** Ce que Kodi dit de la barre, et la tête qu'il fait (mêmes phrases que le web). */
export function usageMood(u: Pick<Usage, 'total' | 'worn' | 'pct'>): { mood: KodiMood; line: string } {
  if (!u.total) return { mood: 'wave', line: 'Ajoute tes pièces, je m’occupe du reste.' };
  if (!u.worn) return { mood: 'thinking', line: 'Dis-moi ce que tu portes : « Je la porte » dans la fiche d’une pièce, ou sur ta tenue du jour.' };
  if (u.pct < 25) return { mood: 'sleepy', line: 'La plupart de tes pièces dorment. On en réveille une demain ?' };
  if (u.pct < 50) return { mood: 'wink', line: 'Bon début. L’autre moitié de ton dressing t’attend.' };
  if (u.pct < 80) return { mood: 'happy', line: 'Tu fais tourner ton dressing, c’est beau à voir.' };
  return { mood: 'celebrate', line: 'Presque tout ton dressing vit. Bravo !' };
}
