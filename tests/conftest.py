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
    # Datumformatet är samma som i riktiga TARIC-filerna: DD-MM-ÅÅÅÅ.
    # 7318150000 (skruvar) har TRE MFN-rader: en utgången, en giltig och en
    # framtida — datumfiltret ska välja den giltiga (3.700 %).
    # 2007109100 (sylt) har en villkorstull (Cond:) som ska flaggas.
    duties = pd.DataFrame({
        "Goods code":      ["8534000000", "8534000000", "8542319000",
                            "7318150000", "7318150000", "7318150000",
                            "2007109100"],
        "Origin":          ["ERGA OMNES", "Japan",      "ERGA OMNES",
                            "ERGA OMNES", "ERGA OMNES", "ERGA OMNES",
                            "ERGA OMNES"],
        "Origin code":     ["1011",       "JP",         "1011",
                            "1011",       "1011",       "1011",
                            "1011"],
        "Meas. type code": ["103",        "142",        "103",
                            "103",        "103",        "103",
                            "103"],
        "Duty":            ["3.300 %",    "0.000 %",    "NAR",
                            "9.900 %",    "3.700 %",    "1.000 %",
                            "Cond:  A cert: D-008 (01):10.000 %"],
        "Start date":      ["01-01-2020", "01-01-2020", "01-01-2020",
                            "01-01-2019", "01-01-2022", "01-01-2030",
                            "01-01-2022"],
        "End date":        [None,         None,         None,
                            "31-12-2021", None,         None,
                            None],
    })

    nomenclature = pd.DataFrame({
        # OBS: Goods code i nomenklaturen har suffix (t.ex. " 80") — koden matchar på [:10]
        "Goods code":  ["8534000000 80",   "8542319000 80",
                        "7318150000 80",   "2007109100 80"],
        "Description": ["Printed circuits", "Integrated circuits",
                        "Screws and bolts", "Jams and homogenised preparations"],
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
    Ersätter load_taric_data() i customs_logic med den syntetiska datan,
    och AI-verifieringen (verify_hs_matches) med ett snällt standardsvar
    som säger "ja" på allt — så inga tester gör riktiga API-anrop.

    Tester som vill simulera "nej"/"osäker"/kvotfel överstyr
    customs_logic.verify_hs_matches själva med monkeypatch.
    """
    monkeypatch.setattr(
        "customs_logic.load_taric_data",
        lambda: taric_data_syntetisk
    )
    monkeypatch.setattr(
        "customs_logic.verify_hs_matches",
        lambda rader: {r["index"]: ("ja", "Beskrivningarna stämmer överens.") for r in rader}
    )
