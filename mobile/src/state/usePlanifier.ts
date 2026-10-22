/**
 * « Kodi, prévois ces jours » : une tenue par jour choisi. Un compte connecté
 * passe par Kodi (fonction `kode`, action `planifier`), qui lit les
 * rendez-vous, la météo, le profil et toute sa culture de styliste ; sans
 * réponse, ou sans compte, la version du téléphone prend le relais.
 */
import { useCallback } from 'react';
import { useMeteo, useStore } from './store';
import { offsetOf, type Iso, type Trip } from './planning';
import { proposer } from './planifier';
import * as remote from './remote';
import type { Planned } from './remote';
import type { Weather } from '../data/wardrobe';

export function usePlanifier() {
  const { s } = useStore();
  const meteo = useMeteo();
  return useCallback(
    async (dates: Iso[], opts: { trip?: Trip | null; meteo?: Record<Iso, Weather | null>; consigne?: string } = {}): Promise<Record<Iso, Planned>> => {
      const jours = [...new Set(dates)].sort();
      if (s.account === 'connecte' && remote.online) {
        const r = await remote.planifier(jours, opts.trip ?? null, opts.consigne ?? '').catch((e: unknown) => {
          console.warn('[kode] planifier :', e instanceof Error ? e.message : e);
          return null;
        });
        if (r && Object.keys(r).length) return r;
      }
      const meteoDe = (d: Iso) => opts.meteo?.[d] ?? meteo.jours[offsetOf(d)] ?? null;
      return proposer(s.pieces, jours, { meteo: meteoDe, events: s.events, trip: opts.trip });
    },
    [s.account, s.pieces, s.events, meteo],
  );
}
