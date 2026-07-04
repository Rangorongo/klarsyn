"""
utils.py

En samling fristående hjälpfunktioner (utility functions) som används tvärs över hela projektet.
Funktionerna här är oberoende av specifik affärslogik och hanterar generella operationer.

Innehåller funktioner för:
    - GDPR-maskering: Anonymisering av personuppgifter (NER) innan data skickas till externa API:er.
    - CSV-export: Plattar till granskningsresultatet för Excel.
    - PDF-rapport: "Beslutsrapporten" — byggd med reportlab platypus så att
      sidbrytningar och radbrytningar sköts automatiskt, oavsett antal varor.
"""

import re
from xml.sax.saxutils import escape

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


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


# ==========================================
# PDF-RAPPORTEN ("Beslutsrapporten")
# ==========================================

# Arial saknar emoji-glyfer — i PDF:en ersätts de med texttaggar
# som alltid renderas korrekt och ser professionella ut.
_EMOJI_TILL_TAGG = {
    "⚠️": "[SAKNAS]",
    "🔴": "[KRITISK]",
    "💰": "[MÖJLIGHET]",
    "💶": "[ÅTERBETALNING]",
    "🔍": "[MANUELL KONTROLL]",
    "🧮": "[RÄKNEFEL]",
    "🟡": "[OSÄKER]",
    "🚨": "[ANTIDUMPNING]",
}

_VERDICT_FARG = {"grön": "#1a7f37", "gul": "#b8860b", "röd": "#c0392b"}
_VERDICT_ETIKETT = {
    "grön": "GRÖN — lita på resultatet",
    "gul": "GUL — bör granskas",
    "röd": "RÖD — måste granskas",
}
# Röda varor visas först i detaljlistan — viktigast överst.
_VERDICT_ORDNING = {"röd": 0, "gul": 1, "grön": 2}


def _pdf_text(text) -> str:
    """Gör en godtycklig text säker för PDF:en: taggar istället för emoji, XML-escapad."""
    text = escape(str(text))
    for emoji, tagg in _EMOJI_TILL_TAGG.items():
        text = text.replace(emoji, tagg)
    return text


def save_to_pdf(final_data: dict, filename: str = "resultat.pdf"):
    """
    Genererar Beslutsrapporten som PDF.

    Upplägg (viktigast först — beslutsfattaren ska få svar på sida 1):
        1. Fakturafakta
        2. Slutdomar (X gröna / Y gula / Z röda)
        3. Möjlig återbetalning (övre gräns) + ansvarsfriskrivning
        4. Åtgärdslista — vad kunden ska GÖRA, hög prioritet först
        5. Detaljer per vara (röda först), med domskäl
        6. Fullständig flagglista

    Byggd med reportlab platypus: långa texter radbryts och nya sidor
    skapas automatiskt — rapporten klarar hur många varor som helst.
    """
    pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))

    stil_rubrik = ParagraphStyle("rubrik", fontName="Arial-Bold", fontSize=16,
                                 alignment=1, spaceAfter=2)
    stil_undertext = ParagraphStyle("undertext", fontName="Arial", fontSize=9,
                                    alignment=1, textColor=colors.HexColor("#555555"),
                                    spaceAfter=12)
    stil_h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=12,
                             spaceBefore=14, spaceAfter=6)
    stil_normal = ParagraphStyle("normal", fontName="Arial", fontSize=9, leading=12)
    stil_liten = ParagraphStyle("liten", fontName="Arial", fontSize=8, leading=10,
                                textColor=colors.HexColor("#555555"))
    stil_varurubrik = ParagraphStyle("varurubrik", fontName="Arial-Bold", fontSize=10,
                                     spaceBefore=10, spaceAfter=3)

    doc = SimpleDocTemplate(
        filename, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title="Tullgranskningsrapport",
    )
    story = []
    valuta = final_data.get("currency", "EUR")

    # --- 1. Rubrik + fakturafakta ---
    story.append(Paragraph("Tullgranskningsrapport", stil_rubrik))
    story.append(Paragraph("Tullsyn — automatiserad granskning mot EU:s tulltaxa (TARIC)",
                           stil_undertext))

    fakta = [
        ("Fakturanummer", final_data.get("invoice_number")),
        ("Datum", final_data.get("invoice_date")),
        ("Leverantör", final_data.get("supplier_name")),
        ("Valuta", valuta),
        ("Frakt", final_data.get("shipping_cost")),
        ("Totalbelopp", final_data.get("total_invoice_amount")),
    ]
    tabell = Table(
        [[Paragraph(f"<b>{rubrik}:</b>", stil_normal), Paragraph(_pdf_text(varde), stil_normal)]
         for rubrik, varde in fakta],
        colWidths=[40 * mm, 120 * mm],
    )
    tabell.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(tabell)

    # --- 2. Slutdomar ---
    summary = final_data.get("verdict_summary")
    if summary:
        story.append(Paragraph("Slutdomar", stil_h2))
        story.append(Paragraph(
            f'<font color="{_VERDICT_FARG["grön"]}">■ {summary.get("grön", 0)} gröna'
            f' (lita på resultatet)</font> &nbsp;&nbsp; '
            f'<font color="{_VERDICT_FARG["gul"]}">■ {summary.get("gul", 0)} gula'
            f' (bör granskas)</font> &nbsp;&nbsp; '
            f'<font color="{_VERDICT_FARG["röd"]}">■ {summary.get("röd", 0)} röda'
            f' (måste granskas)</font>',
            stil_normal,
        ))

    # --- 3. Möjlig återbetalning ---
    savings = final_data.get("potential_savings", 0)
    if savings and savings > 0:
        story.append(Paragraph("Möjlig återbetalning (övre gräns)", stil_h2))
        story.append(Paragraph(f"<b>{savings} {valuta}</b>", stil_normal))
        story.append(Paragraph(
            "Beloppet gäller endast om MFN-tull betalades vid importen. Verifiera alltid "
            "mot importdeklarationen innan återbetalning söks hos Tullverket.",
            stil_liten,
        ))

    # --- 4. Åtgärdslista ---
    atgarder = final_data.get("action_items", [])
    if atgarder:
        story.append(Paragraph("Rekommenderade åtgärder", stil_h2))
        for nr, atgard in enumerate(atgarder, start=1):
            farg = "#c0392b" if atgard.get("prioritet") == "hög" else "#b8860b"
            etikett = "HÖG" if atgard.get("prioritet") == "hög" else "MEDEL"
            story.append(Paragraph(
                f'{nr}. <font color="{farg}"><b>[{etikett}]</b></font> '
                f'{_pdf_text(atgard.get("atgard", ""))}',
                stil_normal,
            ))
            story.append(Spacer(1, 3))

    # --- 5. Detaljer per vara (röda först) ---
    items = final_data.get("items", [])
    if items:
        story.append(Paragraph("Detaljer per vara", stil_h2))
        sorterade = sorted(items, key=lambda i: _VERDICT_ORDNING.get(i.get("verdict"), 3))
        for item in sorterade:
            verdict = item.get("verdict")
            farg = _VERDICT_FARG.get(verdict, "#000000")
            etikett = _VERDICT_ETIKETT.get(verdict, "EJ BEDÖMD")
            story.append(Paragraph(
                f'<font color="{farg}">■ {etikett}</font> — {_pdf_text(item.get("description", ""))}',
                stil_varurubrik,
            ))
            story.append(Paragraph(
                f"Antal: {_pdf_text(item.get('quantity'))} &nbsp;|&nbsp; "
                f"A-pris: {_pdf_text(item.get('unit_price'))} &nbsp;|&nbsp; "
                f"Radpris: {_pdf_text(item.get('total_item_price'))}",
                stil_normal,
            ))
            story.append(Paragraph(
                f"HS-kod: {_pdf_text(item.get('hs_code') or 'Saknas')} &nbsp;|&nbsp; "
                f"Ursprungsland: {_pdf_text(item.get('country_of_origin') or 'Saknas')}",
                stil_normal,
            ))
            story.append(Paragraph(
                f"TARIC-beskrivning: {_pdf_text(item.get('taric_description', 'Ej kontrollerad'))} "
                f"&nbsp;|&nbsp; MFN-tull: {_pdf_text(item.get('taric_mfn_duty', 'Okänd'))}",
                stil_normal,
            ))
            for skal in item.get("verdict_reasons", []):
                story.append(Paragraph(f"• {_pdf_text(skal)}", stil_liten))

    # --- 6. Fullständig flagglista ---
    flaggor = final_data.get("audit_flags", [])
    if flaggor:
        story.append(Paragraph("Samtliga kontrollflaggor", stil_h2))
        for flagga in flaggor:
            story.append(Paragraph(f"• {_pdf_text(flagga)}", stil_normal))
            story.append(Spacer(1, 2))

    doc.build(story)
    print(f"PDF sparad till {filename}")


def save_batch_summary(granskningar: list, misslyckade: list, filename: str):
    """
    Skriver en översiktsrapport för en hel batchkörning — helhetsbilden
    kunden vill se först, innan de enskilda fakturarapporterna.

    Args:
        granskningar (list): Granskningsresultaten (dictar) för lyckade fakturor.
        misslyckade (list): Sökvägar till fakturor som inte kunde granskas.
        filename (str): Var PDF:en ska sparas.
    """
    pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))

    stil_rubrik = ParagraphStyle("rubrik", fontName="Arial-Bold", fontSize=16,
                                 alignment=1, spaceAfter=12)
    stil_h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=12,
                             spaceBefore=14, spaceAfter=6)
    stil_normal = ParagraphStyle("normal", fontName="Arial", fontSize=9, leading=12)

    doc = SimpleDocTemplate(
        filename, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title="Batchsammanfattning",
    )
    story = [Paragraph("Tullsyn — batchsammanfattning", stil_rubrik)]

    # Tabell: en rad per granskad faktura
    rader = [["Faktura", "Leverantör", "Grön", "Gul", "Röd", "Möjlig återbet."]]
    total_besparing = 0.0
    valuta = "EUR"
    for g in granskningar:
        summary = g.get("verdict_summary", {})
        besparing = float(g.get("potential_savings", 0) or 0)
        total_besparing += besparing
        valuta = g.get("currency", valuta)
        rader.append([
            str(g.get("invoice_number", "?")),
            str(g.get("supplier_name", "?"))[:30],
            str(summary.get("grön", 0)),
            str(summary.get("gul", 0)),
            str(summary.get("röd", 0)),
            f"{besparing:.2f}",
        ])
    rader.append(["Totalt", "", "", "", "", f"{total_besparing:.2f} {valuta}"])

    tabell = Table(rader, colWidths=[30 * mm, 55 * mm, 15 * mm, 15 * mm, 15 * mm, 35 * mm])
    tabell.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Arial-Bold"),
        ("FONTNAME", (0, 1), (-1, -2), "Arial"),
        ("FONTNAME", (0, -1), (-1, -1), "Arial-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#999999")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
        ("TEXTCOLOR", (2, 1), (2, -2), colors.HexColor("#1a7f37")),
        ("TEXTCOLOR", (3, 1), (3, -2), colors.HexColor("#b8860b")),
        ("TEXTCOLOR", (4, 1), (4, -2), colors.HexColor("#c0392b")),
    ]))
    story.append(tabell)

    story.append(Paragraph(
        "Möjlig återbetalning är en övre gräns — gäller endast om MFN-tull "
        "betalades vid importen. Se respektive fakturas rapport för detaljer.",
        ParagraphStyle("liten", fontName="Arial", fontSize=8, leading=10,
                       textColor=colors.HexColor("#555555"), spaceBefore=6),
    ))

    if misslyckade:
        story.append(Paragraph("Fakturor som inte kunde granskas (kör om dessa)", stil_h2))
        for sokvag in misslyckade:
            story.append(Paragraph(f"• {_pdf_text(sokvag)}", stil_normal))

    doc.build(story)
    print(f"Batchsammanfattning sparad till {filename}")
