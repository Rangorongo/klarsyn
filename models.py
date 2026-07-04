"""
models.py

Denna modul definierar de centrala datastrukturerna för applikationen (exempelvis via Pydantic).
Syftet är att säkerställa att all inkommande och utgående data följer ett strikt, 
förutbestämt format innan den analyseras av tull-logiken.

Innehåller klasser och scheman för:
    - Kommersiella fakturor (Invoice)
    - Fraktdokument (ShippingDocument)
    - Importdeklarationer/Tullbeslut (CustomsDeclaration)
    - Analysrapporter (AuditReport)
"""

from typing import List, Optional, TypedDict, Annotated, Dict, Any
import operator
from pydantic import BaseModel, Field

# ==========================================
# 1. PYDANTIC-MODELLER (AI:ns svarsmall)
# ==========================================

class InvoiceItem(BaseModel):
    """Representerar en enskild varurad på fakturan."""
    description: str = Field(description="En tydlig beskrivning av varan.")
    hs_code: Optional[str] = Field(default=None, description="Tullvarukod (HS-kod) om den finns.")
    country_of_origin: Optional[str] = Field(default=None, description="Varans ursprungsland.")
    quantity: float = Field(description="Antalet av varan.")
    unit_price: float = Field(description="Pris per enhet.")
    total_item_price: float = Field(description="Totalt pris för denna varurad.")

    # --- Självkontroll (fylls i av det andra AI-anropet i extractor.py) ---
    # Tänk på det här som att en kollega läser igenom fakturan en andra gång
    # och säger "det här är jag säker på" eller "det här bör någon dubbelkolla".
    confidence: Optional[str] = Field(
        default=None,
        description="Hur säker AI:n är på den här varuraden efter självkontroll: 'hög' eller 'låg'."
    )
    review_note: Optional[str] = Field(
        default=None,
        description="Kort förklaring till varför konfidensen är låg, t.ex. otydlig HS-kod i texten. Tomt om hög konfidens."
    )

class CustomsInvoice(BaseModel):
    """Representerar hela fakturan för tullanalys."""
    invoice_number: str = Field(description="Fakturans unika nummer.")
    invoice_date: str = Field(description="Fakturans datum (ÅÅÅÅ-MM-DD).")
    supplier_name: str = Field(description="Säljarens/Avsändarens företagsnamn.")
    currency: str = Field(description="Valutan på fakturan (t.ex. USD, SEK).")
    shipping_cost: float = Field(default=0.0, description="Fraktkostnader.")
    total_invoice_amount: float = Field(description="Totalt belopp att betala.")
    items: List[InvoiceItem] = Field(description="Alla varurader på fakturan.")


# ==========================================
# 2. LANGGRAPH STATE (Applikationens minne)
# ==========================================
# Inspirerad av strukturen för InvoiceState

class CustomsGraphState(TypedDict):
    """
    Håller tillståndet (state) för fakturan när den vandrar genom LangGraph-nätverket.
    Alla agenter läser från och skriver till denna struktur.
    """
    invoice_path: str                 # Sökvägen till PDF-filen
    raw_pdf_text: str                 # Den inlästa råtexten från PDF:en

    # AI-agenternas utdata sparas här för jämförelse
    agent1_output: Annotated[List[Dict[str, Any]], operator.add]
    agent2_output: Annotated[List[Dict[str, Any]], operator.add]

    # Kvalitetskontroll och Domarens beslut
    flag_disagreement: bool           # True om agenterna är oense
    agent_winner: str                 # Vilken agent som hade rätt ('agent1' eller 'agent2')
    justification: str                # Domarens motivering till beslutet

    # Slutresultatet som skickas vidare till Tull-revisorn (customs_logic.py)
    final_output: Dict[str, Any]
