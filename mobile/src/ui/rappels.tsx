/**
 * La question des notifications (07/10), posée en contexte et jamais en
 * fenêtre surgissante : trois réponses, comme la personne les a formulées
 * (« oui », « seulement le planning », « non »). La fenêtre de l'iPhone ne
 * s'ouvre qu'après un « oui », sur ce geste.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useStore, type NotifChoice } from '../state/store';
import { autoriser } from '../state/notifications';
import { useTheme } from '../theme/ThemeProvider';
import { ChoiceCard } from './onboarding';
import { Icon, type IconName } from './Icon';

export const NOTIF_OPTIONS: { id: NotifChoice; title: string; note: string; icon: IconName }[] = [
  { id: 'tout', title: 'Oui, préviens-moi', note: 'La veille de tes rendez-vous et de tes tenues prévues, et ta tenue chaque matin.', icon: 'bell' },
  { id: 'planning', title: 'Seulement mon planning', note: 'La veille d’une tenue prévue ou d’un rendez-vous, et avant un départ.', icon: 'calendar' },
  { id: 'non', title: 'Non merci', note: 'Rien ne s’affiche. Tu pourras changer d’avis dans Moi.', icon: 'close' },
];

export const NOTIF_LABEL: Record<NotifChoice, string> = { tout: 'Tout', planning: 'Seulement le planning', non: 'Aucune' };

/** Enregistre le choix ; un « oui » ouvre d'abord la fenêtre de l'iPhone. Un refus d'iOS vaut « non ». */
export function useChoisirNotifs() {
  const { a } = useStore();
  return async (choix: NotifChoice) => {
    if (choix === 'non') return a.setNotifs('non');
    const r = await autoriser();
    if (r === 'refusee') {
      a.setNotifs('non');
      a.toast('Notifications coupées pour Dresskode : tu peux les rallumer dans les Réglages de l’iPhone.');
      return;
    }
    a.setNotifs(choix);
    a.toast(choix === 'tout' ? 'C’est noté, Kodi te prévient' : 'C’est noté : seulement ton planning');
  };
}

/** Les trois réponses, en cartes de choix. */
export function NotifChoices({ value, onDone, testID = 'notif' }: { value: NotifChoice | null; onDone?: (c: NotifChoice) => void; testID?: string }) {
  const { c } = useTheme();
  const choisir = useChoisirNotifs();
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      {NOTIF_OPTIONS.map((o) => (
        <ChoiceCard
          key={o.id}
          testID={`${testID}-${o.id}`}
          title={o.title}
          note={o.note}
          on={value === o.id}
          art={<Icon name={o.icon} size={30} color={c.ink} />}
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await choisir(o.id);
              onDone?.(o.id);
            } finally {
              setBusy(false);
            }
          }}
        />
      ))}
    </View>
  );
}
