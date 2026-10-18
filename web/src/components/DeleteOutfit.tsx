'use client';

import { useState } from 'react';
import { deleteOutfit } from '@/app/actions';
import { Icon, ICON } from '@/components/ui';

/**
 * Supprimer une tenue ne s'annule pas : un premier geste demande la
 * confirmation dans la carte même, avec une sortie. La carte est étroite
 * (deux colonnes) : la confirmation la recouvre entière.
 */
export function DeleteOutfit({ id, name }: { id: string; name: string }) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="btn btn-ghost btn-icon"
        style={{ width: 44, height: 44, minHeight: 44 }}
        aria-label={`Supprimer ${name}`}
      >
        <Icon d={ICON.trash} size={17} width={1.6} />
      </button>
    );
  }

  return (
    <form
      action={deleteOutfit}
      className="pop"
      style={{
        position: 'absolute', inset: 0, zIndex: 1, borderRadius: 26, padding: 12,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8,
        background: 'var(--glass-strong)', textAlign: 'center',
      }}
    >
      <input type="hidden" name="id" value={id} />
      <p className="small" style={{ fontWeight: 600 }}>Supprimer « {name} » ?</p>
      <p className="piece-kind" style={{ marginBottom: 4 }}>Les pièces restent dans ton dressing.</p>
      <button type="submit" className="btn btn-sm btn-block" style={{ background: 'var(--danger)', color: 'var(--on-ink)' }} autoFocus>
        Supprimer
      </button>
      <button type="button" onClick={() => setAsking(false)} className="btn btn-glass btn-sm btn-block">
        Annuler
      </button>
    </form>
  );
}
