#!/usr/bin/env python3
# =============================================================================
# scripts/gerar-fontes-pdf.py
#
# P41 (PROMPTS.md) · src/lib/pdf
#
# Recria src/lib/pdf/fontes-arquivos/*.ttf a partir dos mesmos arquivos
# woff2 que a interface usa (src/app/fonts), sem trocar glifo nem métrica:
# só desempacota o contêiner WOFF2 e grava o SFNT (TTF) puro de dentro dele
# (`font.flavor = None` do fonttools; nenhuma tabela é regravada).
#
# Por que o PDF não usa o woff2 direto (CLAUDE.md pede "Tokens só em
# globals.css", e o equivalente de tipografia seria "a fonte só em
# src/app/fonts"): `fontkit@2.0.4` (usado por @react-pdf/renderer por baixo
# do pdfkit) reconstrói errado a tabela `glyf`/`loca` de um woff2 quando o
# PDF acaba usando mais de oito glifos distintos de uma fonte (qualquer
# frase normal passa disso) e lança "RangeError: Offset is outside the
# bounds of the DataView" ao gerar o PDF (bug de terceiro, não do projeto;
# reproduzido nesta sessão com `abcdefghi`, 9 glifos, sem acento nem
# símbolo). Le TTF simples não passa pela reconstrução do WOFF2 dentro do
# fontkit e não bate no bug.
#
# Rodar de novo só quando os arquivos de src/app/fonts mudarem (peso ou
# fonte nova). Precisa de fonttools (`pip install fonttools brotli`), só
# neste script; o app e o build do Next não dependem de Python em nenhum
# outro lugar.
# =============================================================================
import pathlib

from fontTools.ttLib import TTFont

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "src" / "app" / "fonts"
DESTINO = RAIZ / "src" / "lib" / "pdf" / "fontes-arquivos"

ARQUIVOS = [
    "jost-latin-400-normal",
    "jost-latin-500-normal",
    "inter-latin-400-normal",
    "inter-latin-500-normal",
    "inter-latin-600-normal",
    "ibm-plex-mono-latin-400-normal",
    "ibm-plex-mono-latin-500-normal",
]


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    for nome in ARQUIVOS:
        origem = ORIGEM / f"{nome}.woff2"
        destino = DESTINO / f"{nome}.ttf"
        fonte = TTFont(str(origem))
        fonte.flavor = None
        fonte.save(str(destino))
        print(f"ok {origem.name} -> {destino.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
