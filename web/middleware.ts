import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/bienvenue', '/connexion', '/inscription', '/auth', '/mot-de-passe'];

/**
 * Rafraîchit la session à chaque navigation et garde les routes privées.
 * Sans ce passage, un jeton expiré ne serait renouvelé qu'au prochain appel
 * client et les Server Components verraient une session morte.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser() et non getSession() : seul getUser() revalide le jeton auprès
  // du serveur Auth. getSession() se contente de lire le cookie.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/bienvenue';
    url.searchParams.set('suite', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/bienvenue' || pathname === '/connexion' || pathname === '/inscription')) {
    const url = request.nextUrl.clone();
    url.pathname = '/accueil';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|fonts/|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)$).*)'],
};
