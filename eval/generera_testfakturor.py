"""
generera_testfakturor.py

Genererar eval-setet: 5 testfakturor som PDF, var och en med KÄNDA
planterade fel (eller medvetet felfria). Facit över vad systemet SKA
hitta ligger i eval/facit.json — kor_eval.py jämför och räknar träffar.

Helt kvotfritt: bara reportlab, inga AI-anrop.

Kör:  python eval/generera_testfakturor.py
Utdata: eval/fakturor/eval_01..05.pdf

OBS: HS-koderna är valda mot RIKTIG TARIC-data (juli 2026):
    - 8534.00.00  Printed circuits, MFN 0%
    - 3902.10.00  Polypropylene, MFN 6.5%, Japan-preferens 0% (EPA)
    - 9999.99.99  finns inte i TARIC (planterat fel)
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

UTMAPP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fakturor")


def _skriv_faktura(filnamn, fakturanr, rader, frakt, total, kommentar=""):
    """
    Ritar en enkel men realistisk handelsfaktura.

    rader: lista av dictar med beskrivning, hs (kan vara None),
           ursprung (kan vara None), antal, apris, radsumma.
    """
    pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))

    sokvag = os.path.join(UTMAPP, filnamn)
    c = canvas.Canvas(sokvag, pagesize=A4)
    bredd, hojd = A4
    y = hojd - 50

    c.setFont("Arial-Bold", 16)
    c.drawString(50, y, "COMMERCIAL INVOICE")
    y -= 30

    c.setFont("Arial", 10)
    for rad in [
        "Säljare: Nippon Industrial Supplies Co., Ltd., 2-4-1 Marunouchi, Tokyo, Japan",
        "Köpare: Svensk Import AB, Industrigatan 12, 553 02 Jönköping, Sverige",
        f"Fakturanummer: {fakturanr}",
        "Fakturadatum: 2026-06-15",
        "Leveransvillkor (Incoterm): CIF Göteborg",
        "Valuta: EUR",
    ]:
        c.drawString(50, y, rad)
        y -= 16

    y -= 14
    c.setFont("Arial-Bold", 10)
    c.drawString(50, y, "Varurader:")
    y -= 18

    c.setFont("Arial", 9)
    for i, rad in enumerate(rader, start=1):
        c.drawString(50, y, f"{i}. {rad['beskrivning']}")
        y -= 13
        detaljer = []
        if rad.get("hs"):
            detaljer.append(f"HS-kod: {rad['hs']}")
        if rad.get("ursprung"):
            detaljer.append(f"Ursprungsland: {rad['ursprung']}")
        detaljer.append(f"Antal: {rad['antal']}")
        detaljer.append(f"À-pris: {rad['apris']:.2f} EUR")
        detaljer.append(f"Radsumma: {rad['radsumma']:.2f} EUR")
        c.drawString(65, y, "   |   ".join(detaljer))
        y -= 20

    y -= 8
    c.setFont("Arial", 10)
    c.drawString(50, y, f"Frakt och försäkring (CIF): {frakt:.2f} EUR")
    y -= 16
    c.setFont("Arial-Bold", 11)
    c.drawString(50, y, f"Totalt att betala: {total:.2f} EUR")
    y -= 24

    if kommentar:
        c.setFont("Arial", 9)
        c.drawString(50, y, kommentar)

    c.save()
    print(f"Skrev {sokvag}")


def main():
    os.makedirs(UTMAPP, exist_ok=True)

    # 1. Helt korrekt faktura — mäter falsklarm. Kina-ursprung så att
    # inga FTA-fynd förväntas; aritmetiken stämmer exakt.
    _skriv_faktura(
        "eval_01_korrekt.pdf", "EVAL-2026-001",
        rader=[
            {"beskrivning": "Elektronikkort, flerlagers PCB (Multilayer Printed Circuit Board)",
             "hs": "8534.00.00", "ursprung": "CN", "antal": 10, "apris": 40.00, "radsumma": 400.00},
            {"beskrivning": "Polypropylengranulat (Polypropylene granules)",
             "hs": "3902.10.00", "ursprung": "CN", "antal": 100, "apris": 2.50, "radsumma": 250.00},
        ],
        frakt=50.00, total=700.00,
    )

    # 2. Felklassificerad vara: läderhandskar under HS-koden för kretskort.
    # AI-verifieringen SKA upptäcka att beskrivningarna inte matchar.
    _skriv_faktura(
        "eval_02_felklassificerad.pdf", "EVAL-2026-002",
        rader=[
            {"beskrivning": "Läderhandskar för montering (Leather work gloves)",
             "hs": "8534.00.00", "ursprung": "CN", "antal": 200, "apris": 3.00, "radsumma": 600.00},
            {"beskrivning": "Elektronikkort, flerlagers PCB (Multilayer Printed Circuit Board)",
             "hs": "8534.00.00", "ursprung": "CN", "antal": 5, "apris": 40.00, "radsumma": 200.00},
        ],
        frakt=40.00, total=840.00,
    )

    # 3. Räknefel: 5 × 100 = 500, men radsumman säger 480.
    # Totalbeloppet stämmer inte heller (ska vara 480 + 300 + 30 = 810, anger 910).
    _skriv_faktura(
        "eval_03_raknefel.pdf", "EVAL-2026-003",
        rader=[
            {"beskrivning": "Elektronikkort, flerlagers PCB (Multilayer Printed Circuit Board)",
             "hs": "8534.00.00", "ursprung": "CN", "antal": 5, "apris": 100.00, "radsumma": 480.00},
            {"beskrivning": "Polypropylengranulat (Polypropylene granules)",
             "hs": "3902.10.00", "ursprung": "CN", "antal": 120, "apris": 2.50, "radsumma": 300.00},
        ],
        frakt=30.00, total=910.00,
    )

    # 4. Saknade fält: rad 1 saknar HS-kod, rad 2 saknar ursprungsland.
    _skriv_faktura(
        "eval_04_saknade_falt.pdf", "EVAL-2026-004",
        rader=[
            {"beskrivning": "Industriventiler i mässing (Brass industrial valves)",
             "hs": None, "ursprung": "CN", "antal": 20, "apris": 15.00, "radsumma": 300.00},
            {"beskrivning": "Elektronikkort, flerlagers PCB (Multilayer Printed Circuit Board)",
             "hs": "8534.00.00", "ursprung": None, "antal": 10, "apris": 40.00, "radsumma": 400.00},
        ],
        frakt=20.00, total=720.00,
    )

    # 5. Missad FTA-möjlighet: polypropylen från Japan (MFN 6.5%, EPA ger 0%).
    # Inget ursprungsintyg nämns — systemet SKA flagga möjlig återbetalning.
    _skriv_faktura(
        "eval_05_fta_missad.pdf", "EVAL-2026-005",
        rader=[
            {"beskrivning": "Polypropylengranulat (Polypropylene granules)",
             "hs": "3902.10.00", "ursprung": "JP", "antal": 1000, "apris": 3.20, "radsumma": 3200.00},
        ],
        frakt=180.00, total=3380.00,
        kommentar="Anm: Inget ursprungsintyg (EUR.1/REX) bifogat.",
    )

    print("\nKlart — 5 testfakturor i eval/fakturor/")


if __name__ == "__main__":
    main()
