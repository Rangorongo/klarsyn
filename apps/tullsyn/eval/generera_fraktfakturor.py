"""
generera_fraktfakturor.py

Genererar testfraktfakturor med KÄNDA planterade fel för att testa
fraktmodulen. Helt kvotfritt — bara reportlab.

Kör:  python eval/generera_fraktfakturor.py
Utdata: eval/fakturor/frakt_01_planterade_fel.pdf

Planterade fel i frakt_01:
    1. Dubbeldebitering: tracking JD014600003SE förekommer TVÅ gånger
    2. Överdebiterad vikt: sändning 3 väger 8 kg, volymvikt 12 kg,
       men debiteras för 15 kg
    3. Orimligt bränsletillägg: 38 % (taknivå 35 %)
    4. Fakturatotalen stämmer inte med sändningarnas summa (100 för mycket)
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

UTMAPP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fakturor")


def main():
    os.makedirs(UTMAPP, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))

    sokvag = os.path.join(UTMAPP, "frakt_01_planterade_fel.pdf")
    c = canvas.Canvas(sokvag, pagesize=A4)
    bredd, hojd = A4
    y = hojd - 50

    c.setFont("Arial-Bold", 16)
    c.drawString(50, y, "FREIGHT INVOICE")
    y -= 30

    c.setFont("Arial", 10)
    for rad in [
        "Transportör: DHL Express Sweden AB",
        "Kund: Svensk Import AB, Industrigatan 12, Jönköping",
        "Fakturanummer: DHL-2026-77812",
        "Fakturadatum: 2026-06-28",
        "Valuta: EUR",
    ]:
        c.drawString(50, y, rad)
        y -= 16

    y -= 14
    c.setFont("Arial-Bold", 10)
    c.drawString(50, y, "Sändningar:")
    y -= 18

    c.setFont("Arial", 9)
    sandningar = [
        # (tracking, rutt, verklig vikt, debiterad vikt, mått, grundfrakt, tillägg%, tilläggsbelopp, total)
        ("JD014600003SE", "Göteborg -> Hamburg", 12.0, 12.0, "40x30x25 cm",
         420.00, 22.5, 94.50, 514.50),
        ("JD014600003SE", "Göteborg -> Hamburg", 12.0, 12.0, "40x30x25 cm",
         420.00, 22.5, 94.50, 514.50),  # PLANTERAT FEL: exakt dubblett
        ("JD014600891SE", "Stockholm -> Rotterdam", 8.0, 15.0, "50x40x30 cm",
         510.00, 22.5, 114.75, 624.75),  # PLANTERAT FEL: volymvikt 12 kg, debiterad 15
        ("JD014601422SE", "Malmö -> Warszawa", 22.0, 22.0, "60x40x35 cm",
         680.00, 38.0, 258.40, 938.40),  # PLANTERAT FEL: bränsletillägg 38 %
    ]

    for i, (tracking, rutt, verklig, debiterad, matt, grund, proc, tillagg, total) in enumerate(sandningar, 1):
        c.drawString(50, y, f"Sändning {i}: Tracking: {tracking} | {rutt} | Express")
        y -= 13
        c.drawString(65, y, f"Verklig vikt: {verklig} kg | Debiterad vikt: {debiterad} kg | Mått: {matt}")
        y -= 13
        c.drawString(65, y,
                     f"Grundfrakt: {grund:.2f} EUR | Bränsletillägg (fuel surcharge) {proc}%: "
                     f"{tillagg:.2f} EUR | Totalt: {total:.2f} EUR")
        y -= 20

    y -= 8
    c.setFont("Arial-Bold", 11)
    # PLANTERAT FEL: verklig summa är 2592.15 — fakturan anger 100 mer
    c.drawString(50, y, "Totalt att betala: 2692.15 EUR")

    c.save()
    print(f"Skrev {sokvag}")
    print("Planterade fel: dubblett-tracking, överdebiterad vikt, 38% bränsle, totalfel +100")


if __name__ == "__main__":
    main()
