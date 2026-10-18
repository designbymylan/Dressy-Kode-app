import { View, type ViewStyle } from 'react-native';
import { credit, heureMaj, type Bloc } from '../state/contexte';
import { T } from './T';

/**
 * La source d'une donnée du jour, en petit, là où elle s'affiche : son
 * crédit (que la licence demande) et l'heure de mise à jour. Plusieurs
 * blocs partagent une ligne ; l'heure donnée est celle du plus ancien.
 * Une donnée ancienne ou absente le dit en clair, sans rien casser.
 */
export function Credit({ blocs, style }: { blocs: (Bloc<unknown> | null | undefined)[]; style?: ViewStyle }) {
  const ok = blocs.filter((b): b is Bloc<unknown> => !!b && b.etat === 'frais' && b.valeur !== null);
  const mentions = [...new Set(ok.map((b) => b.mention).filter(Boolean))];
  const plusAncien = ok.map((b) => b.maj).filter((m): m is string => !!m).sort()[0];
  const alertes = blocs.map((b) => (b && b.etat !== 'frais' ? credit(b) : null)).filter((x): x is { text: string; warn: boolean } => !!x);
  if (!mentions.length && !alertes.length) return null;
  return (
    <View style={[{ gap: 2 }, style]} accessibilityRole="text">
      {mentions.length > 0 && (
        <T v="small" tone="ink2">
          {mentions.join(' · ')}
          {plusAncien ? ` · mise à jour ${heureMaj(plusAncien)}` : ''}
        </T>
      )}
      {[...new Set(alertes.map((a) => a.text))].map((text) => (
        <T key={text} v="small" tone="caution">
          {text}
        </T>
      ))}
    </View>
  );
}
