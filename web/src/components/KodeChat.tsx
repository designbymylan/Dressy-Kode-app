'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { askKode, planTomorrow, resetKode } from '@/app/actions';
import type { KodeMessage, KodeUsage } from '@/lib/kode';
import { OutfitCard } from '@/components/OutfitCard';
import { ErrorNote, buttonPrimary, buttonQuiet } from '@/components/ui';
import { KodeThinking } from '@/components/KodeThinking';
import { Icon } from '@/components/icons';
import { Kodi, type KodiLook, type KodiMood } from '@/components/Kodi';
import { THINKING } from '@/lib/thinking';

const SUGGESTIONS = [
  "Qu'est-ce que je mets demain ?",
  'Une tenue pour le travail',
  'Quelque chose pour ce soir',
  "Je n'ai rien à me mettre",
];

const bubble = {
  maxWidth: '84%', borderRadius: 22, padding: '12px 16px', fontSize: 15, lineHeight: 1.45, whiteSpace: 'pre-wrap',
} as const;

export function KodeChat({
  name,
  initial,
  usage: initialUsage,
  plannedTomorrow,
  pieces,
}: {
  name: string | null;
  initial: KodeMessage[];
  usage: KodeUsage;
  plannedTomorrow: string | null;
  pieces: number;
}) {
  const [messages, setMessages] = useState(initial);
  // Les réponses déjà là à l'ouverture se relisent ; seules les nouvelles tenues s'assemblent.
  const [known] = useState(() => new Set(initial.map((m) => m.id)));
  const [usage, setUsage] = useState(initialUsage);
  const [planned, setPlanned] = useState(plannedTomorrow);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const unlimited = usage.quota === null;
  const left = unlimited ? Infinity : Math.max(0, usage.quota! - usage.used);
  const tooFew = pieces < 2;
  const closed = tooFew || left === 0;

  // La tête de Kodi : il fait coucou en arrivant, écoute quand on écrit,
  // réfléchit pendant la réponse, puis réagit à ce qu'il a trouvé.
  const [react, setReact] = useState<KodiMood | null>('wave');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!react) return;
    const t = setTimeout(() => setReact(null), 2600);
    return () => clearTimeout(t);
  }, [react]);
  const mood: KodiMood = busy ? 'thinking' : error ? 'sad' : react ?? (closed ? 'sleepy' : focused || text ? 'listening' : 'idle');
  const look: KodiLook | undefined = busy ? 'up-left' : focused || text ? 'down' : undefined;

  // La dernière bulle reste visible au-dessus du champ de saisie.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: messages.length > initial.length ? 'smooth' : 'auto' });
  }, [messages.length, busy, initial.length]);

  function grow() {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy || closed) return;
    setError(null);
    setBusy(true);
    setText('');
    requestAnimationFrame(grow);

    const temp: KodeMessage = { id: `envoi-${Date.now()}`, author: 'user', body: q, outfit: null };
    setMessages((m) => [...m, temp]);

    const res = await askKode(q).catch(() => ({
      error: 'La question n’est pas partie. Vérifie ta connexion et réessaie.',
      code: null,
    }));
    if ('error' in res) {
      // La question n'est pas perdue : elle revient dans le champ.
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setText(q);
      setError(res.error);
      if (res.code === 'quota') setUsage((u) => ({ ...u, used: u.quota ?? u.used }));
    } else {
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), ...res.messages]);
      setUsage(res.usage);
      // Une tenue trouvée le ravit ; une simple réponse le rend content.
      setReact(res.messages.some((m) => m.outfit) ? 'love' : 'happy');
    }
    setBusy(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(text);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    }
  }

  async function reset() {
    if (busy) return;
    const res = await resetKode();
    if (res?.error) setError(res.error);
    else {
      setMessages([]);
      setError(null);
    }
  }

  async function plan(outfitId: string) {
    const res = await planTomorrow(outfitId);
    if ('error' in res) setError(res.error);
    else setPlanned(res.planned ? outfitId : null);
  }

  function adjust(title: string) {
    setText(`Ajuste « ${title} » : `);
    requestAnimationFrame(() => {
      grow();
      input.current?.focus();
    });
  }

  const asked = new Set(messages.filter((m) => m.author === 'user').map((m) => m.body));
  const suggestions = SUGGESTIONS.filter((s) => !asked.has(s));

  return (
    <main
      style={{
        maxWidth: 390, margin: '0 auto', minHeight: '100dvh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 44px) 20px 250px', display: 'flex', flexDirection: 'column', gap: 16,
      }}
    >
      <header style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <div
          style={{
            width: 132, height: 132, display: 'grid', placeItems: 'center', borderRadius: '50%',
            background: 'radial-gradient(circle, color-mix(in srgb, var(--butter) 55%, transparent) 0%, transparent 68%)',
          }}
        >
          <Kodi mood={mood} look={look} track={!look} size={104} enter shadow />
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <h1 style={{ fontSize: 26 }}>Kodi</h1>
          <span className="dk-tag dk-tag--butter">IA</span>
        </span>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {busy
            ? 'Kodi réfléchit…'
            : unlimited
              ? 'Ton styliste de poche · questions illimitées'
              : `${left} question${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} ce mois-ci`}
        </span>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          aria-label="Nouvelle conversation"
          className="btn btn-glass btn-icon"
          style={{ position: 'absolute', top: 0, right: 0, width: 44, height: 44, minHeight: 44 }}
        >
          <Icon name="plus" size={18} />
        </button>
      </header>

      <div role="log" aria-live="polite" aria-busy={busy} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="kodi-say" style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
          <Kodi mood="wave" size={34} decorative tap={false} />
          <p className="kodi-say__bubble">
            {name ? `Salut ${name}. ` : 'Salut. '}
            Dis-moi ce que tu as de prévu, je regarde ce que tu as déjà.
          </p>
        </div>

        {messages.map((m) =>
          m.author === 'user' ? (
            <p
              key={m.id}
              style={{
                ...bubble, alignSelf: 'flex-end', background: 'var(--blue)', color: '#000000',
                borderRadius: '22px 22px 6px 22px',
              }}
            >
              {m.body}
            </p>
          ) : (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="kodi-say" style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
                <Kodi mood={m.outfit ? 'love' : 'idle'} size={34} decorative tap={false} />
                <p className="kodi-say__bubble" style={{ whiteSpace: 'pre-wrap', animation: 'none' }}>{m.body}</p>
              </div>
              {m.outfit ? (
                <OutfitCard outfit={m.outfit} assemble={!known.has(m.id)}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => plan(m.outfit!.id)}
                      aria-pressed={planned === m.outfit.id}
                      style={{
                        ...buttonPrimary, flex: 1, minHeight: 46, fontSize: 13.5, padding: '0 10px', whiteSpace: 'nowrap',
                      }}
                    >
                      {planned === m.outfit.id ? <><Icon name="check" size={16} />Prévue pour demain</> : 'Prévoir pour demain'}
                    </button>
                    <button
                      type="button"
                      onClick={() => adjust(m.outfit!.title)}
                      disabled={closed}
                      style={{
                        ...buttonQuiet, flex: 1, minHeight: 46, fontSize: 14, fontWeight: 500, padding: '0 12px',
                        opacity: closed ? 0.5 : 1,
                      }}
                    >
                      Ajuster
                    </button>
                  </div>
                </OutfitCard>
              ) : null}
            </div>
          ),
        )}

        {busy ? (
          <div
            className="pop"
            style={{ alignSelf: 'flex-start', background: 'var(--butter)', color: 'var(--butter-ink)', borderRadius: '22px 22px 22px 6px', padding: '8px 16px 8px 10px' }}
          >
            <KodeThinking phrases={THINKING.chat} size={24} every={1800} />
          </div>
        ) : null}
        {/* Marge = hauteur du champ fixe : la dernière bulle s'arrête au-dessus. */}
        <div ref={end} style={{ scrollMarginBottom: 240 }} />
      </div>

      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, padding: '28px 16px calc(env(safe-area-inset-bottom, 0px) + 92px)', zIndex: 5,
          background: 'linear-gradient(to bottom, transparent, var(--bg) 30%)',
        }}
      >
        <div style={{ maxWidth: 350, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error ? <ErrorNote>{error}</ErrorNote> : null}

          {tooFew ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--ground)', borderRadius: 22, padding: 16 }}>
              <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                Kodi compose avec tes pièces : il lui en faut au moins deux pour proposer une tenue.
              </p>
              <Link href="/dressing/ajouter" style={{ ...buttonPrimary, minHeight: 46, fontSize: 14 }}>
                Ajouter une pièce
              </Link>
            </div>
          ) : left === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--ground)', borderRadius: 22, padding: 16 }}>
              <p style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                Tes {usage.quota} questions du mois sont utilisées. Elles reviennent le 1er du mois.
              </p>
              <Link href="/offres" style={{ ...buttonPrimary, minHeight: 46, fontSize: 14 }}>
                Kodi sans limite
              </Link>
            </div>
          ) : (
            <>
              {suggestions.length && !busy ? (
                <div data-scroll style={{ display: 'flex', gap: 7, overflowX: 'auto' }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="chip"
                      style={{ flex: 'none', minHeight: 38, padding: '0 15px', fontSize: 13 }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}

              <form
                onSubmit={submit}
                data-composer
                style={{
                  background: 'var(--ground)', borderRadius: 24, padding: '6px 6px 6px 16px',
                  display: 'flex', alignItems: 'flex-end', gap: 8, boxShadow: 'var(--shadow-soft)',
                }}
              >
                <label htmlFor="kode-question" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
                  Ta question à Kodi
                </label>
                <textarea
                  id="kode-question"
                  ref={input}
                  rows={1}
                  value={text}
                  maxLength={600}
                  onChange={(e) => {
                    setText(e.target.value);
                    grow();
                  }}
                  onKeyDown={onKey}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="Écris à Kodi…"
                  style={{
                    flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent',
                    fontSize: 16, lineHeight: 1.4, padding: '11px 0', maxHeight: 120,
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !text.trim()}
                  aria-label="Envoyer"
                  className="btn btn-primary btn-icon"
                  style={{ width: 44, height: 44, minHeight: 44 }}
                >
                  <Icon name="arrowUp" size={19} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
