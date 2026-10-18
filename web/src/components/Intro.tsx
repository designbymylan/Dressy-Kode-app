'use client';

import { useEffect, useState } from 'react';
import { K } from '@/components/Logo';

const SEEN = 'dk-intro';
const LENGTH = 2900;

/**
 * Le script posé dans <head> : si l'intro a déjà été vue dans cet onglet,
 * <html> reçoit `intro-vu` avant le premier affichage, et le rideau ne se
 * montre pas, même un instant.
 */
export const INTRO_SCRIPT = `try{if(sessionStorage.getItem('${SEEN}')==='1')document.documentElement.classList.add('intro-vu')}catch(e){}`;

/**
 * L'intro (13/10), une fois par visite : le K se coud trait par trait,
 * l'étincelle de Kode s'allume, une couture se pique, DRESSKODE se resserre,
 * puis la caméra plonge dans le K et l'app apparaît derrière. Noir sur blanc
 * en clair, blanc sur noir en sombre. Un toucher ou Échap la passe ;
 * « Réduire les animations » la réduit à un fondu (`globals.css`, `.intro`).
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
        <svg className="intro-mark" viewBox="0 0 100 100" width="128" height="128">
          <defs>
            <clipPath id="intro-clip">
              <rect x="0" y="14" width="100" height="72" />
            </clipPath>
          </defs>
          <g clipPath="url(#intro-clip)" fill="none" stroke="currentColor" strokeWidth="6.5">
            <path className="intro-stroke intro-stem" d="M30 86V14" />
            <path className="intro-stroke intro-up" d="M30 61L61 30" />
            <path className="intro-stroke intro-lo" d="M44 47L82.3 92" />
          </g>
          <circle className="intro-glint" cx="71" cy="17" r="14" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <path className="intro-spark" d={K.spark} fill="currentColor" />
        </svg>
        <i className="intro-seam" />
        <span className="brand intro-word">Dresskode</span>
      </div>
    </div>
  );
}
