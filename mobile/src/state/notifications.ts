/**
 * Les notifications du téléphone (07/10) : la fenêtre d'autorisation de
 * l'iPhone, puis la programmation des rappels calculés par `rappels.ts`.
 * Tout reste sur le téléphone (notifications locales) : rien ne part vers un
 * serveur, et Expo Go les affiche telles quelles. L'aperçu web n'en montre
 * aucune.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { MATIN, type Rappel } from './rappels';

const NATIF = Platform.OS !== 'web';

if (NATIF) {
  // Une notification qui arrive pendant que l'app est ouverte s'affiche quand même, sans son.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export type Autorisation = 'accordee' | 'refusee' | 'web';

/**
 * Ouvre la fenêtre d'autorisation de l'iPhone. iOS ne la montre qu'une fois :
 * ensuite, il répond seul, et seuls les Réglages peuvent changer d'avis.
 */
export async function autoriser(): Promise<Autorisation> {
  if (!NATIF) return 'web';
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return 'accordee';
    if (!cur.canAskAgain) return 'refusee';
    const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return r.granted ? 'accordee' : 'refusee';
  } catch (e) {
    console.warn('[rappels] autorisation :', e instanceof Error ? e.message : e);
    return 'refusee';
  }
}

/** Remplace tous les rappels programmés par ceux-ci (et le rappel du matin si tout est accepté). */
export async function programmer(list: Rappel[], matin: boolean): Promise<void> {
  if (!NATIF) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    for (const r of list) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.titre, body: r.texte, data: { date: r.date } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.quand },
      });
    }
    if (matin) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'matin',
        content: { title: 'Ta tenue du jour t’attend', body: 'Kode l’a choisie avec la météo de ce matin.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...MATIN },
      });
    }
  } catch (e) {
    console.warn('[rappels] programmation :', e instanceof Error ? e.message : e);
  }
}
