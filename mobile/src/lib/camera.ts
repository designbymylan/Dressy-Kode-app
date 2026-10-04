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
