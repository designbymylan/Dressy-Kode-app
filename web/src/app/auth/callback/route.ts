import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth';

/**
 * Retour des liens d'e-mail (confirmation, mot de passe) et de Google /
 * Apple. La session s'ouvre ici, puis la personne arrive directement là où
 * elle allait : le questionnaire à la première connexion, l'accueil ensuite
 * (/demarrage renvoie vers l'accueil si le questionnaire est déjà fait).
 *
 * Deux formes de lien :
 *   ?code=…              le lien par défaut de Supabase (même navigateur que
 *                        l'inscription, qui garde la clé de vérification) ;
 *   ?token_hash=…&type=… le lien du modèle d'e-mail recommandé, qui marche
 *                        aussi quand on ouvre l'e-mail sur un autre appareil.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get('next'));
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const url = request.nextUrl.clone();
  url.search = '';
  if (!ok) {
    url.pathname = '/connexion';
    url.searchParams.set('lien', 'expire');
    return NextResponse.redirect(url);
  }
  url.pathname = next;
  return NextResponse.redirect(url);
}
