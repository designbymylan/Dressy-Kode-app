'use client';

/**
 * L'ajout de pièces sur le site (spec du 20/11) : une photo = une pièce, la
 * photo s'affiche tout de suite (« Traitement… »), la pièce arrive détourée
 * avec sa fiche pré-remplie, on corrige par sélecteurs, puis « Tout ajouter ».
 * Remplace PhotoForm quand PIPELINE_AJOUT est vrai (lib/ajout.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  aConfirmer, enregistrerFiche, envoyer, FICHE_VIDE, ficheComplete, lirePieces, MAX_PHOTOS, MESSAGES, PERIME_MS, preparer,
  reessayer, reprendre, retirer, suivre, toutAjouter, type Fiche, type PieceAjout,
} from '@/lib/ajout';
import { CATEGORIES, COULEURS, COUPES, HABILLAGES, MATIERES, MOTIFS, SAISONS, categorie } from '@/lib/taxonomy';

const CONSEILS = [
  'Une seule pièce, posée à plat ou sur un cintre',
  'Un fond uni qui contraste avec la pièce',
  'La lumière du jour, sans flash',
  'La pièce entière dans le cadre',
];
const GUIDE = 'dk_guide_capture';
const EN_MEME_TEMPS = 3;

function Puce({ on, onClick, children, dot }: { on: boolean; onClick: () => void; children: string; dot?: string }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onClick}>
      {dot && <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, background: dot, border: '1px solid var(--rule)' }} />}
      {children}
    </button>
  );
}

function Champ({ titre, confirmer, children }: { titre: string; confirmer?: boolean; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
      <legend style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span className="label">{titre}</span>
        {confirmer && <span className="tag" style={{ background: 'var(--butter)', color: 'var(--butter-ink)', borderRadius: 999, padding: '2px 10px', fontSize: 11 }}>À confirmer</span>}
      </legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </fieldset>
  );
}

function FicheEditor({ fiche, onChange, confirmer }: { fiche: Fiche; onChange: (f: Fiche) => void; confirmer: boolean }) {
  const maj = (p: Partial<Fiche>) => onChange({ ...fiche, ...p });
  const cat = categorie(fiche.categorie);
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Champ titre="Catégorie *" confirmer={confirmer || !fiche.categorie}>
        {CATEGORIES.map((c) => <Puce key={c.id} on={fiche.categorie === c.id} onClick={() => maj({ categorie: c.id, type: c.id === fiche.categorie ? fiche.type : null })}>{c.label}</Puce>)}
      </Champ>
      {cat && (
        <Champ titre="Type *" confirmer={confirmer || !fiche.type}>
          {cat.types.map((k) => <Puce key={k.id} on={fiche.type === k.id} onClick={() => maj({ type: k.id })}>{k.label}</Puce>)}
        </Champ>
      )}
      <Champ titre="Couleur" confirmer={confirmer}>
        {COULEURS.map((c) => <Puce key={c.id} dot={c.hex} on={fiche.couleur === c.id} onClick={() => maj({ couleur: c.id, couleur_2: fiche.couleur_2 === c.id ? null : fiche.couleur_2 })}>{c.label}</Puce>)}
      </Champ>
      <Champ titre="Seconde couleur" confirmer={confirmer}>
        <Puce on={!fiche.couleur_2} onClick={() => maj({ couleur_2: null })}>Aucune</Puce>
        {COULEURS.filter((c) => c.id !== fiche.couleur).map((c) => <Puce key={c.id} dot={c.hex} on={fiche.couleur_2 === c.id} onClick={() => maj({ couleur_2: c.id })}>{c.label}</Puce>)}
      </Champ>
      <Champ titre="Matière" confirmer={confirmer}>
        {MATIERES.map((m) => <Puce key={m.id} on={fiche.matiere === m.id} onClick={() => maj({ matiere: m.id })}>{m.label}</Puce>)}
      </Champ>
      <Champ titre="Motif" confirmer={confirmer}>
        {MOTIFS.map((m) => <Puce key={m.id} on={fiche.motif === m.id} onClick={() => maj({ motif: m.id })}>{m.label}</Puce>)}
      </Champ>
      <Champ titre="Coupe" confirmer={confirmer}>
        {COUPES.map((m) => <Puce key={m.id} on={fiche.coupe === m.id} onClick={() => maj({ coupe: m.id })}>{m.label}</Puce>)}
      </Champ>
      <Champ titre="Saisons" confirmer={confirmer}>
        {SAISONS.map((s) => <Puce key={s.id} on={fiche.saisons.includes(s.id)} onClick={() => maj({ saisons: fiche.saisons.includes(s.id) ? fiche.saisons.filter((x) => x !== s.id) : [...fiche.saisons, s.id] })}>{s.label}</Puce>)}
      </Champ>
      <Champ titre="Habillage" confirmer={confirmer}>
        {HABILLAGES.map((h) => <Puce key={h.id} on={fiche.habillage === h.id} onClick={() => maj({ habillage: h.id })}>{h.label}</Puce>)}
      </Champ>
    </div>
  );
}

export function AjoutPieces({ spaceId }: { spaceId: string }) {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const [pieces, setPieces] = useState<PieceAjout[]>([]);
  const [guide, setGuide] = useState(false);
  const [tropPetites, setTropPetites] = useState(0);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Fiche | null>(null);
  const [ajout, setAjout] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const file = useRef<(() => Promise<void>)[]>([]);
  const actifs = useRef(0);
  const reprise = useRef<string | null>(null);
  const entreeReprise = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setGuide(!localStorage.getItem(GUIDE)); } catch { setGuide(true); }
  }, []);
  const guideVu = () => {
    setGuide(false);
    try { localStorage.setItem(GUIDE, '1'); } catch { /* navigation privée */ }
  };

  const fusionner = useCallback((lues: Omit<PieceAjout, 'locale'>[]) => {
    setPieces((avant) => {
      const parId = new Map(avant.map((p) => [p.id, p]));
      for (const l of lues) parId.set(l.id, { ...l, locale: parId.get(l.id)?.locale ?? null });
      return [...parId.values()];
    });
  }, []);

  useEffect(() => {
    lirePieces(sb, spaceId).then(fusionner).catch(() => undefined);
    return suivre(sb, spaceId, (id) => { lirePieces(sb, spaceId, [id]).then(fusionner).catch(() => undefined); });
  }, [sb, spaceId, fusionner]);

  const enCours = pieces.filter((p) => p.statut === 'processing').map((p) => p.id);
  const cleEnCours = enCours.join(',');
  useEffect(() => {
    if (!cleEnCours) return;
    const t = setInterval(() => {
      setMaintenant(Date.now());
      lirePieces(sb, spaceId, cleEnCours.split(',')).then(fusionner).catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [sb, spaceId, cleEnCours, fusionner]);

  const pomper = () => {
    while (actifs.current < EN_MEME_TEMPS && file.current.length) {
      const tache = file.current.shift()!;
      actifs.current++;
      tache().finally(() => { actifs.current--; pomper(); });
    }
  };

  const ajouterPhoto = (fichier: File) => {
    guideVu();
    const debut = Date.now();
    const cle = `local-${debut}-${Math.random().toString(36).slice(2, 7)}`;
    const locale = URL.createObjectURL(fichier);
    setPieces((p) => [...p, { id: cle, locale, statut: 'envoi', raison: null, cutout: null, nom: '', fiche: FICHE_VIDE, confiance: null, depuis: debut }]);
    file.current.push(async () => {
      const prete = await preparer(fichier).catch(() => null);
      if (!prete) {
        setPieces((p) => p.filter((x) => x.id !== cle));
        setTropPetites((n) => n + 1);
        return;
      }
      const r = await envoyer(sb, spaceId, prete, debut);
      setPieces((p) => p.map((x) => (x.id !== cle ? x : r.ok ? { ...x, id: r.id, statut: 'processing', depuis: Date.now() } : { ...x, statut: 'failed', raison: 'envoi' })));
      if (!r.ok && r.message !== MESSAGES.envoi) setMessage(r.message);
    });
    pomper();
  };

  const place = MAX_PHOTOS - pieces.filter((p) => p.statut === 'envoi' || p.statut === 'processing').length;
  const choisir = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).slice(0, Math.max(0, place)).forEach(ajouterPhoto);
    e.target.value = '';
  };

  const reprendrePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    const id = reprise.current;
    e.target.value = '';
    if (!fichier || !id) return;
    setPieces((p) => p.map((x) => (x.id === id ? { ...x, locale: URL.createObjectURL(fichier), statut: 'processing', raison: null, depuis: Date.now() } : x)));
    const prete = await preparer(fichier).catch(() => null);
    if (!prete) return setPieces((p) => p.map((x) => (x.id === id ? { ...x, statut: 'needs_retake', raison: 'trop_petite' } : x)));
    await reprendre(sb, spaceId, id, prete).catch(() => setPieces((p) => p.map((x) => (x.id === id ? { ...x, statut: 'failed', raison: 'envoi' } : x))));
  };

  const relancer = (p: PieceAjout) => {
    setPieces((all) => all.map((x) => (x.id === p.id ? { ...x, statut: 'processing', raison: null, depuis: Date.now() } : x)));
    reessayer(sb, p.id).catch(() => undefined);
  };

  const enlever = (p: PieceAjout) => {
    setPieces((all) => all.filter((x) => x.id !== p.id));
    if (!p.id.startsWith('local-')) retirer(sb, spaceId, p.id).catch(() => undefined);
  };

  const prets = pieces.filter((p) => p.statut === 'ready');
  const ajoutables = prets.filter((p) => ficheComplete(p.fiche));
  const piece = pieces.find((p) => p.id === ouverte) ?? null;

  const enregistrer = async () => {
    if (!piece || !brouillon) return;
    await enregistrerFiche(sb, piece.id, brouillon, piece.nom).catch(() => undefined);
    lirePieces(sb, spaceId, [piece.id]).then(fusionner).catch(() => undefined);
    setPieces((all) => all.map((x) => (x.id === piece.id ? { ...x, fiche: brouillon } : x)));
    setOuverte(null);
  };

  const toutAjouterMaintenant = async () => {
    setAjout(true);
    try {
      const n = await toutAjouter(sb, ajoutables.map((p) => p.id));
      const faits = new Set(ajoutables.map((p) => p.id));
      setPieces((all) => all.filter((x) => !faits.has(x.id)));
      setMessage(n > 1 ? `${n} pièces rejoignent ton dressing.` : 'Ta pièce rejoint ton dressing.');
      router.refresh();
    } catch {
      setMessage('L’ajout n’a pas abouti. Réessaie.');
    } finally {
      setAjout(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }} data-testid="ajout-pieces">
      {guide && !pieces.length && (
        <ul style={{ margin: 0, padding: '14px 18px', listStyle: 'none', display: 'grid', gap: 8, background: 'var(--stage)', borderRadius: 22 }} aria-label="Pour une belle pièce">
          {CONSEILS.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <label className="btn btn-primary" aria-disabled={place <= 0}>
          Prendre en photo
          <input type="file" accept="image/*" capture="environment" onChange={choisir} hidden disabled={place <= 0} />
        </label>
        <label className="btn btn-glass" aria-disabled={place <= 0}>
          Choisir des photos
          <input type="file" accept="image/*" multiple onChange={choisir} hidden disabled={place <= 0} />
        </label>
        <input ref={entreeReprise} type="file" accept="image/*" capture="environment" onChange={reprendrePhoto} hidden />
      </div>
      {tropPetites > 0 && <p role="status" style={{ margin: 0, textAlign: 'center' }}>{MESSAGES.trop_petite} : {tropPetites > 1 ? `${tropPetites} photos n’ont pas été envoyées.` : 'elle n’a pas été envoyée.'}</p>}
      {message && <p role="status" style={{ margin: 0, textAlign: 'center' }}>{message}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {pieces.map((p) => {
          const perimee = p.statut === 'processing' && maintenant - p.depuis > PERIME_MS;
          const attente = p.statut === 'envoi' || (p.statut === 'processing' && !perimee);
          return (
            <div key={p.id} data-statut={p.statut} style={{ display: 'grid', gap: 6, position: 'relative' }}>
              <button
                type="button"
                disabled={p.statut !== 'ready'}
                onClick={() => { setBrouillon(p.fiche); setOuverte(p.id); }}
                aria-label={p.statut === 'ready' ? `${p.nom}, corriger la fiche` : attente ? 'Traitement en cours' : MESSAGES[p.raison ?? 'unexpected']}
                style={{ aspectRatio: '1', borderRadius: 22, border: 0, padding: 0, overflow: 'hidden', background: 'var(--stage)', display: 'grid', placeItems: 'center', cursor: p.statut === 'ready' ? 'pointer' : 'default' }}
              >
                {p.statut === 'ready' && p.cutout ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cutout} alt="" style={{ width: '86%', height: '86%', objectFit: 'contain', filter: 'var(--piece-shadow)' }} />
                ) : p.locale ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.locale} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: attente ? 0.55 : 0.35 }} />
                ) : null}
                {attente && <span style={{ position: 'absolute', display: 'grid', gap: 8, placeItems: 'center' }}><span className="spinner" aria-hidden />Traitement…</span>}
              </button>
              {p.statut === 'ready' ? (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="label">{ficheComplete(p.fiche) ? p.nom : 'Fiche à remplir'}</span>
                  {(aConfirmer(p) || !ficheComplete(p.fiche)) && <span style={{ background: 'var(--butter)', color: 'var(--butter-ink)', borderRadius: 999, padding: '2px 10px', fontSize: 11 }}>À confirmer</span>}
                </span>
              ) : !attente ? (
                <span style={{ display: 'grid', gap: 6 }}>
                  <span>{perimee ? MESSAGES.unexpected : MESSAGES[p.raison ?? 'unexpected']}</span>
                  {p.statut === 'needs_retake' ? (
                    <button type="button" className="btn btn-sm btn-glass" onClick={() => { reprise.current = p.id; entreeReprise.current?.click(); }}>Reprendre la photo</button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-glass" onClick={() => relancer(p)}>Réessayer</button>
                  )}
                </span>
              ) : null}
              {!attente && (
                <button type="button" className="btn-icon" aria-label="Retirer cette photo" onClick={() => enlever(p)} style={{ position: 'absolute', top: 6, right: 6 }}>×</button>
              )}
            </div>
          );
        })}
      </div>

      {piece && brouillon && (
        <section className="glass" aria-label={`La fiche : ${piece.nom}`} style={{ borderRadius: 28, padding: 20, display: 'grid', gap: 18 }}>
          <h3 style={{ margin: 0 }}>{piece.nom || 'La fiche'}</h3>
          <FicheEditor fiche={brouillon} onChange={setBrouillon} confirmer={aConfirmer(piece)} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setOuverte(null)}>Fermer</button>
            <button type="button" className="btn btn-primary" onClick={enregistrer} disabled={!ficheComplete(brouillon)}>Enregistrer</button>
          </div>
        </section>
      )}

      {prets.length > 0 && (
        <div style={{ position: 'sticky', bottom: 96, display: 'grid', gap: 6, justifyItems: 'center' }}>
          {prets.length > ajoutables.length && <span>{prets.length - ajoutables.length > 1 ? `${prets.length - ajoutables.length} fiches à remplir avant de les ajouter` : 'Une fiche à remplir avant de l’ajouter'}</span>}
          <button type="button" className="btn btn-primary" onClick={toutAjouterMaintenant} disabled={!ajoutables.length || ajout} data-testid="ajout-tout-ajouter">
            {ajout ? <span className="spinner" aria-hidden /> : null}
            {ajoutables.length ? `Tout ajouter · ${ajoutables.length}` : 'Tout ajouter'}
          </button>
        </div>
      )}
    </div>
  );
}
