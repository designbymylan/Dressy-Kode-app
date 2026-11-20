/**
 * L'ajout de pièces (spec « Pipeline d'ajout de vêtements », 20/11) : une
 * photo = une pièce. La photo s'affiche tout de suite (« Traitement… »), on
 * continue d'en ajouter, la pièce arrive détourée avec sa fiche pré-remplie,
 * on corrige par sélecteurs, puis « Tout ajouter ».
 *
 * Remplace l'écran de l'agent multi-pièces quand `PIPELINE_AJOUT` est vrai
 * (state/ajout.ts) : bascule après le banc, sur validation de l'utilisateur.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import Animated from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state/store';
import {
  aConfirmer, enregistrerFiche, envoyer, ficheComplete, lirePieces, MAX_PHOTOS, MESSAGES, PERIME_MS, preparer, reessayer,
  reprendre, retirer, suivre, toutAjouter, type Fiche, type PieceAjout,
} from '../state/ajout';
import { useOnce } from '../state/once';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { T } from '../ui/T';
import { Tap } from '../ui/Tap';
import { Icon, type IconName } from '../ui/Icon';
import { Button } from '../ui/Button';
import { Card, Tag } from '../ui/bits';
import { Ambient } from '../ui/Ambient';
import { Sheet } from '../ui/Sheet';
import { BottomFade } from '../ui/shop';
import { StackHeader, useHeaderScroll, useStackTop } from '../ui/layout';
import { useScreen } from '../ui/screen';
import { CameraCadre } from '../ui/CameraCadre';
import { FicheEditor } from '../ui/fiche';

const CONSEILS: { icon: IconName; texte: string }[] = [
  { icon: 'hanger', texte: 'Une seule pièce, posée à plat ou sur un cintre' },
  { icon: 'grid', texte: 'Un fond uni qui contraste avec la pièce' },
  { icon: 'sun', texte: 'La lumière du jour, sans flash' },
  { icon: 'camera', texte: 'La pièce entière dans le cadre' },
];

/**
 * Deux pièces en traitement à la fois, au plus : au-delà, le serveur dépassait
 * son temps de calcul et perdait tout le lot (banc du 21/11). Une place se
 * libère quand la pièce n'est plus « Traitement… » (30 s au plus).
 */
const EN_MEME_TEMPS = 2;
const LIBERATION_MS = 30_000;

export function Ajout() {
  const { s, a } = useStore();
  const session = s.session;
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { width } = useScreen();
  const { y, onScroll } = useHeaderScroll();
  const top = useStackTop(true);
  const [guide, guideVu] = useOnce('guide-capture');
  const [pieces, setPieces] = useState<PieceAjout[]>([]);
  const [tropPetites, setTropPetites] = useState(0);
  const [camera, setCamera] = useState<{ reprise: string | null } | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Fiche | null>(null);
  const [ajout, setAjout] = useState(false);
  const [maintenant, setMaintenant] = useState(Date.now());
  const file = useRef<(() => Promise<void>)[]>([]);
  // Les pièces en traitement qui tiennent une place de la file : libérées quand elles changent d'état.
  const attentes = useRef(new Map<string, () => void>());
  const actifs = useRef(0);
  const tuile = (width - space.gutter * 2 - 12) / 2;

  const fusionner = useCallback((lues: Omit<PieceAjout, 'locale'>[]) => {
    setPieces((avant) => {
      const parId = new Map(avant.map((p) => [p.id, p]));
      for (const l of lues) {
        parId.set(l.id, { ...l, locale: parId.get(l.id)?.locale ?? null });
        if (l.statut !== 'processing') attentes.current.get(l.id)?.();
      }
      return [...parId.values()];
    });
  }, []);

  // Les pièces laissées en revue ou en cours lors d'une visite précédente.
  useEffect(() => {
    if (!session) return;
    lirePieces(session).then(fusionner).catch(() => undefined);
    return suivre(session, (id) => { lirePieces(session, [id]).then(fusionner).catch(() => undefined); });
  }, [session, fusionner]);

  // Filet sous Realtime : tant qu'une pièce est en cours, on la relit toutes les 4 s.
  const enCours = pieces.filter((p) => p.statut === 'processing').map((p) => p.id);
  useEffect(() => {
    if (!session || !enCours.length) return;
    const t = setInterval(() => {
      setMaintenant(Date.now());
      lirePieces(session, enCours).then(fusionner).catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [session, enCours.join(','), fusionner]);

  const pomper = () => {
    while (actifs.current < EN_MEME_TEMPS && file.current.length) {
      const tache = file.current.shift()!;
      actifs.current++;
      tache().finally(() => { actifs.current--; pomper(); });
    }
  };

  /** Une photo : elle s'affiche, se prépare, part, puis la pièce suit son état en direct. */
  const ajouterPhoto = (uri: string) => {
    if (!session) return;
    guideVu();
    const debut = Date.now();
    const cle = `local-${debut}-${Math.random().toString(36).slice(2, 7)}`;
    setPieces((p) => [...p, { id: cle, locale: uri, statut: 'envoi', raison: null, cutout: null, nom: '', fiche: { categorie: null, type: null, couleur: null, couleur_2: null, matiere: null, motif: null, coupe: null, saisons: [], habillage: null }, confiance: null, depuis: debut }]);
    file.current.push(async () => {
      const prete = await preparer(uri).catch(() => null);
      if (!prete) {
        setPieces((p) => p.filter((x) => x.id !== cle));
        setTropPetites((n) => n + 1);
        return;
      }
      const r = await envoyer(session, prete, debut);
      setPieces((p) => p.map((x) => (x.id !== cle ? x
        : r.ok ? { ...x, id: r.id, statut: 'processing', depuis: Date.now() }
        : { ...x, statut: 'failed', raison: 'envoi' })));
      // La place reste prise tant que la pièce se traite (voir EN_MEME_TEMPS).
      if (r.ok) {
        await new Promise<void>((libre) => {
          const fin = () => { attentes.current.delete(r.id); libre(); };
          attentes.current.set(r.id, fin);
          setTimeout(fin, LIBERATION_MS);
        });
      }
    });
    pomper();
  };

  const place = MAX_PHOTOS - pieces.filter((p) => p.statut === 'envoi' || p.statut === 'processing').length;

  const galerie = async () => {
    guideVu();
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, place), quality: 1 });
    if (r.canceled) return;
    r.assets.slice(0, Math.max(1, place)).forEach((x) => ajouterPhoto(x.uri));
  };

  const surPhoto = async (photo: { uri: string }) => {
    const reprise = camera?.reprise;
    if (!reprise) return ajouterPhoto(photo.uri);
    if (!session) return;
    // « Reprendre la photo » : la nouvelle remplace l'originale de cette pièce.
    setCamera(null);
    setPieces((p) => p.map((x) => (x.id === reprise ? { ...x, locale: photo.uri, statut: 'processing', raison: null, depuis: Date.now() } : x)));
    const prete = await preparer(photo.uri).catch(() => null);
    if (!prete) {
      setPieces((p) => p.map((x) => (x.id === reprise ? { ...x, statut: 'needs_retake', raison: 'trop_petite' } : x)));
      return;
    }
    await reprendre(session, reprise, prete).catch(() => setPieces((p) => p.map((x) => (x.id === reprise ? { ...x, statut: 'failed', raison: 'envoi' } : x))));
  };

  const relancer = (p: PieceAjout) => {
    if (p.raison === 'envoi' && p.locale) {
      setPieces((all) => all.filter((x) => x.id !== p.id));
      return ajouterPhoto(p.locale);
    }
    setPieces((all) => all.map((x) => (x.id === p.id ? { ...x, statut: 'processing', raison: null, depuis: Date.now() } : x)));
    reessayer(p.id).catch(() => undefined);
  };

  const enlever = (p: PieceAjout) => {
    setPieces((all) => all.filter((x) => x.id !== p.id));
    if (session && !p.id.startsWith('local-')) retirer(session, p.id).catch(() => undefined);
  };

  const prets = useMemo(() => pieces.filter((p) => p.statut === 'ready'), [pieces]);
  const ajoutables = prets.filter((p) => ficheComplete(p.fiche));
  const aRemplir = prets.length - ajoutables.length;
  const piece = pieces.find((p) => p.id === ouverte) ?? null;

  const enregistrer = async () => {
    if (!piece || !brouillon) return;
    await enregistrerFiche(piece.id, brouillon, piece.nom).catch(() => undefined);
    if (session) lirePieces(session, [piece.id]).then(fusionner).catch(() => undefined);
    setPieces((all) => all.map((x) => (x.id === piece.id ? { ...x, fiche: brouillon } : x)));
    setOuverte(null);
  };

  const toutAjouterMaintenant = async () => {
    setAjout(true);
    try {
      const n = await toutAjouter(ajoutables.map((p) => p.id));
      const faits = new Set(ajoutables.map((p) => p.id));
      setPieces((all) => all.filter((x) => !faits.has(x.id)));
      a.toast(n > 1 ? `${n} pièces rejoignent tes portants` : 'Ta pièce rejoint tes portants', false, { label: 'Voir', route: 'Tabs', params: { screen: 'Dressing', params: { view: 'grille' } } });
      a.refresh().catch(() => undefined);
    } finally {
      setAjout(false);
    }
  };

  return (
    <View className="bg-paper" style={{ flex: 1 }} testID="screen-ajout">
      <Ambient />
      <StackHeader title="Ajouter" y={y} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: top + 4, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + 140, gap: 16 }}>
        <T v="hero" accessibilityRole="header" style={{ paddingHorizontal: 4 }}>
          Une photo, une pièce.
        </T>

        {guide && !pieces.length && (
          <Card style={{ gap: 12 }} testID="ajout-guide">
            <Tag label="Pour une belle pièce" />
            {CONSEILS.map((x) => (
              <View key={x.texte} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name={x.icon} size={20} color={c.ink} />
                <T v="body" style={{ flex: 1 }}>{x.texte}</T>
              </View>
            ))}
          </Card>
        )}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Prendre en photo" icon="camera" grow onPress={() => setCamera({ reprise: null })} disabled={place <= 0} testID="ajout-camera" />
          <Button label="Galerie" icon="image" variant="secondary" onPress={galerie} disabled={place <= 0} testID="ajout-galerie" />
        </View>

        {tropPetites > 0 && (
          <T v="small" tone="ink2" testID="ajout-trop-petite" style={{ paddingHorizontal: 4 }}>
            {tropPetites > 1 ? `${MESSAGES.trop_petite} : ${tropPetites} photos n’ont pas été envoyées.` : `${MESSAGES.trop_petite} : elle n’a pas été envoyée.`}
          </T>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {pieces.map((p) => {
            const perimee = p.statut === 'processing' && maintenant - p.depuis > PERIME_MS;
            const enAttente = p.statut === 'envoi' || (p.statut === 'processing' && !perimee);
            return (
              <View key={p.id} testID={`ajout-piece-${p.statut}`} style={{ width: tuile, gap: 6 }}>
                <Tap
                  onPress={() => { if (p.statut === 'ready') { setBrouillon(p.fiche); setOuverte(p.id); } }}
                  disabled={p.statut !== 'ready'}
                  accessibilityRole="button"
                  accessibilityLabel={p.statut === 'ready' ? `${p.nom}, corriger la fiche` : enAttente ? 'Traitement en cours' : MESSAGES[p.raison ?? 'unexpected']}
                  style={{ width: tuile, height: tuile, borderRadius: 22, overflow: 'hidden', backgroundColor: c.sunk, alignItems: 'center', justifyContent: 'center' }}
                >
                  {p.statut === 'ready' && p.cutout ? (
                    <Image source={{ uri: p.cutout }} style={{ width: tuile - 24, height: tuile - 24 }} resizeMode="contain" accessibilityIgnoresInvertColors />
                  ) : p.locale ? (
                    <Image source={{ uri: p.locale }} style={{ width: tuile, height: tuile, opacity: enAttente ? 0.55 : 0.35 }} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : null}
                  {enAttente && (
                    <View style={{ position: 'absolute', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color={c.ink} />
                      <T v="label">Traitement…</T>
                    </View>
                  )}
                </Tap>
                {p.statut === 'ready' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <T v="label" numberOfLines={1} style={{ flexShrink: 1 }}>{ficheComplete(p.fiche) ? p.nom : 'Fiche à remplir'}</T>
                    {(aConfirmer(p) || !ficheComplete(p.fiche)) && <Tag label="À confirmer" tone="butter" />}
                  </View>
                ) : !enAttente ? (
                  <View style={{ gap: 6 }}>
                    <T v="small">{perimee ? MESSAGES.unexpected : MESSAGES[p.raison ?? 'unexpected']}</T>
                    {p.statut === 'needs_retake' ? (
                      <Button label="Reprendre la photo" size="s" icon="camera" onPress={() => setCamera({ reprise: p.id })} testID="ajout-reprendre" />
                    ) : (
                      <Button label="Réessayer" size="s" icon="refresh" onPress={() => relancer(p)} testID="ajout-reessayer" />
                    )}
                  </View>
                ) : null}
                {!enAttente && (
                  <Tap onPress={() => enlever(p)} accessibilityRole="button" accessibilityLabel="Retirer cette photo" testID="ajout-retirer" style={{ position: 'absolute', top: 6, right: 6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c['glass-strong'], alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="close" size={16} color={c.ink} />
                    </View>
                  </Tap>
                )}
              </View>
            );
          })}
        </View>
      </Animated.ScrollView>

      {prets.length > 0 && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
          <BottomFade />
          <View style={{ position: 'absolute', left: space.gutter, right: space.gutter, bottom: insets.bottom + 16, gap: 8 }}>
            {aRemplir > 0 && (
              <T v="small" tone="ink2" style={{ textAlign: 'center' }}>
                {aRemplir > 1 ? `${aRemplir} fiches à remplir avant de les ajouter` : 'Une fiche à remplir avant de l’ajouter'}
              </T>
            )}
            <Button label={ajoutables.length ? `Tout ajouter · ${ajoutables.length}` : 'Tout ajouter'} onPress={toutAjouterMaintenant} disabled={!ajoutables.length} loading={ajout} testID="ajout-tout-ajouter" />
          </View>
        </View>
      )}

      <CameraCadre visible={!!camera} reste={camera?.reprise ? 1 : Math.max(0, place)} onPhoto={surPhoto} onFermer={() => setCamera(null)} />

      <Sheet
        visible={!!piece && !!brouillon}
        onClose={() => setOuverte(null)}
        title={piece?.nom || 'La fiche'}
        testID="ajout-fiche"
        footer={<Button label="Enregistrer" onPress={enregistrer} disabled={!brouillon || !ficheComplete(brouillon)} testID="ajout-fiche-enregistrer" />}
      >
        {piece && brouillon && <FicheEditor fiche={brouillon} onChange={setBrouillon} confirmer={aConfirmer(piece)} />}
      </Sheet>
    </View>
  );
}
