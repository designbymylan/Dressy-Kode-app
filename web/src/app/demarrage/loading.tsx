import { KodeThinking } from '@/components/KodeThinking';

export default function Loading() {
  return (
    <main className="screen" aria-busy="true" style={{ justifyContent: 'center', minHeight: '80dvh' }}>
      <KodeThinking phrases={['Kodi prépare tes questions', 'Kodi s’installe']} size={40} center />
    </main>
  );
}
