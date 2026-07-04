"""
test_taric.py

Testar uppslagslogiken i taric.py med syntetiska TARIC-DataFrames.
Inga riktiga Excel-filer behövs och inga nätverksanrop görs.
"""

import os
import pytest
from taric import lookup_antidumping, lookup_duty, verify_hs_description


def test_hs_normalisering_tar_bort_punkter_och_fyller_till_10(taric_data_syntetisk):
    """Punktnotation (8534.00.00) ska matcha TARIC-koden 8534000000."""
    resultat = lookup_duty("8534.00.00", "CN", taric_data_syntetisk)
    # CN har inget FTA men koden finns i TARIC — MFN-tullen ska hittas
    assert resultat["mfn_duty"] == "3.300 %"


def test_eu_land_ger_noll_procent_utan_uppslag(taric_data_syntetisk):
    """EU-länder ska returnera 0% direkt, utan att TARIC-tabellen slås upp."""
    for landskod in ["DE", "PL", "SE", "FR", "IT"]:
        resultat = lookup_duty("8534.00.00", landskod, taric_data_syntetisk)
        assert resultat["mfn_duty"] == "0%", f"Fel för {landskod}"
        assert resultat["has_fta"] is True, f"has_fta ska vara True för {landskod}"


def test_mfn_uppslag_via_erga_omnes(taric_data_syntetisk):
    """MFN-tullen hittas via raden med Origin='ERGA OMNES' och measure type 103."""
    resultat = lookup_duty("8534000000", "CN", taric_data_syntetisk)
    assert resultat["mfn_duty"] == "3.300 %"
    assert resultat["has_fta"] is False  # CN har inget frihandelsavtal i testdatan


def test_preferenstull_japan_hittas_via_landsnamn(taric_data_syntetisk):
    """
    Japan-matchning sker via COUNTRY_NAME_MAP: landskod 'JP' → landsnamn 'Japan'.
    Raden i duties har Origin='Japan', inte 'JP' — koden måste klara båda.
    """
    resultat = lookup_duty("8534.00.00", "JP", taric_data_syntetisk)
    assert resultat["has_fta"] is True
    assert resultat["preferential_duty"] == "0.000 %"
    assert resultat["mfn_duty"] == "3.300 %"  # MFN ska fortfarande returneras


def test_nar_ger_manuell_kontroll_text(taric_data_syntetisk):
    """NAR i Duty-kolumnen betyder specifik tullsats — ska inte tolkas som procent."""
    resultat = lookup_duty("8542.31.90", "CN", taric_data_syntetisk)
    assert "NAR" in resultat["mfn_duty"]
    assert "manuell kontroll" in resultat["mfn_duty"].lower()


def test_saknad_hs_kod_ger_troligen_tullfri(taric_data_syntetisk):
    """HS-kod utan rad i TARIC ska returnera 'troligen tullfri', inte krascha."""
    resultat = lookup_duty("9999999999", "CN", taric_data_syntetisk)
    assert "troligen tullfri" in resultat["mfn_duty"].lower()
    assert resultat["has_fta"] is False


def test_verify_hs_description_hittar_beskrivning_trots_suffix(taric_data_syntetisk):
    """
    Goods code i nomenklaturen har suffix (t.ex. '8534000000 80').
    Matchningen ska ske på de första 10 tecknen — suffix ignoreras.
    """
    resultat = verify_hs_description("8534.00.00", "Elektronikkort", taric_data_syntetisk)
    assert resultat["taric_description"] == "Printed circuits"


def test_verify_hs_description_okand_kod_ger_ej_hittad(taric_data_syntetisk):
    """Okänd HS-kod ska returnera 'Ej hittad', inte krascha."""
    resultat = verify_hs_description("9999999999", "Okänd vara", taric_data_syntetisk)
    assert resultat["taric_description"] == "Ej hittad"


# --- Datumfiltrering: rätt tullsats bland flera rader ---

def test_utgangen_tullsats_valjs_inte(taric_data_syntetisk):
    """
    7318150000 har tre MFN-rader: utgången (9.900 %, t.o.m. 2021),
    giltig (3.700 %, fr.o.m. 2022) och framtida (1.000 %, fr.o.m. 2030).
    Datumfiltret ska välja den GILTIGA satsen — inte den som råkar ligga först.
    """
    resultat = lookup_duty("7318.15.00", "CN", taric_data_syntetisk)
    assert resultat["mfn_duty"] == "3.700 %"


# --- Villkorstullar (Cond:) ---

def test_villkorstull_ger_manuell_kontroll(taric_data_syntetisk):
    """
    Duty som börjar med 'Cond:' är en villkorsbaserad tullsats — den kan
    inte tolkas som en enkel procent och ska flaggas för manuell kontroll,
    inte se ut som tullfri.
    """
    resultat = lookup_duty("2007.10.91", "CN", taric_data_syntetisk)
    assert "manuell kontroll" in resultat["mfn_duty"].lower()
    assert "villkorstull" in resultat["mfn_duty"].lower()


# --- Antidumpningstullar (measure 551-554) ---

def test_antidumpning_hittas_for_ratt_land(taric_data_syntetisk):
    """Stålartiklar (7326909800) från Kina har en giltig antidumpningsrad (86.5 %)."""
    resultat = lookup_antidumping("7326.90.98", "CN", taric_data_syntetisk)
    assert resultat == "86.500 %"


def test_antidumpning_ger_none_for_annat_land(taric_data_syntetisk):
    """Samma vara från Japan har ingen antidumpningstull → None."""
    assert lookup_antidumping("7326.90.98", "JP", taric_data_syntetisk) is None


def test_utgangen_antidumpning_raknas_inte(taric_data_syntetisk):
    """
    Den utgångna ADD-raden (48.100 %, t.o.m. 2020) ska INTE returneras —
    bara den giltiga (86.500 %).
    """
    resultat = lookup_antidumping("7326.90.98", "CN", taric_data_syntetisk)
    assert resultat != "48.100 %"


def test_antidumpning_ger_none_for_kod_utan_add(taric_data_syntetisk):
    """Kretskort (8534000000) har ingen antidumpningsrad alls → None."""
    assert lookup_antidumping("8534.00.00", "CN", taric_data_syntetisk) is None


# --- Integrationstest (kör bara om taric_data/ finns) ---

TARIC_MAPP = os.path.join(os.path.dirname(__file__), "..", "taric_data")

@pytest.mark.skipif(
    not os.path.isdir(TARIC_MAPP),
    reason="taric_data/ saknas — hoppar över integrationstest"
)
def test_riktiga_taric_filer_har_ratt_kolumner():
    """
    Läser de riktiga Excel-filerna och verifierar att förväntade kolumner finns.
    Fångar om EU ändrar filformatet vid en månadsvis uppdatering.
    Verifierar också cachen: andra anropet ska återanvända samma data
    istället för att läsa om 8 MB Excel.
    """
    from taric import load_taric_data
    data = load_taric_data()
    assert load_taric_data() is data  # cache: samma objekt, ingen omläsning

    obligatoriska_duties_kolumner = [
        "Goods code", "Origin", "Origin code", "Duty", "Meas. type code"
    ]
    for kolumn in obligatoriska_duties_kolumner:
        assert kolumn in data["duties"].columns, f"duties saknar kolumn: {kolumn}"

    assert "Goods code" in data["nomenclature"].columns
    assert "Description" in data["nomenclature"].columns
