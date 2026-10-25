import { redirect } from 'next/navigation';

export default function Index() {
  // Le middleware renvoie vers /connexion si la session manque.
  redirect('/accueil');
}
