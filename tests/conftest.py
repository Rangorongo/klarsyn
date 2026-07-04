"""
conftest.py

Delade testfixtures för hela testsviten.

En "fixture" är en färdigbyggd testmiljö som pytest ställer i ordning
åt varje test — ungefär som att duka bordet innan middagen.

taric_data_syntetisk: En miniatyrversion av TARIC-datan med exakt
    samma kolumnnamn som de riktiga Excel-filerna, men bara ett fåtal
    handplockade rader som täcker alla testfall.

taric_data_patchad: Byter ut load_taric_data() i customs_logic mot
    den syntetiska datan — så inga riktiga filer behövs.
"""

import pandas as pd
import pytest


@pytest.fixture
def taric_data_syntetisk():
    """
    Bygger syntetiska TARIC-DataFrames med exakt de kolumnnamn koden förväntar sig.

    Tre rader i duties-tabellen täcker alla testfall:
        - 8534000000: MFN-tull 3.3% (ERGA OMNES) + preferenstull 0% för Japan
        - 8542319000: MFN-tull är NAR (specifik sats, ej procent)
    """
    duties = pd.DataFrame({
        "Goods code":      ["8534000000", "8534000000", "8542319000"],
        "Origin":          ["ERGA OMNES", "Japan",      "ERGA OMNES"],
        "Origin code":     ["1011",       "JP",         "1011"],
        "Meas. type code": ["103",        "142",        "103"],
        "Duty":            ["3.300 %",    "0.000 %",    "NAR"],
    })

    nomenclature = pd.DataFrame({
        # OBS: Goods code i nomenklaturen har suffix (t.ex. " 80") — koden matchar på [:10]
        "Goods code":  ["8534000000 80",   "8542319000 80"],
        "Description": ["Printed circuits", "Integrated circuits"],
    })

    return {
        "duties":       duties,
        "nomenclature": nomenclature,
        "geo_areas":    pd.DataFrame(),
        "geo_comp":     pd.DataFrame(),
    }


@pytest.fixture
def taric_data_patchad(monkeypatch, taric_data_syntetisk):
    """
    Ersätter load_taric_data() i customs_logic med den syntetiska datan.
    Används av test_customs_logic.py för att slippa riktiga Excel-filer.
    """
    monkeypatch.setattr(
        "customs_logic.load_taric_data",
        lambda: taric_data_syntetisk
    )
