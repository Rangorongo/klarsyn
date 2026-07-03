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
"""

from io import BytesIO
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


def run_pipeline(invoice_path: str):
    """
    Orkestrerar hela tullgranskningsflödet för en given faktura.

    Args:
        invoice_path (str): Sökvägen till faktura-PDF:en som ska analyseras.
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
    if final_data:
        audited_data = run_customs_audit(final_data)
        save_to_csv(audited_data, f"audit_{invoice_path}.csv")
        save_to_pdf(audited_data, f"audit_{invoice_path}.pdf")
        print("Pipelinen slutförd.")
    else:
        print("Kunde inte extrahera data.")


if __name__ == "__main__":
    run_pipeline("sample_invoice.pdf")
