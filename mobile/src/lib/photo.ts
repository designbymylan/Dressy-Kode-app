/**
 * Une photo de vêtement avant l'envoi (F4, 13/11) : le grand côté ramené à
 * 2048 px, en JPEG 0,85. Assez pour que Kodi lise une étiquette, un logo ou
 * une couture, sans envoyer 12 mégapixels qui ralentissent l'envoi et
 * dépassent parfois la limite de 5 Mo.
 *
 * Le fichier réécrit ne garde pas les métadonnées de l'appareil (dont la
 * position) : elles ne partent plus avec la photo.
 *
 * En cas d'échec (format illisible, mémoire), la photo part telle quelle :
 * la limite de taille de `sendPhotos` reste le garde-fou.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const GRAND_COTE = 2048;
export const QUALITE = 0.85;

export async function reduire(p: { uri: string; mime?: string | null }): Promise<{ uri: string; mime: string | null }> {
  try {
    const brute = await ImageManipulator.manipulate(p.uri).renderAsync();
    const large = brute.width >= brute.height;
    const img = Math.max(brute.width, brute.height) > GRAND_COTE
      ? await ImageManipulator.manipulate(p.uri).resize(large ? { width: GRAND_COTE } : { height: GRAND_COTE }).renderAsync()
      : brute;
    const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: QUALITE });
    return { uri: out.uri, mime: 'image/jpeg' };
  } catch (e) {
    console.warn('photo non réduite :', e instanceof Error ? e.message : e);
    return { uri: p.uri, mime: p.mime ?? null };
  }
}
