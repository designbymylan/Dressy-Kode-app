'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { askKodi, type KodiAnswer } from '@/app/actions';
import { Icon } from '@/components/icons';
import { Kodi, type KodiLook, type KodiMood } from '@/components/Kodi';
import { Screen, btn } from '@/components/ui';

export type KodiData = {
  name: string | null;
  total: number;
  pct: number;
  styles: string[];
  /** Question posée d'emblée, depuis une bannière de l'accueil. */
  ask?: string | null;
};

type Message = { id: number; from: 'me' | 'kodi'; text: string; answer?: KodiAnswer };

const SUGGESTIONS = [
  { icon: 'sparkle', text: 'Une tenue pour demain' },
  { icon: 'history', text: 'Mes pièces oubliées' },
  { icon: 'chart', text: 'Le bilan de mon dressing' },
  { icon: 'camera', text: 'Comment ajouter une pièce ?' },
] as const;

/**
 * La conversation avec Kodi. Il écoute quand on écrit (tête penchée, yeux
 * vers le champ), réfléchit pendant la réponse, puis réagit à ce qu'il
 * a trouvé : ravi pour une tenue, ensommeillé devant les pièces oubliées.
 */
export function KodiScreen({ data }: { data: KodiData }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<KodiMood>('wave');
  const [look, setLook] = useState<KodiLook | undefined>(undefined);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setMood('idle'), 2200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setMessages((m) => [...m, { id: ++seq.current, from: 'me', text: q }]);
    setText('');
    setMood('thinking');
    setLook('up-left');
    start(async () => {
      try {
        const answer = await askKodi(q);
        setMessages((m) => [...m, { id: ++seq.current, from: 'kodi', text: answer.text, answer }]);
        setMood(answer.mood);
      } catch {
        setMessages((m) => [...m, { id: ++seq.current, from: 'kodi', text: 'Je n’ai pas pu te répondre. Vérifie ta connexion et redemande-moi.' }]);
        setMood('sad');
      } finally {
        setLook(undefined);
        window.setTimeout(() => setMood('idle'), 2600);
      }
    });
  }

  useEffect(() => {
    if (data.ask && !asked.current) {
      asked.current = true;
      send(data.ask);
    }
    // send ne change pas d'identité utile ici : une seule question d'emblée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.ask]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <Screen style={{ ['--screen-pb' as string]: 'calc(196px + env(safe-area-inset-bottom))' }}>
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', paddingTop: 4 }}>
        <div
          style={{
            position: 'relative', width: 156, height: 156, display: 'grid', placeItems: 'center', borderRadius: 999,
            background: 'radial-gradient(circle, var(--butter-soft) 0%, transparent 68%)',
          }}
        >
          <Kodi mood={mood} size={132} track={!look} look={look} enter shadow />
        </div>
        <h1 className="dk-h1">Kodi</h1>
        <p style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--blue-ink)' }} />
          {pending ? 'Kodi réfléchit…' : 'Ton styliste de poche, avec ce que tu as déjà'}
        </p>
      </header>

      <section className="dk-card" style={{ gap: 10 }} aria-label="Ce que Kodi sait déjà">
        <span className="dk-label">Ce que je sais déjà</span>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <li style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="hanger" size={18} style={{ color: 'var(--subtle)' }} />
            {data.total} pièce{data.total > 1 ? 's' : ''} dans ton dressing
          </li>
          <li style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="chart" size={18} style={{ color: 'var(--subtle)' }} />
            {Math.round(data.pct)} % portées ces 90 derniers jours
          </li>
          {data.styles.length ? (
            <li style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name="star" size={18} style={{ color: 'var(--subtle)' }} />
              Style {data.styles.join(', ').toLowerCase()}
            </li>
          ) : null}
        </ul>
      </section>

      {!messages.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-label="Pour commencer">
          <span className="dk-label">Pour commencer</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s.text} type="button" className="dk-chip dk-tap" onClick={() => send(s.text)}>
                <Icon name={s.icon} size={16} />
                {s.text}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div role="log" aria-live="polite" aria-label="Conversation avec Kodi" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m) =>
          m.from === 'me' ? (
            <p
              key={m.id}
              className="dk-enter"
              style={{
                alignSelf: 'flex-end', maxWidth: '82%', padding: '11px 15px', borderRadius: '20px 20px 6px 20px',
                background: 'var(--blue)', color: '#000', fontSize: 14.5, lineHeight: 1.45,
              }}
            >
              {m.text}
            </p>
          ) : (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '92%' }}>
              <div className="kodi-say">
                <Kodi mood={m.answer?.mood ?? 'idle'} size={36} decorative tap={false} />
                <p className="kodi-say__bubble">{m.text}</p>
              </div>
              {m.answer?.pieces?.length ? (
                <div className="dk-rail" style={{ marginInline: 0, paddingInline: '46px 0' }}>
                  {m.answer.pieces.map((p) => (
                    <figure key={p.id} style={{ flex: 'none', width: 96, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="dk-piece__pic" style={{ padding: 8, borderRadius: 18 }}>
                        {p.url ? <img src={p.url} alt="" /> : <Icon name="shirt" size={34} style={{ color: 'var(--subtle)' }} />}
                      </div>
                      <figcaption style={{ fontSize: 12, lineHeight: 1.3 }}>{p.name}</figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
              {m.answer?.link ? (
                <Link href={m.answer.link.href} className={`${btn.glass} dk-btn--sm`} style={{ alignSelf: 'flex-start', marginLeft: 46 }}>
                  {m.answer.link.label} <Icon name="chevronRight" size={15} />
                </Link>
              ) : null}
            </div>
          ),
        )}
        {pending ? (
          <div className="kodi-say" aria-hidden="true">
            <Kodi mood="thinking" size={36} decorative tap={false} />
            <p className="kodi-say__bubble" style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="kodi__dot" style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--muted)', display: 'inline-block', animationDelay: `${i * 150}ms` }} />
              ))}
            </p>
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <form
        onSubmit={submit}
        style={{
          position: 'fixed', left: 12, right: 12, bottom: 'calc(102px + env(safe-area-inset-bottom))',
          maxWidth: 406, margin: '0 auto', zIndex: 30, display: 'flex', gap: 8, alignItems: 'center',
          padding: 6, borderRadius: 999, border: '1px solid var(--glass-edge)', background: 'var(--glass)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)', backdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: 'inset 0 1px 0 var(--glass-hi), var(--shadow-2)',
        }}
      >
        <label style={{ flex: 1, minWidth: 0 }}>
          <span className="dk-sr">Ta question à Kodi</span>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!pending) {
                setMood('listening');
                setLook('down');
              }
            }}
            onFocus={() => {
              if (!pending) setMood('listening');
            }}
            onBlur={() => {
              if (!pending) {
                setMood('idle');
                setLook(undefined);
              }
            }}
            placeholder="Demande une tenue, un conseil…"
            maxLength={400}
            style={{ width: '100%', minHeight: 44, padding: '0 14px', border: 'none', background: 'transparent', outline: 'none', fontSize: 15 }}
          />
        </label>
        <button
          type="submit"
          className={`${btn.choco} dk-btn--icon`}
          aria-label="Envoyer"
          disabled={!text.trim() || pending}
        >
          <Icon name="arrowUp" size={20} />
        </button>
      </form>
    </Screen>
  );
}
