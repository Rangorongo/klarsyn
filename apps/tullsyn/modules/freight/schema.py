"""
modules/freight/schema.py

Fraktmodulens datamodeller — AI:ns svarsmall vid extraktion av fraktfakturor.

Samma principer som tullmodulen:
    - Fält som inte står i fakturan = None. AI:n får ALDRIG gissa.
    - Format bevaras exakt (tracking-nummer skrivs aldrig om).
    - confidence/review_note fylls i av självkontrollen (pass 2).
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class SurchargeLine(BaseModel):
    """En tilläggsavgift på en sändning, t.ex. bränsletillägg."""
    name: str = Field(description="Tilläggets namn, t.ex. 'Bränsletillägg' eller 'Fuel surcharge'.")
    amount: float = Field(description="Tilläggets belopp.")
    percentage: Optional[float] = Field(
        default=None,
        description="Procentsatsen om tillägget anges i procent (t.ex. 22.5 för 22,5 %), annars None."
    )


class Shipment(BaseModel):
    """En enskild sändning på fraktfakturan."""
    tracking_number: Optional[str] = Field(
        default=None,
        description="Sändningens tracking-/AWB-nummer EXAKT som det står. None om det saknas."
    )
    ship_date: Optional[str] = Field(default=None, description="Avsändningsdatum om angivet.")
    origin: Optional[str] = Field(default=None, description="Avsändningsort.")
    destination: Optional[str] = Field(default=None, description="Mottagningsort.")
    service_level: Optional[str] = Field(default=None, description="Tjänstenivå, t.ex. 'Express' eller 'Economy'.")

    actual_weight_kg: Optional[float] = Field(default=None, description="Verklig vikt i kg.")
    billed_weight_kg: Optional[float] = Field(default=None, description="Debiterad vikt i kg.")
    length_cm: Optional[float] = Field(default=None, description="Längd i cm.")
    width_cm: Optional[float] = Field(default=None, description="Bredd i cm.")
    height_cm: Optional[float] = Field(default=None, description="Höjd i cm.")

    base_freight: Optional[float] = Field(default=None, description="Grundfrakten före tillägg.")
    surcharges: List[SurchargeLine] = Field(default_factory=list, description="Alla tilläggsavgifter.")
    total_charge: Optional[float] = Field(default=None, description="Sändningens totala kostnad.")

    # --- Självkontroll (fylls i av pass 2, samma som tullmodulen) ---
    confidence: Optional[str] = Field(
        default=None,
        description="Hur säker AI:n är på denna sändning efter självkontroll: 'hög' eller 'låg'."
    )
    review_note: Optional[str] = Field(
        default=None,
        description="Kort förklaring vid låg konfidens, grundad i fakturatexten. Tomt vid hög."
    )


class FreightInvoice(BaseModel):
    """Hela fraktfakturan."""
    invoice_number: Optional[str] = Field(default=None, description="Fakturans nummer.")
    invoice_date: Optional[str] = Field(default=None, description="Fakturadatum (ÅÅÅÅ-MM-DD om möjligt).")
    carrier_name: Optional[str] = Field(default=None, description="Transportören, t.ex. 'DHL', 'DSV', 'Schenker'.")
    currency: Optional[str] = Field(default=None, description="Valutan, t.ex. 'EUR' eller 'SEK'.")
    total_invoice_amount: Optional[float] = Field(default=None, description="Fakturans totalbelopp.")
    shipments: List[Shipment] = Field(default_factory=list, description="Alla sändningar på fakturan.")
