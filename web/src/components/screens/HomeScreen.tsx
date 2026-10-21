import Link from 'next/link';
import type { ReactNode } from 'react';
import { HeroCarousel } from '@/components/HeroCarousel';
import { Icon, type IconName } from '@/components/icons';
import { Kodi, type KodiMood } from '@/components/Kodi';
import { PieceCard, type PieceView } from '@/components/PieceCard';
import { IconLink, ProgressBar, Screen, SearchBar, SectionHead, btn } from '@/components/ui';
import { PLAN_LABEL, type PlanId } from '@/lib/plans';

export type HomeData = {
  name: string | null;
  avatarUrl: string | null;
  hour: number;
  total: number;
  worn: number;
  pct: number;
  asleep: number;
  recent: PieceView[];
  plan: PlanId;
};

/** Ce que Kodi dit en ouvrant l'application, selon l'heure et le dressing. */
function greeting(d: HomeData): { mood: KodiMood; title: string; text: string } {
  if (!d.total) {
    return { mood: 'wave', title: 'On commence ?', text: 'Ajoute ta première pièce : je m’occupe de la détourer et de la ranger.' };
  }
  if (d.total < 3) {
    return { mood: 'wink', title: 'Encore une ou deux', text: 'Avec un haut et un bas de plus, je compose ta première tenue.' };
  }
  if (d.hour >= 22 || d.hour < 6) {
    return { mood: 'sleepy', title: 'Tenue de demain', text: 'Je la prépare ce soir, tu n’auras plus qu’à t’habiller.' };
  }
  return { mood: 'happy', title: 'Tenue du jour', text: `Je compose avec tes ${d.total} pièces, en commençant par celles qui dorment.` };
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  const letter = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return url ? (
    <img src={url} alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: 999, objectFit: 'cover', flex: 'none' }} />
  ) : (
    <span
      aria-hidden="true"
      style={{
        width: 48, height: 48, flex: 'none', borderRadius: 999, background: 'var(--butter)', color: '#432F2E',
        display: 'grid', placeItems: 'center', fontSize: 19, fontWeight: 700,
      }}
    >
      {letter}
    </span>
  );
}

function Slide({ children }: { children: ReactNode }) {
  return <div className="dk-hero" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>;
}

function Quick({ href, icon, label, badge }: { href: string; icon: IconName; label: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="dk-tap"
      style={{
        position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10, padding: '16px 6px 14px', borderRadius: 20, background: 'var(--surface)',
        border: '1px solid var(--line)', boxShadow: 'var(--shadow-1)',
      }}
    >
      {badge ? (
        <span className="dk-tag dk-tag--butter" style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, padding: '2px 6px' }}>
          {badge}
        </span>
      ) : null}
      <span className="dk-bubble-ico dk-bubble-ico--tile">
        <Icon name={icon} size={20} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'center', lineHeight: 1.25 }}>{label}</span>
    </Link>
  );
}

export function HomeScreen({ data }: { data: HomeData }) {
  const g = greeting(data);
  const pct = Math.round(data.pct);

  const slides: ReactNode[] = [
    <Slide key="kodi">
      <h2 className="dk-h2" style={{ color: '#FFFFFF', fontSize: 21, maxWidth: '62%' }}>{g.title}</h2>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,.78)', maxWidth: '60%' }}>{g.text}</p>
      <Link href={data.total < 3 ? '/dressing/ajouter' : '/kodi'} className={`${btn.butter} dk-btn--sm`} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        {data.total < 3 ? 'Ajouter une pièce' : 'Demander à Kodi'}
        <Icon name={data.total < 3 ? 'plus' : 'sparkle'} size={16} />
      </Link>
      <span style={{ position: 'absolute', right: 6, bottom: -4 }}>
        <Kodi mood={g.mood} size={118} track />
      </span>
    </Slide>,
  ];

  if (data.asleep > 0) {
    slides.push(
      <Slide key="dort">
        <span className="dk-tag dk-tag--butter" style={{ alignSelf: 'flex-start' }}>À réveiller</span>
        <h2 className="dk-h2" style={{ color: '#FFFFFF', fontSize: 21 }}>
          {data.asleep} pièce{data.asleep > 1 ? 's' : ''} dor{data.asleep > 1 ? 'ment' : 't'} au fond
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,.78)', maxWidth: '78%' }}>
          Pas portée{data.asleep > 1 ? 's' : ''} depuis trois mois. Kodi les remet en jeu.
        </p>
        <Link href="/kodi?q=oubliees" className={`${btn.butter} dk-btn--sm`} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          Les voir <Icon name="chevronRight" size={16} />
        </Link>
      </Slide>,
    );
  }

  if (data.plan !== 'sapologue') {
    slides.push(
      <Slide key="offre">
        <span className="dk-tag dk-tag--blue" style={{ alignSelf: 'flex-start' }}>
          <Icon name="crown" size={12} /> {data.plan === 'fashion' ? 'Sapologue' : 'Fashion'}
        </span>
        <h2 className="dk-h2" style={{ color: '#FFFFFF', fontSize: 21 }}>
          {data.plan === 'fashion' ? 'Kodi en styliste perso' : 'Ton dressing, sans compter'}
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,.78)', maxWidth: '78%' }}>
          {data.plan === 'fashion' ? 'Audit, couleurs, occasions : Kodi va plus loin.' : '150 pièces, Kodi tous les jours, ton suivi d’usage.'}
        </p>
        <Link href="/moi#offres" className={`${btn.butter} dk-btn--sm`} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          Voir les offres <Icon name="chevronRight" size={16} />
        </Link>
      </Slide>,
    );
  }

  return (
    <Screen>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={data.name} url={data.avatarUrl} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {data.name ? `Salut, ${data.name}` : 'Salut'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>On porte quoi aujourd’hui ?</p>
        </div>
        <IconLink href="/dressing/ajouter" icon="camera" label="Ajouter une pièce en photo" />
        <IconLink href="/kodi" icon="chat" label="Parler à Kodi" />
      </header>

      <SearchBar />

      <HeroCarousel label="À la une" slides={slides} />

      <nav aria-label="Raccourcis" style={{ display: 'flex', gap: 10 }}>
        <Quick href="/dressing/ajouter" icon="camera" label="Ajouter une pièce" />
        <Quick href="/kodi" icon="sparkle" label="Tenue du jour" badge="IA" />
        <Quick href="/calendrier" icon="calendar" label="Planifier" />
      </nav>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHead title="Ton dressing" href="/dressing" />
        <div className="dk-card" style={{ gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span className="dk-label">Garde-robe exploitée</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>90 derniers jours</span>
          </div>
          <ProgressBar value={pct} label="Part de ta garde-robe portée ces 90 derniers jours" />
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {data.total
              ? `${data.worn} pièce${data.worn > 1 ? 's' : ''} portée${data.worn > 1 ? 's' : ''} sur ${data.total}.`
              : 'Ajoute tes pièces pour voir ce que tu portes vraiment.'}
          </p>
        </div>
      </section>

      {data.recent.length ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHead title="Ajoutées récemment" href="/dressing" />
          <div className="dk-rail">
            {data.recent.map((p) => (
              <PieceCard key={p.id} piece={p} width={140} />
            ))}
          </div>
        </section>
      ) : null}

      <p style={{ fontSize: 12, color: 'var(--subtle)', textAlign: 'center' }}>
        Offre {PLAN_LABEL[data.plan]}
      </p>
    </Screen>
  );
}
