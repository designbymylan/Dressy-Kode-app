import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { Icon, type IconName } from '@/components/icons';
import { Kodi, type KodiMood } from '@/components/Kodi';
import { Pricing } from '@/components/Pricing';
import { Segment } from '@/components/Segment';
import { TabBar } from '@/components/TabBar';
import { Cut, ProgressBar, Screen, Title } from '@/components/ui';
import { usageMood } from '@/lib/usage';

/**
 * Planche du design du 21/10, sans compte ni base : palette et contrastes,
 * boutons de verre, sélection en bleu, icônes pleines (survoler pour voir
 * leur geste), humeurs de Kodi, barre de progression dans la section
 * découpée, tarifs et barre de navigation. Fermée par défaut : elle ne
 * s'ouvre qu'avec DRESSY_APERCU=1 dans l'environnement du serveur.
 */
export const dynamic = 'force-dynamic';

const SWATCHES = [
  { name: 'Blue', hex: '#C4DAE8', ink: '#000000', note: 'choisi, action principale · 14,5:1' },
  { name: 'Blue profond', hex: '#2B5F86', ink: '#FFFFFF', note: 'icône ou texte choisi · 6,8:1 sur blanc' },
  { name: 'Butter', hex: '#FEEFB8', ink: '#000000', note: 'bandeaux de Kodi, étiquettes · 18:1' },
  { name: 'Chocopie', hex: '#432F2E', ink: '#FFFFFF', note: 'rond de Kodi, points forts · 12,5:1' },
];

const MOODS: KodiMood[] = ['idle', 'wave', 'happy', 'love', 'thinking', 'listening', 'surprised', 'wink', 'sleepy', 'sad', 'shy', 'celebrate', 'talking'];

const ICONS: IconName[] = [
  'home', 'hanger', 'calendar', 'user', 'search', 'sliders', 'bell', 'plus', 'camera', 'image', 'sparkle', 'heart',
  'bookmark', 'tag', 'shirt', 'pants', 'dress', 'jacket', 'sneaker', 'bag', 'gem', 'belt', 'cloud', 'sun', 'moon',
  'suitcase', 'crown', 'chart', 'palette', 'party', 'layers', 'trash', 'refresh', 'pencil', 'lock', 'send', 'chat',
  'check', 'close', 'chevronRight', 'shuffle', 'infinity',
];

export default async function Apercu({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  if (process.env.DRESSY_APERCU !== '1') notFound();
  const { onglet = '/dressing' } = await searchParams;
  const usage = { total: 29, worn: 18, pct: 62 };
  const kodi = usageMood(usage);
  const categories = [
    { label: 'Hauts', worn: 7, total: 9 }, { label: 'Bas', worn: 5, total: 6 },
    { label: 'Robes', worn: 1, total: 4 }, { label: 'Chaussures', worn: 2, total: 5 },
  ];

  return (
    <>
      <Screen>
        <Title sub="La planche du 21/10, sur les composants de l'app.">Aperçu du design</Title>

        <section className="glass card">
          <h2 className="section-title">Palette</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {SWATCHES.map((s) => (
              <div key={s.name} style={{ borderRadius: 20, background: s.hex, color: s.ink, padding: 14, minHeight: 92, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <strong style={{ fontWeight: 600 }}>{s.name}</strong>
                <span style={{ fontSize: 12 }}>{s.hex} · {s.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass card">
          <h2 className="section-title">Boutons et sélection</h2>
          <button type="button" className="btn btn-primary btn-block">Continuer <Icon name="chevronRight" size={18} /></button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-glass" style={{ flex: 1 }}>Annuler</button>
            <button type="button" className="btn btn-dark" style={{ flex: 1 }}><Icon name="sparkle" size={18} /> Kodi</button>
          </div>
          <div className="scroll-x">
            <button type="button" className="chip" aria-pressed="true">Tout</button>
            <button type="button" className="chip">Hauts</button>
            <button type="button" className="chip">Bas</button>
            <button type="button" className="chip">Chaussures</button>
          </div>
          <Segment label="Période" value="semaine" options={[{ value: 'jour', label: 'Aujourd’hui' }, { value: 'semaine', label: 'Semaine' }]} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" role="switch" aria-checked="true" className="dk-switch" aria-label="Exemple ouvert" />
            <button type="button" role="switch" aria-checked="false" className="dk-switch" aria-label="Exemple fermé" />
            <span className="dk-tag dk-tag--butter">Nouveau</span>
            <span className="dk-tag dk-tag--blue">Choisi</span>
          </div>
        </section>

        <section className="glass card">
          <h2 className="section-title">Icônes pleines</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {ICONS.map((n) => (
              <button key={n} type="button" title={n} aria-label={n} className="btn btn-glass btn-icon" style={{ width: '100%', height: 48 }}>
                <Icon name={n} size={22} />
              </button>
            ))}
          </div>
        </section>

        <section className="glass card">
          <h2 className="section-title">Kodi</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {MOODS.map((m) => (
              <figure key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Kodi mood={m} size={84} track shadow />
                <figcaption className="small muted">{m}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <Cut close label="Garde-robe exploitée">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="eyebrow">Garde-robe exploitée</span>
              <p className="stat" style={{ fontSize: 26, lineHeight: 1.1 }}>{usage.worn} sur {usage.total} pièces</p>
              <span className="small muted">portées ces 90 derniers jours</span>
            </div>
            <Kodi mood={kodi.mood} size={66} track />
          </div>
          <ProgressBar value={usage.pct} label="Part de ta garde-robe portée" />
          <p className="small" style={{ color: 'var(--on-panel-muted)' }}>{kodi.line}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px' }}>
            {categories.map((c) => (
              <div key={c.label} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span>{c.label}</span>
                  <span style={{ color: 'var(--on-panel-muted)', fontWeight: 500 }}>{c.worn}/{c.total}</span>
                </span>
                <ProgressBar value={(c.worn / c.total) * 100} size="sm" label={c.label} />
              </div>
            ))}
          </div>
        </Cut>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 } as CSSProperties}>
          <h2 className="section-title">Tarifs</h2>
          <Pricing current={null} trial />
        </section>
      </Screen>
      <TabBar active={onglet} />
    </>
  );
}
