/**
 * Les scénarios de Kodi et leur relecture : à venir (banc d'essai, section 7
 * du chantier du 13/11).
 */
import type { Banc, Rendu } from '../_shared/banc.ts';

export function essaiKodi(_b: Banc, _p: Record<string, unknown>): Promise<Rendu> {
  return Promise.reject(new Error('mode kodi : pas encore construit'));
}

export function essaiJuge(_b: Banc, _p: Record<string, unknown>): Promise<Rendu> {
  return Promise.reject(new Error('mode juge : pas encore construit'));
}
