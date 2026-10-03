"""
Contraste WCAG 2.x de Dresskode, verre compris.

Étape 1-2 : les trois directions (maquettes du canevas).
Étape 3+  : les jetons réels de l'app, lus dans mobile/src/theme/palette.json,
            pour que le code et la vérification ne puissent pas diverger.

Le verre n'a pas de couleur fixe : il laisse passer ce qu'il y a dessous.
On calcule donc le pire cas, la teinte du verre mélangée (alpha) au fond
le plus clair et au plus sombre qui puissent défiler sous lui (un vêtement
blanc, une robe noire). Le flou moyenne le fond ; un grand aplat uniforme
reste le cas le plus défavorable. Une couleur rgba (filet, pastille) est
posée sur la surface qui la porte avant la mesure.

    python3 design/refonte/contraste.py
"""
import json
import pathlib
import re

def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(v) for v in c)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

def over(top, alpha, below):
    return tuple(round(alpha * t + (1 - alpha) * b) for t, b in zip(top, below))

def parse(value):
    """'#RRGGBB' → (rgb, 1) ; 'rgba(r,g,b,a)' → (rgb, a)."""
    m = re.match(r'rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)', value)
    if m:
        return tuple(int(m.group(i)) for i in (1, 2, 3)), float(m.group(4))
    return rgb(value), 1.0

# Ce qui peut passer sous une barre ou une carte de verre.
BACKDROPS = {'vêtement blanc': '#FFFFFF', 'robe noire': '#1A1817', 'jean brut': '#2F4769', 'camel': '#C49A6C'}

def solid(label, fg, bg, need):
    r = ratio(rgb(fg), rgb(bg))
    return (label, r, need)

def glass(label, fg, tint, alpha, need, extra=()):
    worst = min(ratio(rgb(fg), over(rgb(tint), alpha, rgb(b))) for b in list(BACKDROPS.values()) + list(extra))
    return (f'{label} (verre {int(alpha * 100)} %, pire fond)', worst, need)

N, L = 4.5, 3.0  # texte courant ; grand texte (≥ 24 px, ou ≥ 18,5 px gras), icônes et contours utiles

DIRECTIONS = {
    'A : Lin et verre · clair': [
        solid('texte / fond lin', '#1A1814', '#F3F0EA', N),
        solid('texte secondaire / fond lin', '#5B564D', '#F3F0EA', N),
        solid('texte secondaire / carte', '#5B564D', '#FFFFFF', N),
        solid('texte / scène de la tenue', '#1A1814', '#EFE6DA', N),
        solid('bouton principal : blanc / encre', '#FFFFFF', '#1A1814', N),
        solid('bouton secondaire : texte / lin foncé', '#1A1814', '#E9E4DA', N),
        solid('accent laiton en texte / carte', '#7A5C33', '#FFFFFF', N),
        glass('onglet actif', '#1A1814', '#FBF9F5', 0.80, N),
        glass('onglet inactif', '#4A463F', '#FBF9F5', 0.80, N),
    ],
    'A : Lin et verre · sombre': [
        solid('texte / fond', '#F2EEE6', '#0F0E0C', N),
        solid('texte secondaire / fond', '#A8A197', '#0F0E0C', N),
        solid('texte secondaire / carte', '#A8A197', '#1B1A17', N),
        solid('texte / scène de la tenue', '#F2EEE6', '#2A2621', N),
        solid('bouton principal : encre / clair', '#1A1814', '#F2EEE6', N),
        solid('accent laiton en texte / carte', '#C9A56E', '#1B1A17', N),
        glass('onglet actif', '#F2EEE6', '#1C1A17', 0.86, N),
        glass('onglet inactif', '#C4BDB2', '#1C1A17', 0.86, N),
    ],
    'B : Éditorial · clair': [
        solid('texte / papier', '#1C1A17', '#F1ECE3', N),
        solid('texte secondaire / papier', '#5E574C', '#F1ECE3', N),
        solid('numéros laiton / papier', '#7A5A2F', '#F1ECE3', N),
        solid('titre serif (grand) / papier', '#1C1A17', '#F1ECE3', L),
        solid('bouton principal : papier / encre', '#F1ECE3', '#1C1A17', N),
        glass('onglet actif', '#1C1A17', '#F6F2EA', 0.80, N),
        glass('onglet inactif', '#4E483F', '#F6F2EA', 0.80, N),
    ],
    'B : Éditorial · sombre': [
        solid('texte / encre', '#F1ECE3', '#121110', N),
        solid('texte secondaire / encre', '#ABA398', '#121110', N),
        solid('numéros laiton / encre', '#CBAA76', '#121110', N),
        solid('bouton principal : encre / papier', '#1C1A17', '#F1ECE3', N),
        glass('onglet actif', '#F1ECE3', '#1A1816', 0.86, N),
        glass('onglet inactif', '#C4BCB0', '#1A1816', 0.86, N),
    ],
    'C : Penderie lumineuse · clair': [
        solid('texte / haut du halo', '#16151A', '#F6ECE2', N),
        solid('texte secondaire / bas du halo', '#4F4B55', '#E8EBF0', N),
        glass('texte sur carte de verre', '#16151A', '#FFFFFF', 0.78, N, extra=('#F6ECE2', '#E8EBF0')),
        glass('texte secondaire sur carte de verre', '#45414B', '#FFFFFF', 0.78, N, extra=('#F6ECE2', '#E8EBF0')),
        solid('bouton principal : blanc / encre', '#FFFFFF', '#16151A', N),
        glass('onglet actif', '#16151A', '#FFFFFF', 0.74, N),
        glass('onglet inactif', '#46424C', '#FFFFFF', 0.74, N),
    ],
    'C : Penderie lumineuse · sombre': [
        solid('texte / fond', '#F4F1EC', '#0B0C10', N),
        solid('texte secondaire / fond', '#A9A6AE', '#0B0C10', N),
        glass('texte sur carte de verre', '#F4F1EC', '#24232A', 0.86, N, extra=('#0B0C10',)),
        glass('texte secondaire sur carte de verre', '#CBC7CE', '#24232A', 0.86, N, extra=('#0B0C10',)),
        solid('bouton principal : encre / clair', '#16151A', '#F4F1EC', N),
        glass('onglet actif', '#F4F1EC', '#24232A', 0.86, N),
        glass('onglet inactif', '#CBC7CE', '#24232A', 0.86, N),
    ],
}

# ---- Étape 3 : les jetons de l'app ----

PALETTE = pathlib.Path(__file__).resolve().parents[2] / 'mobile/src/theme/palette.json'

# (premier plan, fond, seuil, usage). Un fond rgba est posé sur `paper`.
APP_PAIRS = [
    ('ink', 'paper', N, 'texte courant'),
    ('ink2', 'paper', N, 'texte secondaire, légendes'),
    ('brass', 'paper', N, 'numéros et petites capitales laiton'),
    ('ink', 'raised', N, 'texte sur carte et feuille'),
    ('ink2', 'raised', N, 'texte secondaire sur carte et feuille'),
    ('brass', 'raised', N, 'laiton sur carte'),
    ('ink', 'sunk', N, 'saisie'),
    ('ink2', 'sunk', N, 'indication de saisie (placeholder)'),
    ('ink', 'stage', N, 'texte sur la scène d’une pièce'),
    ('ink2', 'stage', N, 'légende sur la scène'),
    ('primary-fg', 'primary-bg', N, 'bouton principal'),
    ('ink', 'pill', N, 'onglet ou puce sélectionnés'),
    ('positive', 'paper', N, 'confirmation (« portée aujourd’hui »)'),
    ('positive', 'positive-soft', N, 'pastille de confirmation'),
    ('caution', 'paper', N, 'alerte douce'),
    ('caution', 'caution-soft', N, 'pastille d’alerte'),
    ('rod', 'paper', L, 'tringle et cintres (graphique)'),
    ('control', 'paper', L, 'contour d’un interrupteur, d’une case, d’un champ'),
    ('control', 'raised', L, 'contour de contrôle sur carte'),
    ('ink2', 'raised', L, 'icône secondaire'),
    ('butter-ink', 'butter', N, 'bandeau de service beurre'),
    ('tab-off', 'paper', N, 'onglet inactif sur la barre'),
    ('ink', 'stage', L, 'illustration noire sur gris studio'),
]
APP_GLASS = [
    ('ink', 'onglet actif et texte sur verre'),
    ('tab-off', 'onglet inactif'),
]

def app_checks(theme, t):
    paper = rgb(t['paper'])

    def resolve(name, base=paper):
        c, a = parse(t[name])
        return over(c, a, base) if a < 1 else c

    checks = []
    for fg, bg, need, use in APP_PAIRS:
        back = resolve(bg)
        front = resolve(fg, back)
        checks.append((f'{fg} / {bg}, {use}', ratio(front, back), need))
    tint, alpha = parse(t['glass'])
    for fg, use in APP_GLASS:
        worst = min(ratio(rgb(t[fg]), over(tint, alpha, rgb(b))) for b in BACKDROPS.values())
        checks.append((f'{fg} / verre {int(alpha * 100)} %, {use} (pire fond)', worst, N))
        # « Verre plus opaque » (Réduire la transparence) : surface pleine.
        checks.append((f'{fg} / verre opaque, {use}', ratio(rgb(t[fg]), rgb(t['raised'])), N))
    return checks

if __name__ == '__main__':
    fails = 0
    sections = dict(DIRECTIONS)
    palette = json.loads(PALETTE.read_text())
    for theme in ('light', 'dark'):
        sections[f'App : galerie · {"clair" if theme == "light" else "sombre"}'] = app_checks(theme, palette[theme])
    count = 0
    for name, checks in sections.items():
        print(f'\n{name}')
        for label, r, need in checks:
            ok = r >= need
            fails += not ok
            count += 1
            print(f"  {'ok  ' if ok else 'ÉCHEC'} {r:5.2f}:1  (≥ {need}:1)  {label}")
    print(f'\n{fails} échec(s) sur {count}' if fails else f'\ntout passe AA ({count} couples)')
    raise SystemExit(1 if fails else 0)
