"""
modules/customs/pipeline.py

Tullmodulens extraktionsnod för LangGraph-flödet i main.py.
Kopplar ihop den generella tvåpass-extraktionen (core/extraktion.py)
med tullmodulens schema och prompter.
"""

from core.extraktion import extrahera_tva_pass
from modules.customs.prompts import bygg_forsta_prompt, bygg_sjalvkontroll_prompt
from modules.customs.schema import CustomsGraphState, CustomsInvoice


def extract_invoice_data(state: CustomsGraphState) -> CustomsGraphState:
    """
    Extraherar strukturerad data från fakturatexten i två steg:
    en första extraktion och en efterföljande självkontroll.

    Args:
        state (CustomsGraphState): Innehåller råtexten från PDF:en

    Returns:
        CustomsGraphState: Uppdaterat state med extraherad och självgranskad fakturadata
    """
    resultat = extrahera_tva_pass(
        state["raw_pdf_text"],
        CustomsInvoice,
        bygg_forsta_prompt,
        bygg_sjalvkontroll_prompt,
    )
    return {"final_output": resultat.model_dump()}
