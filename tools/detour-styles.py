"""
Détoure les tenues du dossier « Image Style » (18/11) pour l'écran des styles
du questionnaire : la personne et sa tenue, sans le décor, en WebP transparent
(700 × 1000 au plus, rogné au plus près), dans
mobile/assets/styles/<femme|homme>/<style>-<n>.webp, puis réécrit
mobile/src/data/stylePhotos.ts. Une planche de contrôle (fond gris studio)
est écrite dans le dossier temporaire, à regarder avant de garder le résultat.

    python3 -I tools/detour-styles.py "<dossier Image Style>" [--max 4] [--planche planche.jpg]

Le style d'une photo se lit dans le nom de son dossier ou de son fichier
(« Old Money », « oldmoney », « Gothic »…) ; le rayon dans « Style Femme » ou
« Style Homme ». Une photo dont le style ou le rayon reste inconnu est
signalée et laissée de côté.

Le détourage tourne sur l'ordinateur, sans service externe : rembg et son
modèle BiRefNet portrait (téléchargé une fois, environ 1 Go ; 8 Go de
mémoire pendant le calcul). Outil de
préparation seulement, il n'entre pas dans l'app :
    python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]"
"""

import argparse
import re
import sys
import tempfile
import unicodedata
from pathlib import Path

import onnxruntime as ort
from PIL import Image, ImageOps
from rembg import new_session, remove

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "mobile" / "assets" / "styles"
MANIFESTE = RACINE / "mobile" / "src" / "data" / "stylePhotos.ts"

# Identifiant (slug du nom affiché dans l'app) et les façons de l'écrire.
STYLES = {
    "y2k": ["y2k", "y 2 k", "an 2000", "annees 2000"],
    "workwear": ["workwear", "work wear"],
    "gothique": ["gothique", "gothic", "goth"],
    "grunge": ["grunge"],
    "old_money": ["old money", "oldmoney", "old_money"],
    "techwear": ["techwear", "tech wear"],
    "preppy": ["preppy", "prepy", "preppie", "prepaille"],
    "gorpcore": ["gorpcore", "gorp core", "gorp"],
    "streetwear": ["streetwear", "street wear", "sreetwear"],
}
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".avif"}


def plat(texte: str) -> str:
    t = unicodedata.normalize("NFD", texte).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def style_de(chemin: Path) -> str | None:
    morceaux = [plat(p) for p in [chemin.stem, *[x.name for x in chemin.parents]]]
    for m in morceaux:
        for ident, noms in STYLES.items():
            if any(re.search(rf"(^| ){re.escape(n)}( |$)", m) or m.replace(" ", "") == n.replace(" ", "") for n in noms):
                return ident
    return None


def rayon_de(chemin: Path) -> str | None:
    for p in [chemin, *chemin.parents]:
        n = plat(p.name)
        if re.search(r"(^| )(femme|femmes|women|woman)( |$)", n):
            return "femme"
        if re.search(r"(^| )(homme|hommes|men|man)( |$)", n):
            return "homme"
    return None


def detoure(session, src: Path) -> Image.Image:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((1400, 1400))
    out = remove(im, session=session)
    boite = out.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if boite:
        out = out.crop(boite)
    out.thumbnail((700, 1000))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("dossier")
    ap.add_argument("--max", type=int, default=4, help="tenues gardées par style et par rayon")
    ap.add_argument("--planche", default=str(Path(tempfile.gettempdir()) / "planche-styles.jpg"))
    ap.add_argument("--modele", default="birefnet-portrait")
    a = ap.parse_args()

    photos = sorted(p for p in Path(a.dossier).rglob("*") if p.suffix.lower() in EXTENSIONS and not p.name.startswith("."))
    rangees: dict[tuple[str, str], list[Path]] = {}
    for p in photos:
        s, r = style_de(p), rayon_de(p)
        if not s or not r:
            print(f"laissée de côté (style {s or '?'}, rayon {r or '?'}) : {p}", file=sys.stderr)
            continue
        rangees.setdefault((s, r), []).append(p)

    # Sans réserve mémoire d'onnxruntime, le pic reste vers 8 Go d'une photo
    # à l'autre ; avec, il grossit à chaque photo jusqu'à manquer de mémoire.
    opts = ort.SessionOptions()
    opts.enable_cpu_mem_arena = False
    opts.intra_op_num_threads = 4
    session = new_session(a.modele, sess_opts=opts)
    for r in ("femme", "homme"):
        (SORTIE / r).mkdir(parents=True, exist_ok=True)
        for vieux in (SORTIE / r).glob("*.webp"):
            vieux.unlink()

    faites: dict[str, dict[str, list[str]]] = {s: {"femme": [], "homme": []} for s in STYLES}
    vignettes: list[tuple[str, Image.Image]] = []
    for (s, r), liste in sorted(rangees.items()):
        for n, p in enumerate(liste[: a.max], start=1):
            nom = f"{s}-{n}.webp"
            img = detoure(session, p)
            img.save(SORTIE / r / nom, quality=82, method=6)
            faites[s][r].append(f"{r}/{nom}")
            vignettes.append((f"{r} {s} {n}", img))
            print(f"{r}/{nom}  <-  {p.name}  ({img.width} x {img.height})")

    lignes = [
        "/**",
        " * Écrit par `tools/detour-styles.py` : ne pas modifier à la main.",
        " * Les tenues détourées de chaque style, par rayon (voir `styles.ts`).",
        " */",
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "export const STYLE_PHOTOS: Record<string, { femme: ImageSourcePropType[]; homme: ImageSourcePropType[] }> = {",
    ]
    for s, par in faites.items():
        if not par["femme"] and not par["homme"]:
            continue
        lignes.append(f"  {s}: {{")
        for r in ("femme", "homme"):
            req = ", ".join(f"require('../../assets/styles/{f}')" for f in par[r])
            lignes.append(f"    {r}: [{req}],")
        lignes.append("  },")
    lignes.append("};")
    MANIFESTE.write_text("\n".join(lignes) + "\n", encoding="utf-8")

    if vignettes:
        cote, cols = 260, 6
        rangs = (len(vignettes) + cols - 1) // cols
        planche = Image.new("RGB", (cote * cols, (cote + 24) * rangs), (243, 243, 243))
        from PIL import ImageDraw

        d = ImageDraw.Draw(planche)
        for i, (titre, img) in enumerate(vignettes):
            v = img.copy()
            v.thumbnail((cote - 10, cote - 10))
            x, y = (i % cols) * cote, (i // cols) * (cote + 24)
            planche.paste(v, (x + (cote - v.width) // 2, y + 5), v)
            d.text((x + 6, y + cote + 4), titre, fill=(0, 0, 0))
        planche.save(a.planche, quality=80)
        print(f"planche : {a.planche}")


if __name__ == "__main__":
    main()
