'use client';

import { useActionState, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addGarment, requestAiGarments, type FormResult } from '@/app/actions';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/wardrobe';
import { COLOURS } from '@/lib/onboarding';
import { Field, ErrorNote, Icon, ICON } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { KodeThinking } from '@/components/KodeThinking';
import { THINKING } from '@/lib/thinking';

/** Le message d'erreur, et le chemin vers les offres quand le dressing est plein. */
function Problem({ error, code }: { error: string; code?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ErrorNote>{error}</ErrorNote>
      {code === 'pieces' ? (
        <Link href="/offres" className="btn btn-glass btn-sm" style={{ alignSelf: 'center' }}>
          Voir les offres
        </Link>
      ) : null}
    </div>
  );
}


/* ---------------------------------------------------------------- saisie */

export function ManualForm() {
  const [state, action] = useActionState<FormResult, FormData>(addGarment, undefined);
  const [category, setCategory] = useState<string>('');
  const [kind, setKind] = useState<string>('');
  const [colour, setColour] = useState<string>('');
  const meta = CATEGORIES.find((c) => c.id === category);

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {state?.error ? <Problem error={state.error} code={state.code} /> : null}
      <input type="hidden" name="category_id" value={category} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="colour" value={colour} />

      <Field label="La pièce">
        <input name="name" type="text" required placeholder="Collier doré, blazer noir…" className="input" />
      </Field>

      <div className="field">
        <span id="cat-label">Catégorie</span>
        <div role="radiogroup" aria-labelledby="cat-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              className="chip"
              onClick={() => { setCategory(c.id); setKind(''); }}
            >
              <Icon d={c.icon} size={16} width={1.6} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {meta ? (
        <div className="field pop" key={meta.id}>
          <span id="kind-label">Type</span>
          <div role="radiogroup" aria-labelledby="kind-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {meta.kinds.map((k, i) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                className="chip pop"
                style={{ '--i': i } as CSSProperties}
                onClick={() => setKind(kind === k.id ? '' : k.id)}
              >
                {k.icon ? <Icon d={k.icon} size={16} width={1.6} /> : null}
                {k.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <span id="colour-label">Couleur principale</span>
        <div role="radiogroup" aria-labelledby="colour-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {COLOURS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={colour === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColour(colour === c.id ? '' : c.id)}
              style={{
                width: 34, height: 34, borderRadius: 0, background: c.hex, cursor: 'pointer',
                border: '1px solid rgba(0,0,0,.08)',
                outline: colour === c.id ? '2px solid var(--ink)' : '2px solid transparent', outlineOffset: 3,
                transform: colour === c.id ? 'scale(1.08)' : 'none',
                transition: 'transform 300ms cubic-bezier(.34,1.56,.64,1), outline-color 200ms',
              }}
            />
          ))}
        </div>
      </div>

      <Field label="Matière (facultatif)">
        <input name="material" type="text" placeholder="Laine, argent 925…" className="input" />
      </Field>

      <Field label="Prix payé (facultatif)">
        <input name="price" type="text" inputMode="decimal" placeholder="49,90" className="input" />
      </Field>

      <SubmitButton label="Ranger dans mon dressing" pending="Kode range ta pièce" />
    </form>
  );
}

/* ---------------------------------------------------------------- photos */

const MAX_PHOTOS = 10;
const MAX_SIDE = 1600;

type Picked = { id: string; blob: Blob; preview: string };

/**
 * Réduit la photo dans le navigateur avant l'envoi : une photo de téléphone
 * fait souvent 4 à 12 Mo, et chaque modèle de la chaîne la relit. 1600 px
 * suffisent largement pour décrire et comparer un vêtement ou un bijou.
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
  const [over, setOver] = useState(false);
  const busy = progress !== null;

  // Les aperçus sont des URL d'objets : on les libère en quittant l'écran.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  async function addFiles(files: File[]) {
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

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de rechoisir la même photo après l'avoir retirée
    await addFiles(files);
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
    const paths = items.map((item) => `${spaceId}/${item.id}.jpg`);
    try {
      // Toutes les photos partent en même temps : l'attente ne s'allonge pas avec leur nombre.
      setProgress(items.length > 1 ? `Envoi de ${items.length} photos` : 'Envoi de ta photo');
      const sent = await Promise.all(items.map((item, k) =>
        supabase.storage.from('uploads').upload(paths[k], item.blob, { contentType: 'image/jpeg' }),
      ));
      if (sent.some((r) => r.error)) throw new Error("Une photo n'a pas pu être envoyée. Vérifie ta connexion et réessaie.");

      setProgress('Kode prend le relais');
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
        <ul aria-label="Photos choisies" style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {items.map((item, i) => (
            <li
              key={item.id}
              className="pop"
              style={{ '--i': i, position: 'relative', aspectRatio: '1', borderRadius: 0, overflow: 'hidden', background: 'var(--tile)' } as CSSProperties}
            >
              <img src={item.preview} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {busy ? <span className="shimmer" style={{ position: 'absolute', inset: 0 }} aria-hidden="true" /> : null}
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
                <span style={{ width: 28, height: 28, borderRadius: 0, background: 'var(--glass-strong)', color: 'var(--ink)', display: 'grid', placeItems: 'center' }}>
                  <Icon d={ICON.close} size={13} width={2.2} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {n < MAX_PHOTOS ? (
        <label
          data-file-pick
          className="btn btn-glass"
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))); }}
          style={{ position: 'relative', alignSelf: 'center', opacity: busy ? 0.6 : 1, transform: over ? 'scale(1.05)' : undefined }}
        >
          <Icon d={ICON.camera} size={18} width={1.6} />
          {n ? 'Ajouter des photos' : 'Choisir des photos'}
          <input type="file" accept="image/*" multiple onChange={pick} disabled={busy} />
        </label>
      ) : null}

      <Field label="Seulement certaines pièces ? (facultatif)">
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={280}
          placeholder="Seulement la veste et le jean"
          disabled={busy}
          className="input"
        />
      </Field>

      <p className="small muted center" style={{ paddingInline: 6 }}>
        Kode repère chaque pièce de ta photo, vêtements, chaussures, sacs et bijoux compris, puis les
        redessine une par une, sans fond, et les range sur tes portants. Tu n’en veux que certaines ?
        Dis-le juste au-dessus.
      </p>

      {busy ? <KodeThinking phrases={[progress ?? THINKING.send[0], ...THINKING.send]} center /> : null}

      <button type="submit" disabled={!n || busy} aria-busy={busy || undefined} className="btn btn-primary btn-block">
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        {progress ?? (n ? `Confier ${n} photo${n > 1 ? 's' : ''} à Kode` : 'Choisis au moins une photo')}
      </button>
    </form>
  );
}
