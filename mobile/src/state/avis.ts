/**
 * L'avis de changement en tête de l'accueil (12/11) : voir `AVIS`
 * (data/legal.ts). Seul un compte connecté le voit : sans compte, rien n'a été
 * accepté ni gardé chez nous.
 *
 * « Compris » le cache aussitôt sur ce téléphone, puis l'écrit dans le compte.
 * Sans réseau, l'écriture se refait au lancement suivant : le téléphone garde
 * la liste de ce qui reste à envoyer.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { avisAMontrer, type Avis } from '../data/legal';
import { avisDuCompte, marquerAvisLus, online } from './remote';
import { useStore } from './store';

const KEY = 'dresskode:avis-lus';

const lire = async (): Promise<string[]> => {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export function useAvis(): [Avis | null, () => void] {
  const { s } = useStore();
  const userId = online && s.account === 'connecte' ? (s.session?.userId ?? null) : null;
  const [avis, setAvis] = useState<Avis | null>(null);

  useEffect(() => {
    setAvis(null);
    if (!userId) return;
    let on = true;
    (async () => {
      const [compte, local] = await Promise.all([avisDuCompte(), lire()]);
      if (!on || !compte) return;
      setAvis(avisAMontrer(compte.inscritLe, [...compte.lus, ...local]));
      // Un « Compris » donné hors réseau : le compte l'apprend maintenant.
      const enAttente = local.filter((id) => !compte.lus.includes(id));
      if (enAttente.length) await marquerAvisLus(enAttente);
    })().catch(() => undefined);
    return () => {
      on = false;
    };
  }, [userId]);

  const lu = useCallback(() => {
    if (!avis) return;
    setAvis(null);
    lire()
      .then((local) => AsyncStorage.setItem(KEY, JSON.stringify([...new Set([...local, avis.id])])))
      .then(() => marquerAvisLus([avis.id]))
      .catch(() => undefined);
  }, [avis]);

  return [avis, lu];
}
