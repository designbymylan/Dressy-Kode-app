import { Kodi } from '@/components/Kodi';
import { ProgressBar } from '@/components/ui';

/** Pendant qu'un écran charge ses données, Kodi range. */
export default function Loading() {
  return (
    <main
      className="dk-screen"
      aria-busy="true"
      style={{ alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}
    >
      <Kodi mood="thinking" size={96} shadow decorative tap={false} />
      <p style={{ fontSize: 14, color: 'var(--muted)' }}>Kodi range ton dressing…</p>
      <div style={{ width: 160 }}>
        <ProgressBar value={0} busy size="sm" label="Chargement" />
      </div>
    </main>
  );
}
