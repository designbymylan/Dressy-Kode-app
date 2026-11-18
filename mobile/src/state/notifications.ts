/**
 * Les notifications du téléphone (07/10) : la fenêtre d'autorisation de
 * l'iPhone, puis la programmation des rappels calculés par `rappels.ts`.
 * Les rappels restent sur le téléphone (notifications locales) : rien ne part
 * vers un serveur, et Expo Go les affiche telles quelles. Depuis le 18/11, le
 * jeton d'appareil (`jetonPush`) permet aussi au serveur de prévenir quand
 * Kodi a fini de ranger une photo (fonction `notifier`). L'aperçu web n'en
 * montre aucune.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { MATIN, type Rappel } from './rappels';

const NATIF = Platform.OS !== 'web';

if (NATIF) {
  // Une notification qui arrive pendant que l'app est ouverte s'affiche quand même, sans son.
  // Sauf « tes pièces sont prêtes » (push) : l'app ouverte le dit déjà par son message, pas de doublon.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const dejaDit = n.request.content.data?.type === 'piece';
      return { shouldShowBanner: !dejaDit, shouldShowList: !dejaDit, shouldPlaySound: false, shouldSetBadge: false };
    },
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
        content: { title: 'Ta tenue du jour t’attend', body: 'Kodi l’a choisie avec la météo de ce matin.' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...MATIN },
      });
    }
  } catch (e) {
    console.warn('[rappels] programmation :', e instanceof Error ? e.message : e);
  }
}

/**
 * Le jeton push de cet appareil (service Expo Push), ou null : sur le web,
 * sans l'accord de l'iPhone, ou quand le jeton ne peut pas être obtenu (Expo
 * Go sur Android, pas de réseau). L'identifiant du projet EAS est lu dans la
 * configuration de l'app.
 */
export async function jetonPush(): Promise<string | null> {
  if (!NATIF) return null;
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return null;
    return (await Notifications.getExpoPushTokenAsync()).data;
  } catch (e) {
    console.warn('[push] jeton :', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Un toucher sur une notification « pièces prêtes » (reçue app fermée ou en arrière-plan). */
export type Toucher = { type: string | null };

export function ecouterTouchers(quand: (t: Toucher) => void): () => void {
  if (!NATIF) return () => undefined;
  const lire = (r: Notifications.NotificationResponse | null | undefined) =>
    quand({ type: (r?.notification.request.content.data?.type as string | undefined) ?? null });
  // L'app lancée par la notification : la navigation n'est pas encore prête, l'appelant attend.
  Notifications.getLastNotificationResponseAsync().then((r) => r && lire(r)).catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener(lire);
  return () => sub.remove();
}
