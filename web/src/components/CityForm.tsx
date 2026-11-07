'use client';

import { useActionState } from 'react';
import { saveCity, type FormResult } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { Icon } from '@/components/icons';

/**
 * Ta ville (07/11) : pour la météo de chaque matin, qui choisit la bonne
 * épaisseur dans la tenue du jour et remplit le calendrier.
 */
export function CityForm({ current }: { current: string | null }) {
  const [state, action] = useActionState<FormResult | { saved: true }, FormData>(saveCity, undefined);
  return (
    <form id="ville" action={action} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px 14px' }}>
      <label htmlFor="city" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="dk-bubble-ico dk-bubble-ico--blue"><Icon name="cloud" size={19} /></span>
        <span className="dk-row__label">Ta ville, pour la météo</span>
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <input id="city" name="city" defaultValue={current ?? ''} placeholder="Paris, Lyon, Bordeaux…" autoComplete="address-level2" className="input" style={{ flex: 1 }} />
        <SubmitButton className="btn btn-glass" label="Enregistrer" pending="Un instant" />
      </div>
      {state && 'error' in state ? <p role="status" className="note small pop">{state.error}</p> : null}
      {state && 'saved' in state ? <p role="status" className="small muted">C’est noté : Kodi regarde sa météo chaque matin.</p> : null}
    </form>
  );
}
