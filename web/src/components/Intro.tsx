'use client';

import { useEffect, useState } from 'react';
import { ORBE } from '@/components/Logo';

const SEEN = 'dk-intro';
const LENGTH = 2900;

/**
 * Le script posé dans <head> : si l'intro a déjà été vue dans cet onglet,
 * <html> reçoit `intro-vu` avant le premier affichage, et le rideau ne se
 * montre pas, même un instant.
 */
export const INTRO_SCRIPT = `try{if(sessionStorage.getItem('${SEEN}')==='1')document.documentElement.classList.add('intro-vu')}catch(e){}`;

/**
 * L'intro (25/10), une fois par visite : l'orbe apparaît et se met à tourner
 * (son reflet fait le tour de la sphère), DRESSKODE se resserre dessous, puis
 * la caméra plonge dans l'orbe et l'app apparaît derrière. Noir sur blanc
 * en clair, blanc sur noir en sombre (le fond suit le thème). Un toucher ou
 * Échap la passe ; « Réduire les animations » la réduit à un fondu
 * (`globals.css`, `.intro`).
 */
export function Intro() {
  const [state, setState] = useState<'on' | 'leaving' | 'gone'>('on');

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === '1';
      sessionStorage.setItem(SEEN, '1');
    } catch {}
    if (seen) {
      setState('gone');
      return;
    }
    const end = setTimeout(() => setState('gone'), LENGTH);
    const skip = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setState('leaving');
    };
    window.addEventListener('keydown', skip);
    return () => {
      clearTimeout(end);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  useEffect(() => {
    if (state !== 'leaving') return;
    const t = setTimeout(() => setState('gone'), 250);
    return () => clearTimeout(t);
  }, [state]);

  if (state === 'gone') return null;

  return (
    <div className={state === 'leaving' ? 'intro intro-leaving' : 'intro'} aria-hidden="true" onClick={() => setState('leaving')}>
      <div className="intro-stage">
        <div className="intro-dive">
        <svg className="intro-orb" viewBox="0 0 100 100" width="128" height="128">
          <defs>
            <radialGradient id="intro-orbe" cx="32%" cy="28%" r="85%">
              <stop offset="0%" stopColor={ORBE.from} />
              <stop offset="100%" stopColor={ORBE.to} />
            </radialGradient>
            <clipPath id="intro-disc">
              <circle cx="50" cy="50" r="50" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#intro-orbe)" />
          <g clipPath="url(#intro-disc)">
            <ellipse className="intro-glint" cx={ORBE.glint.cx} cy={ORBE.glint.cy} rx={ORBE.glint.rx} ry={ORBE.glint.ry} fill="#ffffff" fillOpacity={0.7} />
          </g>
        </svg>
        </div>
        <span className="brand intro-word">Dresskode</span>
      </div>
    </div>
  );
}
