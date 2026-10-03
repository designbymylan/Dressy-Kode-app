/**
 * Le client Supabase de l'app. La session est gardée dans AsyncStorage et
 * rafraîchie tant que l'app est au premier plan.
 *
 * Sans EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY (voir .env.example),
 * `supabase` vaut null et l'app reste en mode démonstration, sans réseau :
 * c'est le cas de l'aperçu web publié.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        // Le verrou conseillé pour React Native : sans lui, le rafraîchissement
        // du jeton et la lecture de la session peuvent se marcher dessus.
        lock: processLock,
      },
    })
  : null;

// Hors du premier plan, le rafraîchissement du jeton s'arrête ; il reprend au retour.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
