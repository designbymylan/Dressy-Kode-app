/**
 * Les notifications push (18/11) : garde le jeton de cet appareil d'accord
 * avec le choix de la personne. Un « oui » (tout, ou seulement le planning)
 * l'enregistre ; un « non » ou la sortie du compte le retirent. Aucun jeton
 * sans compte (la démonstration n'en a pas), ni avant la fenêtre de l'iPhone.
 */
import { jetonPush } from './notifications';
import * as remote from './remote';
import { Platform } from 'react-native';

const plateforme = (): 'ios' | 'android' => (Platform.OS === 'android' ? 'android' : 'ios');

/** Pas plus de quelques secondes : sans réseau, la sortie du compte ne doit pas attendre. */
const vite = <T,>(p: Promise<T>, ms = 5000) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error('délai dépassé')), ms))]);

/** Enregistre (ou retire) le jeton de cet appareil selon le choix. Sans réseau ni jeton : ne fait rien. */
export async function accorderJeton(actif: boolean): Promise<void> {
  try {
    const jeton = await vite(jetonPush());
    if (!jeton) return;
    if (actif) await vite(remote.registerPushToken(jeton, plateforme()));
    else await vite(remote.unregisterPushToken(jeton));
  } catch (e) {
    console.warn('[push] jeton :', e instanceof Error ? e.message : e);
  }
}
