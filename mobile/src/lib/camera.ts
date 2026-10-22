/**
 * L'accès à l'appareil photo, le même partout (ajout de pièce, questionnaire).
 *
 * Deux pièges d'iPhone, constatés le 04/10 (« l'appareil photo ne se
 * déclenche pas ») :
 * - une autorisation déjà refusée ne se redemande pas : iOS renvoie « non »
 *   sans rien afficher, il faut passer par les Réglages ;
 * - juste après la fenêtre d'autorisation, l'appareil ne s'ouvre pas tant
 *   qu'elle se referme : on lui laisse le temps de partir.
 */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type CameraAccess = 'ok' | 'blocked';

export async function cameraAccess(): Promise<CameraAccess> {
  if (Platform.OS === 'web') return 'ok';
  let perm = await ImagePicker.getCameraPermissionsAsync();
  let asked = false;
  if (!perm.granted && perm.canAskAgain) {
    perm = await ImagePicker.requestCameraPermissionsAsync();
    asked = true;
  }
  if (!perm.granted) return 'blocked';
  if (asked) await new Promise((r) => setTimeout(r, 450));
  return 'ok';
}

export const CAMERA_BLOCKED = 'L’appareil photo est bloqué pour l’app. Autorise-le dans les Réglages de ton iPhone, puis reviens ici.';

/** Une photo prise, avec ses proportions. */
export type Shot = { uri: string; mime?: string | null; ratio: number };

/**
 * Photos en rafale (diagnostic UX du 09/10 : l'effort de tout photographier).
 * L'appareil se rouvre après chaque photo, jusqu'à « Annuler » ou au nombre
 * maximal ; chaque photo est rendue aussitôt (`onShot`), pour partir chez
 * Kodi pendant qu'on prend la suivante. L'accès doit déjà être accordé
 * (`cameraAccess`). Sur le web, une seule photo.
 *
 * L'appareil rend la photo avant d'avoir fini de se refermer : le rouvrir
 * tout de suite échouerait sans bruit (même piège que l'autorisation, plus
 * haut), d'où la pause entre deux photos.
 */
export async function shootBurst({ max, quality, onShot }: { max: number; quality: number; onShot?: (shot: Shot) => void }): Promise<Shot[]> {
  const shots: Shot[] = [];
  while (shots.length < max) {
    let r: ImagePicker.ImagePickerResult;
    try {
      r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality });
    } catch (err) {
      // Une panne au milieu de la rafale garde les photos déjà prises.
      if (!shots.length) throw err;
      console.warn('[rafale] appareil photo :', err instanceof Error ? err.message : String(err));
      break;
    }
    if (r.canceled || !r.assets.length) break;
    const x = r.assets[0];
    const shot = { uri: x.uri, mime: x.mimeType, ratio: x.width && x.height ? x.width / x.height : 0.75 };
    shots.push(shot);
    onShot?.(shot);
    if (Platform.OS === 'web') break;
    await new Promise((done) => setTimeout(done, 700));
  }
  return shots;
}
