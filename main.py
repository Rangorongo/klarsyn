"""
main.py

Huvudorkestreraren för Tullsyn-pipelinen och systemets startpunkt.
Denna modul knyter samman alla delar av applikationen för att köra
ett komplett granskningsflöde.

Flödesbeskrivning:
    1. Tar emot dokument (fakturor och deklarationer).
    2. Anropar utils.py för att anonymisera känslig data (GDPR-compliance).
    3. Skickar dokumenten till extractor.py för strukturerad dataextraktion.
    4. Passerar datan till customs_logic.py för tull- och finansiell analys.
    5. Returnerar eller exporterar en färdig granskningsrapport.

Körning från kommandoraden:
    python main.py                      → granskar sample_invoice.pdf (test)
    python main.py min_faktura.pdf      → granskar en specifik faktura
    python main.py fakturamapp/         → granskar ALLA PDF:er i mappen

Vid batchkörning fortsätter pipelinen med nästa faktura även om en
misslyckas (t.ex. kvotfel) — resultatet för de lyckade sparas alltid.
"""

import argparse
import glob
import os

from langgraph.graph import StateGraph, END
import pdfplumber
from models import CustomsGraphState
from extractor import extract_invoice_data
from utils import mask_pii, save_to_csv, save_to_pdf
from customs_logic import run_customs_audit


def load_pdf_text(path: str) -> str:
    """Hjälpfunktion för att läsa in text från en PDF."""
    with pdfplumber.open(path) as pdf:
        full_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
    return full_text


def hitta_fakturor(sokvag: str) -> list:
    """
    Tolkar sökvägen från kommandoraden och returnerar listan av fakturor att köra.

    - En PDF-fil → lista med just den filen.
    - En mapp → alla PDF-filer i mappen, i bokstavsordning.
    - Allt annat → tydligt felmeddelande på svenska.

    Args:
        sokvag (str): Sökväg till en PDF-fil eller en mapp med PDF:er.

    Returns:
        list: Sökvägar till fakturorna som ska granskas.
    """
    if os.path.isdir(sokvag):
        pdfer = sorted(glob.glob(os.path.join(sokvag, "*.pdf")))
        if not pdfer:
            raise FileNotFoundError(f"Inga PDF-filer hittades i mappen: {sokvag}")
        return pdfer

    if os.path.isfile(sokvag):
        if not sokvag.lower().endswith(".pdf"):
            raise ValueError(f"Filen är inte en PDF: {sokvag}")
        return [sokvag]

    raise FileNotFoundError(f"Sökvägen finns inte: {sokvag}")


def run_pipeline(invoice_path: str) -> dict:
    """
    Orkestrerar hela tullgranskningsflödet för en given faktura.

    Args:
        invoice_path (str): Sökvägen till faktura-PDF:en som ska analyseras.

    Returns:
        dict: Det granskade resultatet (med domar, flaggor och åtgärder),
        eller None om extraktionen misslyckades.
    """
    # 1. Initiera grafen
    workflow = StateGraph(CustomsGraphState)

    # 2. Lägg till noder
    workflow.add_node("agent", extract_invoice_data)

    # 3. Bygg flödet
    workflow.set_entry_point("agent")
    workflow.add_edge("agent", END)

    # 4. Kompilera grafen
    app = workflow.compile()

    # 5. Förbered initialt state
    raw_text = load_pdf_text(invoice_path)
    clean_text = mask_pii(raw_text)

    initial_state = {
        "invoice_path": invoice_path,
        "raw_pdf_text": clean_text,
        "agent1_output": [],
        "agent2_output": [],
        "flag_disagreement": False,
        "agent_winner": "",
        "justification": "",
        "final_output": {}
    }

    # 6. Kör flödet
    final_state = app.invoke(initial_state)

    # 7. Tullanalys och export
    final_data = final_state.get("final_output")
    if not final_data:
        print("Kunde inte extrahera data.")
        return None

    audited_data = run_customs_audit(final_data)

    # Rapporterna sparas bredvid fakturan, med audit_-prefix på filnamnet
    mapp = os.path.dirname(invoice_path)
    filnamn = os.path.basename(invoice_path)
    save_to_csv(audited_data, os.path.join(mapp, f"audit_{filnamn}.csv"))
    save_to_pdf(audited_data, os.path.join(mapp, f"audit_{filnamn}.pdf"))
    print("Pipelinen slutförd.")
    return audited_data


def main():
    """Kommandoradsingång: kör en faktura eller en hel mapp."""
    parser = argparse.ArgumentParser(
        description="Tullsyn — granskar tullfakturor mot EU:s TARIC-data."
    )
    parser.add_argument(
        "sokvag",
        nargs="?",
        default="sample_invoice.pdf",
        help="PDF-faktura eller mapp med fakturor (standard: sample_invoice.pdf)",
    )
    args = parser.parse_args()

    fakturor = hitta_fakturor(args.sokvag)
    print(f"Granskar {len(fakturor)} faktura/fakturor...")

    lyckade, misslyckade = 0, 0
    for faktura in fakturor:
        print(f"\n=== {faktura} ===")
        try:
            resultat = run_pipeline(faktura)
            if resultat is not None:
                lyckade += 1
            else:
                misslyckade += 1
        except Exception as e:
            # En trasig faktura (eller kvotfel) ska inte stoppa resten av batchen
            print(f"FEL vid granskning av {faktura}: {e}")
            misslyckade += 1

    print(f"\nKlart: {lyckade} lyckades, {misslyckade} misslyckades.")


if __name__ == "__main__":
    main()
