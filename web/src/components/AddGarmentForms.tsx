'use client';

import { useActionState, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addGarment, requestAiGarments, type FormResult } from '@/app/actions';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { Field, ErrorNote, inputStyle, buttonPrimary, buttonQuiet } from '@/components/ui';

/** Le message d'erreur, et le chemin vers les offres quand le dressing est plein. */
function Problem({ error, code }: { error: string; code?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ErrorNote>{error}</ErrorNote>
      {code === 'pieces' ? (
        <Link href="/offres" style={{ fontSize: 13, fontWeight: 500, textDecoration: 'underline' }}>
          Voir les offres
        </Link>
      ) : null}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ ...buttonPrimary, opacity: pending ? 0.6 : 1 }}>
      {pending ? 'Un instant…' : label}
    </button>
  );
}

export function ManualForm({ categories }: { categories: { id: string; label: string }[] }) {
  const [state, action] = useActionState<FormResult, FormData>(addGarment, undefined);

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state?.error ? <Problem error={state.error} code={state.code} /> : null}

      <Field label="La pièce">
        <input name="name" type="text" required placeholder="Blazer noir" style={inputStyle} />
      </Field>

      <Field label="Catégorie">
        <select name="category_id" required defaultValue="" style={inputStyle}>
          <option value="" disabled>Choisir…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Matière (facultatif)">
        <input name="material" type="text" placeholder="Laine mélangée" style={inputStyle} />
      </Field>

      <Field label="Prix payé (facultatif)">
        <input name="price" type="text" inputMode="decimal" placeholder="49,90" style={inputStyle} />
      </Field>

      <Submit label="Ajouter au dressing" />
    </form>
  );
}

const MAX_PHOTOS = 10;
const MAX_SIDE = 1600;

type Picked = { id: string; blob: Blob; preview: string };

/**
 * Réduit la photo dans le navigateur avant l'envoi : une photo de téléphone
 * fait souvent 4 à 12 Mo, et chaque modèle de la chaîne la relit. 1600 px
 * suffisent largement pour décrire et comparer un vêtement.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // applique l'orientation EXIF
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#fff'; // un PNG transparent deviendrait noir en JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('jpeg'))), 'image/jpeg', 0.86),
  );
}

export function PhotoForm({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Picked[]>([]);
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<string | null>(null);
  const busy = progress !== null;

  // Les aperçus sont des URL d'objets : on les libère en quittant l'écran.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de rechoisir la même photo après l'avoir retirée
    setError(null);
    setCode(undefined);

    const room = MAX_PHOTOS - items.length;
    if (files.length > room) setError(`${MAX_PHOTOS} photos au plus à la fois : les suivantes n'ont pas été ajoutées.`);

    const added: Picked[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        const blob = await shrink(file);
        added.push({ id: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob) });
      } catch {
        setError(`« ${file.name} » ne se lit pas. Essaie une photo JPEG ou PNG.`);
      }
    }
    setItems((prev) => [...prev, ...added]);
  }

  function remove(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!items.length || busy) return;
    setError(null);
    setCode(undefined);

    const supabase = createBrowserClient();
    const paths: string[] = [];
    try {
      for (const [k, item] of items.entries()) {
        setProgress(`Envoi ${k + 1}/${items.length}…`);
        const path = `${spaceId}/${item.id}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('uploads')
          .upload(path, item.blob, { contentType: 'image/jpeg' });
        if (upErr) throw new Error("Une photo n'a pas pu être envoyée. Vérifie ta connexion et réessaie.");
        paths.push(path);
      }

      setProgress('Kode prend le relais…');
      const res = await requestAiGarments({ paths, hint });
      if (res?.error) {
        setCode(res.code);
        throw new Error(res.error);
      }

      items.forEach((i) => URL.revokeObjectURL(i.preview));
      router.push(`/dressing?demande=${paths.length}`);
    } catch (err) {
      // Rien n'est confié à l'agent : les photos déjà déposées ne servent plus.
      if (paths.length) await supabase.storage.from('uploads').remove(paths);
      setError(err instanceof Error ? err.message : "La demande n'est pas partie. Réessaie.");
      setProgress(null);
    }
  }

  const n = items.length;

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error ? <Problem error={error} code={code} /> : null}

      {n ? (
        <ul
          aria-label="Photos choisies"
          style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}
        >
          {items.map((item, i) => (
            <li key={item.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 16, overflow: 'hidden', background: 'var(--tile)' }}>
              <img src={item.preview} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {/* Zone de 44 px pour le doigt, pastille de 28 px pour l'œil. */}
              <button
                type="button"
                onClick={() => remove(item.id)}
                disabled={busy}
                aria-label={`Retirer la photo ${i + 1}`}
                style={{
                  position: 'absolute', top: 0, right: 0, width: 44, height: 44, padding: 0,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    width: 28, height: 28, borderRadius: 999, background: 'var(--ink)', color: 'var(--ground)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {n < MAX_PHOTOS ? (
        <label data-file-pick style={{ ...buttonQuiet, position: 'relative', alignSelf: 'flex-start', opacity: busy ? 0.6 : 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {n ? 'Ajouter des photos' : 'Choisir des photos'}
          <input type="file" accept="image/*" multiple onChange={pick} disabled={busy} />
        </label>
      ) : null}

      <Field label="Précision (facultatif)">
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={280}
          placeholder="Le pull, pas le jean"
          disabled={busy}
          style={inputStyle}
        />
      </Field>

      <p style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--muted)' }}>
        Une photo, une pièce. ChatGPT la décrit, Nano Banana la redessine seule et
        sans fond, puis Claude vérifie qu&apos;elle ressemble à la tienne à 95 % —
        jusqu&apos;à trois essais avant de ranger la meilleure dans ton dressing.
      </p>

      <button
        type="submit"
        disabled={!n || busy}
        style={{ ...buttonPrimary, opacity: !n || busy ? 0.6 : 1 }}
      >
        {progress ?? (n ? `Confier ${n} photo${n > 1 ? 's' : ''} à Kode` : 'Choisis au moins une photo')}
      </button>
    </form>
  );
}
