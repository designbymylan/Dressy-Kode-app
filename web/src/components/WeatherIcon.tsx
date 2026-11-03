import { Icon } from '@/components/icons';
import type { Kind } from '@/lib/contexte';

/**
 * Le ciel en une petite icône pleine : soleil, nuages, ou nuage et gouttes
 * pour la pluie fine et les averses (le jeu d'icônes n'a pas de pluie).
 */
export function WeatherIcon({ kind, size = 15 }: { kind: Kind; size?: number }) {
  if (kind === 'soleil') return <Icon name="sun" size={size} />;
  if (kind === 'nuages') return <Icon name="cloud" size={size} />;
  return (
    <svg className="dk-ico" data-anim="drop" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.2 15.4a4.2 4.2 0 0 1-.8-8.3 5.8 5.8 0 0 1 11 1.3 3.5 3.5 0 0 1-.5 7Z" />
      <rect x="6.9" y="16.4" width="2" height="4.4" rx="1" transform="rotate(16 7.9 18.6)" />
      <rect x="11.1" y="17.2" width="2" height="4.4" rx="1" transform="rotate(16 12.1 19.4)" />
      <rect x="15.3" y="16.4" width="2" height="4.4" rx="1" transform="rotate(16 16.3 18.6)" />
    </svg>
  );
}

/** Le ciel dit en mot pour un lecteur d'écran (« averses », « soleil »). */
export const KIND_WORD: Record<Kind, string> = { soleil: 'ensoleillé', nuages: 'nuageux', pluie: 'pluie', averses: 'averses' };
