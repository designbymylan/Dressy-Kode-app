'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ICON, Icon } from '@/components/ui';

export type Reveal = {
  /** L'image générée, avec son fond uni. */
  raw: string;
  /** La pièce détourée, fond transparent. */
  cut: string;
  /** Taille de l'image générée, en pixels. */
  size: [number, number];
  /** Où la pièce détourée a été découpée dans l'image générée : [x, y, largeur, hauteur]. */
  box: [number, number, number, number];
};

/**
 * Le détourage révélé : la pièce apparaît d'abord avec le fond du dessin,
 * puis une ligne de lumière descend et l'efface, ne laissant que la pièce
 * posée sur le verre. Les deux images sont superposées au pixel près grâce
 * au cadre de découpe gardé par l'agent.
 *
 * `onDone` part une fois l'effet joué, ou tout de suite si une image ne se
 * charge pas : rien ne doit rester bloqué sur une animation.
 */
export function RevealCutout({ reveal, size, name, onDone }: { reveal: Reveal; size: number; name: string; onDone: () => void }) {
  const [ready, setReady] = useState(false);
  const finished = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;

  const end = () => {
    if (finished.current) return;
    finished.current = true;
    finish.current();
  };

  // Les deux images d'abord en mémoire : un effet qui démarre sur une image
  // à moitié chargée ne révèle rien.
  useEffect(() => {
    let alive = true;
    const load = (src: string) => new Promise<void>((ok, ko) => {
      const img = new Image();
      img.onload = () => ok();
      img.onerror = () => ko();
      img.src = src;
    });
    Promise.all([load(reveal.raw), load(reveal.cut)])
      .then(() => alive && setReady(true))
      .catch(() => end());
    // Filet : quoi qu'il arrive, la suite n'attend pas plus de huit secondes.
    const guard = setTimeout(end, 8000);
    return () => { alive = false; clearTimeout(guard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal.raw, reveal.cut]);

  const [W, H] = reveal.size;
  const [x, y, w, h] = reveal.box;
  // Le cadre garde les proportions de la pièce découpée, centré dans le carré.
  const fw = w >= h ? size : Math.round((size * w) / h);
  const fh = w >= h ? Math.round((size * h) / w) : size;

  return (
    <div
      className={`reveal${ready ? ' play' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name}, détourée et rangée sur ton portant`}
    >
      <div className="reveal-frame" style={{ width: fw, height: fh }}>
        <img className="reveal-cut" src={reveal.cut} alt="" />
        <div
          className="reveal-raw"
          onAnimationEnd={() => setTimeout(end, 900)}
        >
          <span
            style={{
              backgroundImage: `url("${reveal.raw}")`,
              width: `${(W / w) * 100}%`,
              height: `${(H / h) * 100}%`,
              left: `${(-x / w) * 100}%`,
              top: `${(-y / h) * 100}%`,
            } as CSSProperties}
          />
        </div>
        <span className="reveal-beam" aria-hidden="true" />
      </div>
      <span className="reveal-tag" aria-hidden="true">
        <Icon d={ICON.check} size={11} width={2.6} />
        Sans fond
      </span>
    </div>
  );
}
