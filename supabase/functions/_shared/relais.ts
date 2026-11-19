/**
 * La course de relais (19/11), partagée par l'agent photo (repérage, dessin)
 * et Kodi. Chez l'intermédiaire, un modèle peut se mettre à pendre d'une heure
 * à l'autre (le 18/11, gemini-3.5-flash : toutes les photos échouaient) : on ne
 * s'appuie jamais sur un seul.
 *
 * Le premier modèle part ; sans réponse après `delai`, le suivant part EN MÊME
 * TEMPS, et ainsi de suite. La première réussite gagne et les appels en cours
 * sont coupés (`signal`). Une erreur lance le suivant aussitôt. Tout tombe :
 * l'erreur rendue est la première que `prefere` retient, sinon la première.
 */
export function course<T>(
  quoi: string,
  modeles: string[],
  essai: (model: string, signal: AbortSignal) => Promise<T>,
  delai: number,
  prefere: (err: unknown) => boolean = () => false,
): Promise<T> {
  const arret = new AbortController();
  return new Promise((resolve, reject) => {
    const erreurs: unknown[] = [];
    let suivant = 0;
    let enCours = 0;
    let fini = false;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const finir = () => { fini = true; clearTimeout(minuterie); arret.abort(); };
    const lancer = () => {
      if (fini || suivant >= modeles.length) return;
      const model = modeles[suivant++];
      enCours++;
      clearTimeout(minuterie);
      if (suivant < modeles.length) minuterie = setTimeout(() => {
        console.warn(`${quoi} : ${model} n'a pas répondu en ${delai} ms, relais ${modeles[suivant]} lancé en parallèle`);
        lancer();
      }, delai);
      essai(model, arret.signal).then((r) => {
        if (fini) return;
        finir();
        resolve(r);
      }, (err) => {
        enCours--;
        if (fini) return;
        erreurs.push(err);
        console.warn(`${quoi} : ${model} en échec (${detail(err)})`);
        if (suivant < modeles.length) return lancer();
        if (enCours > 0) return;
        finir();
        reject(erreurs.find(prefere) ?? erreurs[0]);
      });
    };
    lancer();
  });
}

const detail = (err: unknown): string => {
  const e = err as { detail?: string; message?: string } | null;
  return String(e?.detail ?? e?.message ?? err).slice(0, 300);
};

/** Une liste de modèles lue dans un secret (séparés par des virgules), ou la liste par défaut. */
export function listeDeModeles(brut: string | undefined, defaut: string[]): string[] {
  return brut?.split(',').map((m) => m.trim()).filter(Boolean) ?? defaut;
}
