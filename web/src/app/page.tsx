import { redirect } from 'next/navigation';

export default function Index() {
  // Le middleware renvoie vers /bienvenue si la session manque.
  redirect('/accueil');
}
