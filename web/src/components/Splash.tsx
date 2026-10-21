'use client';

import { useEffect, useState } from 'react';
import { Kodi, type KodiMood } from '@/components/Kodi';
import { ProgressBar } from '@/components/ui';

/**
 * Écran de lancement : Kodi arrive en rebond, déroule son auvent et fait
 * coucou, pendant que la barre se remplit. Joué une fois par session de
 * navigation (cookie de session `dk_splash`, lu par le serveur).
 *
 * Le fondu de sortie est en CSS : si le JavaScript tarde, l'écran
 * s'efface quand même. Un toucher le passe.
 */
export function Splash() {
  const [mood, setMood] = useState<KodiMood>('idle');
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    document.cookie = 'dk_splash=1; path=/; SameSite=Lax';
    const wave = window.setTimeout(() => setMood('wave'), 900);
    const end = window.setTimeout(() => setGone(true), 2800);
    return () => {
      window.clearTimeout(wave);
      window.clearTimeout(end);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={`dk-splash${leaving ? ' is-leaving' : ''}`}
      aria-hidden="true"
      onClick={() => {
        setLeaving(true);
        window.setTimeout(() => setGone(true), 380);
      }}
    >
      <Kodi size={132} mood={mood} enter shadow tap={false} decorative />
      <span className="dk-splash__word">Dressy</span>
      <div className="dk-splash__bar">
        <ProgressBar value={100} size="sm" label="Chargement" />
      </div>
    </div>
  );
}
