import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { PhotoBackdrop } from '@/components/PhotoBackdrop';

/**
 * Écran 1 (24/10, comme sur le mobile) : une photo de mode verticale en plein
 * écran, tirée au hasard, et par-dessus une carte aux couleurs de l'app.
 * Google et Apple se choisissent à la connexion et à l'inscription.
 */
export default function Bienvenue() {
  return (
    <main className="photo-screen page">
      <PhotoBackdrop />
      <div className="photo-card">
        <div className="photo-card__brand">
          <Wordmark mark size={20} />
          <p className="lead">Porte mieux ce que tu as.</p>
        </div>
        <Link href="/inscription" className="btn btn-primary btn-block">
          Commencer
        </Link>
        <Link href="/connexion" className="btn btn-glass btn-block">
          Se connecter
        </Link>
      </div>
    </main>
  );
}
