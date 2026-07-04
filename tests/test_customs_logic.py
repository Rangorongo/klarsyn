"""
test_customs_logic.py

Testar flagglogiken och besparingsberäkningarna i customs_logic.py.

Alla tester använder fixturen `taric_data_patchad` som ersätter
load_taric_data() med syntetisk data — inga Excel-filer eller API-anrop behövs.

Syntetisk TARIC-data som testerna utgår ifrån:
    - HS 8534.00.00 från JP: MFN 3.300 %, preferenstull 0.000 % (FTA finns)
    - HS 8534.00.00 från CN: MFN 3.300 %, inget FTA
    - HS 8542.31.90 från CN: MFN NAR (manuell kontroll), beskrivning finns
    - HS 9999999999 från CN: ingen rad i TARIC (troligen tullfri, beskrivning saknas)
"""

import pytest
from customs_logic import run_customs_audit


def _bygg_faktura(items, shipping_cost=0.0, currency="EUR"):
    """Hjälpfunktion: bygger ett minimalt faktura-dict för tester."""
    return {
        "items": items,
        "shipping_cost": shipping_cost,
        "currency": currency,
    }


def _vara(description="Testvara", hs_code="8534.00.00", country="CN",
          total_price=100.0):
    """Hjälpfunktion: bygger ett minimalt varurad-dict för tester."""
    return {
        "description": description,
        "hs_code": hs_code,
        "country_of_origin": country,
        "quantity": 1,
        "unit_price": total_price,
        "total_item_price": total_price,
    }


def test_saknad_hs_kod_ger_varning(taric_data_patchad):
    """Vara utan HS-kod ska flaggas med ⚠️ och inte krascha."""
    faktura = _bygg_faktura([_vara(hs_code=None)])
    resultat = run_customs_audit(faktura)
    assert any("⚠️" in f and "HS-kod" in f for f in resultat["audit_flags"])


def test_saknat_ursprungsland_ger_varning(taric_data_patchad):
    """Vara utan ursprungsland ska flaggas med ⚠️ och inte krascha."""
    faktura = _bygg_faktura([_vara(country=None)])
    resultat = run_customs_audit(faktura)
    assert any("⚠️" in f and "ursprungsland" in f for f in resultat["audit_flags"])


def test_hs_kod_ej_i_taric_ger_rod_flagga(taric_data_patchad):
    """
    Vara med HS-kod som saknar beskrivning i TARIC-nomenklaturen ska ge 🔴.
    9999999999 finns inte i den syntetiska datan.
    """
    faktura = _bygg_faktura([_vara(hs_code="9999999999", country="CN")])
    resultat = run_customs_audit(faktura)
    assert any("🔴" in f for f in resultat["audit_flags"])


def test_fta_mojlighet_ger_pengar_flagga(taric_data_patchad):
    """
    Vara från Japan med 0%-preferenstull ska generera 💰-flagga
    om frihandelsavtalet verkar oanvänt.
    """
    faktura = _bygg_faktura([_vara(country="JP")])
    resultat = run_customs_audit(faktura)
    assert any("💰" in f for f in resultat["audit_flags"])


def test_mfn_tull_plus_fta_ger_euro_flagga_och_ratt_belopp(taric_data_patchad):
    """
    Vara från Japan med MFN 3.300% och FTA ska ge 💶-flagga med korrekt belopp.
    Tullvärde = varupris + frakt: 100 + 50 = 150 EUR.
    Beräknad tull: 150 × 0.033 = 4.95 EUR.
    """
    faktura = _bygg_faktura([_vara(country="JP", total_price=100.0)], shipping_cost=50.0)
    resultat = run_customs_audit(faktura)
    assert any("💶" in f for f in resultat["audit_flags"])
    assert resultat["potential_savings"] == pytest.approx(4.95)


def test_frakt_delas_jamnt_over_alla_varor(taric_data_patchad):
    """
    Frakten ska delas jämnt över alla varor i tullvärdesberäkningen.
    2 varor, frakt 100 → varje vara får 50 i frakttillägg.
    Vara 1: (100 + 50) × 0.033 = 4.95
    Vara 2: (200 + 50) × 0.033 = 8.25
    Totalt: 13.20 EUR
    """
    varor = [
        _vara(description="Vara 1", country="JP", total_price=100.0),
        _vara(description="Vara 2", country="JP", total_price=200.0),
    ]
    faktura = _bygg_faktura(varor, shipping_cost=100.0)
    resultat = run_customs_audit(faktura)
    assert resultat["potential_savings"] == pytest.approx(13.20)


def test_nar_tull_ger_lupp_flagga(taric_data_patchad):
    """Vara med NAR-tullsats ska flaggas med 🔍 för manuell kontroll."""
    faktura = _bygg_faktura([_vara(hs_code="8542.31.90", country="CN")])
    resultat = run_customs_audit(faktura)
    assert any("🔍" in f for f in resultat["audit_flags"])


def test_potential_savings_summeras_och_avrundas(taric_data_patchad):
    """
    potential_savings ska vara summan av alla 💶-besparingar, avrundad till 2 decimaler.
    Vara A: 10 × 0.033 = 0.33
    Vara B: 20 × 0.033 = 0.66
    Totalt: 0.99
    """
    varor = [
        _vara(description="Vara A", country="JP", total_price=10.0),
        _vara(description="Vara B", country="JP", total_price=20.0),
    ]
    faktura = _bygg_faktura(varor, shipping_cost=0.0)
    resultat = run_customs_audit(faktura)
    assert resultat["potential_savings"] == pytest.approx(0.99)
    # Verifiera att värdet faktiskt är avrundat till 2 decimaler
    assert resultat["potential_savings"] == round(resultat["potential_savings"], 2)
