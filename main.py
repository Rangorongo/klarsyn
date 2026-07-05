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
from datetime import date

from langgraph.graph import StateGraph, END
import pdfplumber
from core.dokumenttyp import identifiera_dokumenttyp
from core.extraktion import extrahera_tva_pass
from core.pii import mask_pii
from core.rapporter import (
    save_batch_summary,
    save_revision_protocol,
    save_to_csv,
    save_to_pdf,
)
from modules.customs.pipeline import extract_invoice_data
from modules.customs.rules import run_customs_audit
from modules.customs.schema import CustomsGraphState
from modules.freight.prompts import (
    bygg_forsta_prompt as bygg_frakt_forsta_prompt,
    bygg_sjalvkontroll_prompt as bygg_frakt_sjalvkontroll_prompt,
)
from modules.freight.rules import run_freight_audit
from modules.freight.schema import FreightInvoice


def load_pdf_text(path: str) -> str:
    """
    Hjälpfunktion för att läsa in text från en PDF.

    Ger ett tydligt fel om PDF:en saknar läsbar text (inskannad bild) —
    annars skulle AI:n få en tom text och ge obegripliga svar.
    """
    with pdfplumber.open(path) as pdf:
        full_text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])

    if not full_text.strip():
        raise ValueError(
            f"Ingen läsbar text hittades i {path} — PDF:en verkar vara inskannad "
            f"(en bild av en faktura, inte digital text). OCR stöds inte ännu: "
            f"be leverantören om en digital PDF, eller konvertera med ett OCR-verktyg."
        )
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


def run_pipeline(invoice_path: str, raw_text: str = None) -> dict:
    """
    Orkestrerar hela tullgranskningsflödet för en given faktura.

    Args:
        invoice_path (str): Sökvägen till faktura-PDF:en som ska analyseras.
        raw_text (str): Redan inläst PDF-text (om None läses den från filen).

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
    if raw_text is None:
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


def run_freight_pipeline(invoice_path: str, raw_text: str = None) -> dict:
    """
    Orkestrerar fraktrevisionsflödet för en fraktfaktura.

    Samma tvåpassmönster som tullflödet men med fraktmodulens schema
    och prompter. Kvotkostnad: 2 Gemini-anrop (ingen TARIC-verifiering).

    Args:
        invoice_path (str): Sökvägen till fraktfaktura-PDF:en.
        raw_text (str): Redan inläst PDF-text (om None läses den från filen).

    Returns:
        dict: Det granskade resultatet, eller None om extraktionen misslyckades.
    """
    if raw_text is None:
        raw_text = load_pdf_text(invoice_path)
    clean_text = mask_pii(raw_text)

    resultat = extrahera_tva_pass(
        clean_text,
        FreightInvoice,
        bygg_frakt_forsta_prompt,
        bygg_frakt_sjalvkontroll_prompt,
    )
    if resultat is None:
        print("Kunde inte extrahera data.")
        return None

    audited_data = run_freight_audit(resultat.model_dump())

    mapp = os.path.dirname(invoice_path)
    filnamn = os.path.basename(invoice_path)
    save_to_csv(audited_data, os.path.join(mapp, f"audit_{filnamn}.csv"))
    print("Fraktrevisionen slutförd.")
    return audited_data


def granska_dokument(invoice_path: str, modul: str = None) -> dict:
    """
    Granskar en PDF: avgör dokumenttyp och kör rätt moduls pipeline.

    Args:
        invoice_path (str): Sökvägen till PDF:en.
        modul (str): "tull" eller "frakt" för att tvinga modulvalet,
            eller None för automatisk detektering.

    Returns:
        dict: Granskningsresultatet från modulens pipeline.
    """
    raw_text = load_pdf_text(invoice_path)
    vald_modul = modul or identifiera_dokumenttyp(mask_pii(raw_text))
    print(f"Dokumenttyp: {vald_modul}")

    if vald_modul == "frakt":
        return run_freight_pipeline(invoice_path, raw_text)
    return run_pipeline(invoice_path, raw_text)


def kor_batch(fakturor: list, modul: str = None) -> dict:
    """
    Kör pipelinen på varje faktura och håller reda på VILKA som lyckades
    respektive misslyckades — så att användaren vet exakt vilka filer
    som behöver köras om (t.ex. efter ett kvotfel).

    Args:
        fakturor (list): Sökvägar till fakturorna som ska granskas.

    Returns:
        dict: {"lyckade": [sökvägar], "misslyckade": [sökvägar],
               "granskningar": [granskningsresultat för de lyckade]}
    """
    lyckade = []
    misslyckade = []
    granskningar = []

    for faktura in fakturor:
        print(f"\n=== {faktura} ===")
        try:
            resultat = granska_dokument(faktura, modul)
            if resultat is not None:
                lyckade.append(faktura)
                granskningar.append(resultat)
            else:
                misslyckade.append(faktura)
        except Exception as e:
            # En trasig faktura (eller kvotfel) ska inte stoppa resten av batchen
            print(f"FEL vid granskning av {faktura}: {e}")
            misslyckade.append(faktura)

    return {"lyckade": lyckade, "misslyckade": misslyckade, "granskningar": granskningar}


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
    parser.add_argument(
        "--modul",
        choices=["tull", "frakt"],
        default=None,
        help="Tvinga dokumenttyp (annars detekteras den automatiskt per PDF)",
    )
    args = parser.parse_args()

    fakturor = hitta_fakturor(args.sokvag)
    print(f"Granskar {len(fakturor)} faktura/fakturor...")

    resultat = kor_batch(fakturor, args.modul)

    mapp = args.sokvag if os.path.isdir(args.sokvag) else os.path.dirname(fakturor[0])

    # Vid mappkörning med flera fakturor: skriv en översiktsrapport
    if len(fakturor) > 1 and resultat["granskningar"]:
        save_batch_summary(
            resultat["granskningar"],
            resultat["misslyckade"],
            os.path.join(mapp, "batch_sammanfattning.pdf"),
        )

    # Revisionsprotokollet — det formella underlaget för ändringsansökan —
    # skrivs efter varje körning som gav resultat.
    if resultat["granskningar"]:
        save_revision_protocol(
            resultat["granskningar"],
            os.path.join(mapp, f"revisionsprotokoll_{date.today().isoformat()}.pdf"),
        )

    print(f"\nKlart: {len(resultat['lyckade'])} lyckades, "
          f"{len(resultat['misslyckade'])} misslyckades.")

    if resultat["misslyckade"]:
        print("\nFöljande fakturor misslyckades och behöver köras om:")
        for faktura in resultat["misslyckade"]:
            print(f"  - {faktura}")
        print("\nKör om en enskild faktura med:  python main.py <sökväg>")


if __name__ == "__main__":
    main()
