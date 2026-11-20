/**
 * La fiche d'une pièce en revue (spec du 20/11) : chaque champ se corrige par
 * un sélecteur, jamais par du texte libre. Les valeurs viennent toutes de la
 * taxonomie (data/taxonomy.ts, copie générée). Quand la confiance de
 * l'étiquetage est faible (ou qu'il a échoué), les champs sont marqués
 * « À confirmer ».
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CATEGORIES, COULEURS, COUPES, HABILLAGES, MATIERES, MOTIFS, SAISONS, categorie } from '../data/taxonomy';
import type { Fiche } from '../state/ajout';
import { Chip } from './controls';
import { Tag } from './bits';
import { T } from './T';

function Champ({ titre, confirmer, requis, children }: { titre: string; confirmer?: boolean; requis?: boolean; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T v="label" tone="ink2" accessibilityRole="header">
          {requis ? `${titre} *` : titre}
        </T>
        {confirmer && <Tag label="À confirmer" tone="butter" />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

export function FicheEditor({ fiche, onChange, confirmer }: { fiche: Fiche; onChange: (f: Fiche) => void; confirmer: boolean }) {
  const maj = (patch: Partial<Fiche>) => onChange({ ...fiche, ...patch });
  const cat = categorie(fiche.categorie);
  const basculer = (s: string) => maj({ saisons: fiche.saisons.includes(s) ? fiche.saisons.filter((x) => x !== s) : [...fiche.saisons, s] });

  return (
    <View style={{ gap: 22 }} testID="fiche-editeur">
      <Champ titre="Catégorie" requis confirmer={confirmer || !fiche.categorie}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            testID={`fiche-categorie-${c.id}`}
            label={c.label}
            on={fiche.categorie === c.id}
            // Une autre catégorie : le type n'en fait plus partie.
            onPress={() => maj({ categorie: c.id, type: c.id === fiche.categorie ? fiche.type : null })}
          />
        ))}
      </Champ>

      {cat && (
        <Champ titre="Type" requis confirmer={confirmer || !fiche.type}>
          {cat.types.map((k) => (
            <Chip key={k.id} testID={`fiche-type-${k.id}`} label={k.label} on={fiche.type === k.id} onPress={() => maj({ type: k.id })} />
          ))}
        </Champ>
      )}

      <Champ titre="Couleur" confirmer={confirmer}>
        {COULEURS.map((c) => (
          <Chip key={c.id} testID={`fiche-couleur-${c.id}`} label={c.label} dot={c.hex} on={fiche.couleur === c.id} onPress={() => maj({ couleur: c.id, couleur_2: fiche.couleur_2 === c.id ? null : fiche.couleur_2 })} />
        ))}
      </Champ>

      <Champ titre="Seconde couleur" confirmer={confirmer}>
        <Chip testID="fiche-couleur2-aucune" label="Aucune" on={!fiche.couleur_2} onPress={() => maj({ couleur_2: null })} />
        {COULEURS.filter((c) => c.id !== fiche.couleur).map((c) => (
          <Chip key={c.id} testID={`fiche-couleur2-${c.id}`} label={c.label} dot={c.hex} on={fiche.couleur_2 === c.id} onPress={() => maj({ couleur_2: c.id })} />
        ))}
      </Champ>

      <Champ titre="Matière" confirmer={confirmer}>
        {MATIERES.map((m) => (
          <Chip key={m.id} testID={`fiche-matiere-${m.id}`} label={m.label} on={fiche.matiere === m.id} onPress={() => maj({ matiere: m.id })} />
        ))}
      </Champ>

      <Champ titre="Motif" confirmer={confirmer}>
        {MOTIFS.map((m) => (
          <Chip key={m.id} testID={`fiche-motif-${m.id}`} label={m.label} on={fiche.motif === m.id} onPress={() => maj({ motif: m.id })} />
        ))}
      </Champ>

      <Champ titre="Coupe" confirmer={confirmer}>
        {COUPES.map((m) => (
          <Chip key={m.id} testID={`fiche-coupe-${m.id}`} label={m.label} on={fiche.coupe === m.id} onPress={() => maj({ coupe: m.id })} />
        ))}
      </Champ>

      <Champ titre="Saisons" confirmer={confirmer}>
        {SAISONS.map((s) => (
          <Chip key={s.id} testID={`fiche-saison-${s.id}`} label={s.label} on={fiche.saisons.includes(s.id)} onPress={() => basculer(s.id)} />
        ))}
      </Champ>

      <Champ titre="Habillage" confirmer={confirmer}>
        {HABILLAGES.map((h) => (
          <Chip key={h.id} testID={`fiche-habillage-${h.id}`} label={h.label} on={fiche.habillage === h.id} onPress={() => maj({ habillage: h.id })} />
        ))}
      </Champ>
    </View>
  );
}
