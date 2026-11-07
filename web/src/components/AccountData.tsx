'use client';

import { useActionState, useState } from 'react';
import { deleteMyAccount, exportMyData, type FormResult } from '@/app/actions';
import { SubmitButton } from '@/components/SubmitButton';
import { Icon } from '@/components/icons';

/**
 * Tes données (07/11) : télécharger tout ce que Dresskode garde, ou supprimer
 * le compte. La suppression demande d'écrire SUPPRIMER, comme sur le mobile :
 * elle efface le dressing, les photos et l'historique, et arrête l'abonnement.
 */
export function AccountData() {
  const [exp, exportAction] = useActionState<FormResult, FormData>(exportMyData, undefined);
  const [del, deleteAction] = useActionState<FormResult, FormData>(deleteMyAccount, undefined);
  const [open, setOpen] = useState(false);
  return (
    <>
      <form action={exportAction}>
        <button type="submit" className="dk-row">
          <span className="dk-bubble-ico dk-bubble-ico--blue"><Icon name="layers" size={19} /></span>
          <span className="dk-row__label">Télécharger mes données</span>
        </button>
        {exp?.error ? <p role="status" className="note small pop" style={{ margin: '0 12px 10px' }}>{exp.error}</p> : null}
      </form>
      {!open ? (
        <button type="button" className="dk-row" style={{ color: 'var(--danger)' }} onClick={() => setOpen(true)} aria-expanded={false}>
          <span className="dk-bubble-ico dk-bubble-ico--plain" style={{ color: 'var(--danger)' }}><Icon name="trash" size={19} /></span>
          <span className="dk-row__label">Supprimer mon compte</span>
        </button>
      ) : (
        <form action={deleteAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px 14px' }}>
          <p className="small">
            Ton dressing, tes photos, tes tenues et ton historique seront effacés, et ton abonnement s’arrêtera. Ce n’est pas réversible.
          </p>
          <label className="small muted" htmlFor="confirmation">Écris SUPPRIMER pour confirmer</label>
          <input id="confirmation" name="confirmation" className="input" autoComplete="off" autoCapitalize="characters" required />
          {del?.error ? <p role="status" className="note small pop">{del.error}</p> : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-glass" onClick={() => setOpen(false)}>Annuler</button>
            <SubmitButton className="btn btn-dark" label="Supprimer définitivement" pending="Suppression" />
          </div>
        </form>
      )}
    </>
  );
}
