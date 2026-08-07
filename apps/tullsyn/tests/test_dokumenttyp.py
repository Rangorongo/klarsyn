"""
test_dokumenttyp.py

Testar den deterministiska dokumenttypsklassificeraren — kvotfri.
"""

import pytest
from core.dokumenttyp import identifiera_dokumenttyp


TULLFAKTURA_TEXT = """
COMMERCIAL INVOICE
Säljare: Tech Components Ltd
Leveransvillkor (Incoterm): CIF Göteborg
1. Elektronikkort | HS-kod: 8534.00.00 | Ursprungsland: CN | Antal: 10
Totalt att betala: 700.00 EUR
"""

FRAKTFAKTURA_TEXT = """
FREIGHT INVOICE — DHL Express
Sändning 1: Tracking: JD014600003SE | Göteborg → Hamburg
Verklig vikt: 12.0 kg | Debiterad vikt: 14.5 kg
Grundfrakt: 450.00 | Bränsletillägg (fuel surcharge): 22.5%
Totalt: 551.25 EUR
"""


def test_tullfaktura_identifieras():
    """Text med HS-koder, ursprungsland och Incoterm ska klassas som tull."""
    assert identifiera_dokumenttyp(TULLFAKTURA_TEXT) == "tull"


def test_fraktfaktura_identifieras():
    """Text med tracking, vikter och bränsletillägg ska klassas som frakt."""
    assert identifiera_dokumenttyp(FRAKTFAKTURA_TEXT) == "frakt"


def test_oklar_text_ger_tydligt_fel():
    """Text utan tydliga signaler ska ge ett fel som pekar på --modul-flaggan."""
    with pytest.raises(ValueError, match="--modul"):
        identifiera_dokumenttyp("Hej! Här kommer kvartalsrapporten. Mvh Anna")


def test_tom_text_ger_tydligt_fel():
    """Tom text ska inte gissas — tydligt fel."""
    with pytest.raises(ValueError, match="--modul"):
        identifiera_dokumenttyp("")
