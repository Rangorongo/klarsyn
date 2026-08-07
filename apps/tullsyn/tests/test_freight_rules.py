"""
test_freight_rules.py

Testar fraktmodulens granskningsregler (modules/freight/rules.py) —
helt kvotfritt, inga AI-anrop.
"""

import pytest
from modules.freight.facit import hamta_divisor
from modules.freight.rules import run_freight_audit


def _sandning(tracking="JD014600003SE", actual=8.0, billed=8.0,
              l=None, b=None, h=None, base=100.0, surcharges=None,
              total=None, confidence=None, review_note=None):
    """
    Hjälpfunktion: bygger en sändning där summorna stämmer om inget
    annat anges. Tester som VILL ha fel skickar in avvikande värden.
    """
    surcharges = surcharges if surcharges is not None else []
    if total is None:
        total = base + sum(s["amount"] for s in surcharges)
    return {
        "tracking_number": tracking,
        "ship_date": "2026-06-15",
        "origin": "Göteborg",
        "destination": "Hamburg",
        "service_level": "Express",
        "actual_weight_kg": actual,
        "billed_weight_kg": billed,
        "length_cm": l, "width_cm": b, "height_cm": h,
        "base_freight": base,
        "surcharges": surcharges,
        "total_charge": total,
        "confidence": confidence,
        "review_note": review_note,
    }


def _faktura(shipments, total=None, carrier="DHL Express"):
    """Hjälpfunktion: bygger en fraktfaktura där totalen stämmer som standard."""
    if total is None:
        total = sum(s["total_charge"] or 0 for s in shipments)
    return {
        "invoice_number": "FRAKT-2026-001",
        "invoice_date": "2026-06-30",
        "carrier_name": carrier,
        "currency": "EUR",
        "total_invoice_amount": total,
        "shipments": shipments,
    }


# --- Dubbeldebitering ---

def test_dubbeldebitering_ger_rod_dom_och_besparing():
    """Samma tracking-nummer två gånger → 🔴, röd dom och dubblettens belopp som besparing."""
    faktura = _faktura([
        _sandning(tracking="JD111", base=200.0),
        _sandning(tracking="JD111", base=200.0),
    ])
    resultat = run_freight_audit(faktura)
    assert any("🔴" in f and "JD111" in f for f in resultat["audit_flags"])
    assert resultat["shipments"][1]["verdict"] == "röd"
    assert resultat["potential_savings"] == pytest.approx(200.0)


def test_sandning_utan_tracking_ger_gul_dom():
    """Utan tracking-nummer kan dubbletter inte kontrolleras → ⚠️ och gul dom."""
    faktura = _faktura([_sandning(tracking=None)])
    resultat = run_freight_audit(faktura)
    assert any("⚠️" in f and "dubblettkontroll" in f.lower() for f in resultat["audit_flags"])
    assert resultat["shipments"][0]["verdict"] == "gul"


# --- Volymvikt ---

def test_overdebiterad_vikt_ger_rod_dom():
    """
    Mått 50×40×30 cm → volymvikt 60000/5000 = 12 kg. Verklig vikt 8 kg.
    Debiterad vikt ska vara max(8, 12) = 12 kg — 14.5 kg är överdebiterat.
    """
    faktura = _faktura([_sandning(actual=8.0, billed=14.5, l=50, b=40, h=30)])
    resultat = run_freight_audit(faktura)
    assert any("🧮" in f and "vikt" in f.lower() for f in resultat["audit_flags"])
    assert resultat["shipments"][0]["verdict"] == "röd"


def test_korrekt_volymvikt_ger_ingen_flagga():
    """Debiterad vikt = volymvikten → inget fel."""
    faktura = _faktura([_sandning(actual=8.0, billed=12.0, l=50, b=40, h=30)])
    resultat = run_freight_audit(faktura)
    assert not any("vikt" in f.lower() and "🧮" in f for f in resultat["audit_flags"])


def test_vikttolerans_ger_ingen_falsklarm():
    """Avrundning uppåt inom 0,5 kg ska inte flaggas."""
    faktura = _faktura([_sandning(actual=8.0, billed=12.4, l=50, b=40, h=30)])
    resultat = run_freight_audit(faktura)
    assert not any("vikt" in f.lower() and "🧮" in f for f in resultat["audit_flags"])


def test_divisor_hamtas_per_transportor():
    """TNT använder divisor 4000; okända transportörer får standard 5000."""
    assert hamta_divisor("TNT Express") == 4000
    assert hamta_divisor("DHL Express Sweden") == 5000
    assert hamta_divisor("Okänd Frakt AB") == 5000
    assert hamta_divisor(None) == 5000


# --- Summakontroller ---

def test_radsumma_fel_ger_rod_dom_och_besparing():
    """Grundfrakt 100 + tillägg 20 = 120, men total 135 → 🧮, röd, 15 i besparing."""
    faktura = _faktura([
        _sandning(base=100.0, surcharges=[{"name": "Bränsle", "amount": 20.0, "percentage": None}],
                  total=135.0)
    ])
    resultat = run_freight_audit(faktura)
    assert any("🧮" in f for f in resultat["audit_flags"])
    assert resultat["shipments"][0]["verdict"] == "röd"
    assert resultat["potential_savings"] == pytest.approx(15.0)


def test_radsumma_inom_tolerans_ger_ingen_flagga():
    """Öresavvikelse (0,03) ska inte flaggas."""
    faktura = _faktura([_sandning(base=100.0, total=100.03)])
    resultat = run_freight_audit(faktura)
    assert not any("🧮" in f for f in resultat["audit_flags"])


def test_fakturatotal_fel_ger_flagga():
    """Sändningar på 100 + 200 = 300, fakturan anger 350 → 🧮 på fakturanivå."""
    faktura = _faktura(
        [_sandning(tracking="A1", base=100.0), _sandning(tracking="B2", base=200.0)],
        total=350.0,
    )
    resultat = run_freight_audit(faktura)
    assert any("🧮" in f and "totalbelopp" in f.lower() for f in resultat["audit_flags"])


# --- Procenttillägg ---

def test_orimligt_procenttillagg_ger_gul_dom():
    """Bränsletillägg på 38 % är över taket (35 %) → 🔍 och gul dom."""
    faktura = _faktura([
        _sandning(base=100.0, surcharges=[{"name": "Bränsletillägg", "amount": 38.0, "percentage": 38.0}])
    ])
    resultat = run_freight_audit(faktura)
    assert any("🔍" in f for f in resultat["audit_flags"])
    assert resultat["shipments"][0]["verdict"] == "gul"


def test_normalt_procenttillagg_ger_ingen_flagga():
    """22,5 % bränsletillägg är normalt → ingen flagga."""
    faktura = _faktura([
        _sandning(base=100.0, surcharges=[{"name": "Bränsletillägg", "amount": 22.5, "percentage": 22.5}])
    ])
    resultat = run_freight_audit(faktura)
    assert not any("🔍" in f for f in resultat["audit_flags"])


# --- Konfidens och domar ---

def test_lag_konfidens_ger_gul_dom():
    """Sändning med confidence='låg' → 🟡 med review_note och gul dom."""
    faktura = _faktura([_sandning(confidence="låg", review_note="Vikten är otydligt angiven")])
    resultat = run_freight_audit(faktura)
    assert any("🟡" in f and "Vikten är otydligt angiven" in f for f in resultat["audit_flags"])
    assert resultat["shipments"][0]["verdict"] == "gul"


def test_felfri_faktura_ger_gron_dom():
    """En helt korrekt sändning ska bli grön, utan flaggor och utan åtgärder."""
    faktura = _faktura([_sandning()])
    resultat = run_freight_audit(faktura)
    assert resultat["shipments"][0]["verdict"] == "grön"
    assert resultat["verdict_summary"] == {"grön": 1, "gul": 0, "röd": 0}
    assert resultat["action_items"] == []
    assert resultat["potential_savings"] == 0.0


# --- Findings och åtgärder ---

def test_dubbeldebitering_ger_finding_och_hog_atgard():
    """Fyndstrukturen ska innehålla kategori, belopp, referens och åtgärd."""
    faktura = _faktura([
        _sandning(tracking="JD222", base=150.0),
        _sandning(tracking="JD222", base=150.0),
    ])
    resultat = run_freight_audit(faktura)

    dubbletter = [f for f in resultat["findings"] if f["kategori"] == "DUBBELDEBITERING"]
    assert len(dubbletter) == 1
    assert dubbletter[0]["modul"] == "frakt"
    assert dubbletter[0]["belopp"] == pytest.approx(150.0)
    assert "JD222" in dubbletter[0]["referens"]

    assert any(
        a["prioritet"] == "hög" and "kreditering" in a["atgard"].lower()
        for a in resultat["action_items"]
    )
