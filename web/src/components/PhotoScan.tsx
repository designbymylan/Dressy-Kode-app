'use client';

import { useState, type CSSProperties } from 'react';
import type { ScanPiece } from '@/lib/jobs';
import { ICON, Icon } from '@/components/ui';

/**
 * Le scan de repérage : la photo confiée, en grand. Tant que Kodi la
 * regarde, un faisceau de lumière la balaie ; dès que les pièces sont
 * repérées, leurs cadres se tracent l'un après l'autre, chacun avec son nom.
 * Une pièce rangée passe en trait plein, avec une coche.
 */
export function PhotoScan({
  photo,
  pieces,
  scanning,
  dim,
}: {
  photo: string | null;
  pieces: ScanPiece[];
  scanning: boolean;
  dim?: boolean;
}) {
  // Proportions réelles de la photo, lues au chargement : les cadres sont
  // placés en pourcentages, ils tombent juste quelle que soit la taille.
  const [ratio, setRatio] = useState(0.75);
  const framed = pieces.filter((p) => p.box);
  const done = framed.filter((p) => p.state === 'done').length;

  const label = scanning
    ? 'Kodi regarde ta photo et repère chaque pièce'
    : framed.length
      ? `Photo avec ${framed.length} pièce${framed.length > 1 ? 's' : ''} repérée${framed.length > 1 ? 's' : ''}, ${done} rangée${done > 1 ? 's' : ''}`
      : 'Ta photo';

  return (
    <figure
      className="scan"
      role="img"
      aria-label={label}
      data-scanning={scanning || undefined}
      style={{ '--ar': ratio, opacity: dim ? 0.6 : 1 } as CSSProperties}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w && h) setRatio(w / h);
          }}
        />
      ) : null}
      <span className="scan-veil" aria-hidden="true" />
      {scanning ? <span className="scan-beam" aria-hidden="true" /> : null}

      {framed.map((p, i) => {
        const [x, y, w, h] = p.box!;
        // Un léger débord : un cadre qui frôle la pièce paraît la couper.
        const pad = 0.012;
        const left = Math.max(0, x - pad), top = Math.max(0, y - pad);
        const width = Math.min(1 - left, w + pad * 2), height = Math.min(1 - top, h + pad * 2);
        const inside = top < 0.07; // pas la place au-dessus : l'étiquette entre dans le cadre
        return (
          <span key={p.key} aria-hidden="true">
            <span
              className="scan-box"
              data-state={p.state}
              style={{
                '--i': i,
                left: `${left * 100}%`, top: `${top * 100}%`,
                width: `${width * 100}%`, height: `${height * 100}%`,
              } as CSSProperties}
            />
            <span
              className="scan-label"
              data-state={p.state}
              style={{
                '--i': i,
                left: `calc(${Math.min(left, 0.62) * 100}% + 8px)`,
                top: inside ? `calc(${top * 100}% + 18px)` : `${top * 100}%`,
              } as CSSProperties}
            >
              {p.state === 'done' ? (
                <Icon d={ICON.check} size={12} width={2.6} />
              ) : p.state === 'failed' ? (
                <b style={{ fontWeight: 700 }}>!</b>
              ) : (
                <span className="kode-orb" data-step="draw" style={{ '--orb': '11px' } as CSSProperties} />
              )}
              {p.name}
            </span>
          </span>
        );
      })}
    </figure>
  );
}
