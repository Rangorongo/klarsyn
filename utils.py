"""
utils.py

En samling fristående hjälpfunktioner (utility functions) som används tvärs över hela projektet.
Funktionerna här är oberoende av specifik affärslogik och hanterar generella operationer.

Innehåller funktioner för:
    - GDPR-maskering: Anonymisering av personuppgifter (NER) innan data skickas till externa API:er.
    - Filhantering: Läsning, konvertering och temporär lagring av PDF-dokument.
    - Valutaomvandlingar: Hantering av aktuella och historiska växelkurser (vid behov).
"""

import json
import re
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def mask_pii(text: str) -> str:
    """Maskerar känslig info som e-post och telefonnummer (GDPR)."""
    # Exempel: maskera e-postadresser
    text = re.sub(r'[\w\.-]+@[\w\.-]+', '[MASKED_EMAIL]', text)
    # Här kan du lägga till fler regler efter hand
    return text

def save_to_csv(final_data: dict, filename: str = "resultat.csv"):
    """Konverterar den strukturerade datan till en CSV-fil."""
    # Vi gör om ordboken till en DataFrame.
    # Om final_data innehåller en lista av varor (items),
    # kan json_normalize behövas för att "platta till" datan.
    try:
        df = pd.json_normalize(final_data)
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        print(f"Resultat sparad till {filename}")
    except Exception as e:
        print(f"Kunde inte spara till CSV: {e}")

def save_to_pdf(final_data: dict, filename: str = "resultat.pdf"):
    """
    Genererar en läsbar PDF-rapport från granskningsresultatet.
    Visar fakturadata, TARIC-uppslag, flaggningar och potentiella besparingar.
    """
    pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))

    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4
    y = height - 50

    # Rubrik
    c.setFont("Arial-Bold", 16)
    c.drawCentredString(width / 2, y, "Tullgranskningsrapport")
    y -= 40

    # Fakturainformation
    fields = [
        ("Fakturanummer", final_data.get("invoice_number")),
        ("Datum", final_data.get("invoice_date")),
        ("Leverantör", final_data.get("supplier_name")),
        ("Valuta", final_data.get("currency")),
        ("Frakt", final_data.get("shipping_cost")),
        ("Totalt", final_data.get("total_invoice_amount")),
    ]

    for label, value in fields:
        c.setFont("Arial-Bold", 10)
        c.drawString(50, y, f"{label}:")
        c.setFont("Arial", 10)
        c.drawString(160, y, str(value))
        y -= 22

    # Varor
    y -= 10
    c.setFont("Arial-Bold", 12)
    c.drawString(50, y, "Varor:")
    y -= 25

    for item in final_data.get("items", []):
        c.setFont("Arial-Bold", 9)
        c.drawString(50, y, str(item.get("description", "")))
        y -= 16

        c.setFont("Arial", 9)
        c.drawString(60, y,
            f"Antal: {item.get('quantity')}  |  "
            f"A-pris: {item.get('unit_price')}  |  "
            f"Totalt: {item.get('total_item_price')}"
        )
        y -= 14
        c.drawString(60, y,
            f"HS-kod: {item.get('hs_code') or 'Saknas'}  |  "
            f"Ursprungsland: {item.get('country_of_origin') or 'Saknas'}"
        )
        y -= 14
        c.drawString(60, y,
            f"TARIC-beskrivning: {item.get('taric_description', 'Ej kontrollerad')}  |  "
            f"MFN-tull: {item.get('taric_mfn_duty', 'Okänd')}"
        )
        y -= 20

    # Möjliga besparingar — alltid formulerat som övre gräns, aldrig som löfte.
    # Fakturan visar inte vilken tull som betalades (det gör importdeklarationen),
    # så rapporten får aldrig påstå att pengarna säkert finns att hämta.
    savings = final_data.get("potential_savings", 0)
    if savings > 0:
        y -= 10
        c.setFont("Arial-Bold", 12)
        c.drawString(50, y, f"Möjlig återbetalning (övre gräns): {savings} {final_data.get('currency', 'EUR')}")
        y -= 16
        c.setFont("Arial", 9)
        c.drawString(50, y, "Beloppet gäller endast om MFN-tull betalades vid importen. Verifiera alltid mot")
        y -= 12
        c.drawString(50, y, "importdeklarationen innan återbetalning söks hos Tullverket.")
        y -= 25

    # Flaggningar
    flags = final_data.get("audit_flags", [])
    if flags:
        y -= 10
        c.setFont("Arial-Bold", 12)
        c.drawString(50, y, "Tullvarningar:")
        y -= 20
        c.setFont("Arial", 9)
        for flag in flags:
            # Bryt långa rader
            if len(flag) > 90:
                c.drawString(60, y, flag[:90])
                y -= 14
                c.drawString(60, y, flag[90:])
            else:
                c.drawString(60, y, flag)
            y -= 18

    c.save()
    print(f"PDF sparad till {filename}")
