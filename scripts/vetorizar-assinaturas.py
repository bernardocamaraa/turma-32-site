"""
Turns each formando's signature (public/assets/assinaturas/<slug>.png, white
on transparent, only ~160 px wide) into a vector drawing
(public/assets/assinaturas/<slug>.svg), sharp at any size: the editor's
"Crie seu adesivo" draws it big, and a small picture blown up gets blurry.

The picture is enlarged first (so the traced curves come out smooth), its
strokes separated from the background, and their outline traced into
curves (potrace). The SVG keeps the picture's size in its viewBox.

Run again if a signature changes:
    pip install potracer numpy pillow
    python3 scripts/vetorizar-assinaturas.py
"""

from pathlib import Path

import numpy as np
import potrace
from PIL import Image

PASTA = Path(__file__).resolve().parent.parent / "public" / "assets" / "assinaturas"
AMPLIA = 6


def caminho(curvas, escala: float) -> str:
    """The traced curves as SVG path data, back at the picture's own size."""
    partes = []
    f = lambda p: f"{p.x / escala:.2f} {p.y / escala:.2f}"
    for curva in curvas:
        partes.append(f"M{f(curva.start_point)}")
        for s in curva.segments:
            if s.is_corner:
                partes.append(f"L{f(s.c)}L{f(s.end_point)}")
            else:
                partes.append(f"C{f(s.c1)} {f(s.c2)} {f(s.end_point)}")
        partes.append("Z")
    return "".join(partes)


def vetorizar(png: Path) -> None:
    img = Image.open(png).convert("RGBA")
    w, h = img.size
    alfa = img.getchannel("A").resize((w * AMPLIA, h * AMPLIA), Image.LANCZOS)
    traco = np.array(alfa) > 110
    # potrace fills what's dark (False): the strokes go in as False.
    curvas = potrace.Bitmap(~traco).trace(turdsize=6 * AMPLIA, alphamax=1.0, opticurve=True, opttolerance=0.3)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 10}" height="{h * 10}">'
        f'<path fill="#ffffff" fill-rule="evenodd" d="{caminho(curvas, AMPLIA)}"/></svg>'
    )
    png.with_suffix(".svg").write_text(svg)
    print(f"✓ {png.with_suffix('.svg').name} ({len(svg) // 1024} KB)")


if __name__ == "__main__":
    for png in sorted(PASTA.glob("*.png")):
        vetorizar(png)
