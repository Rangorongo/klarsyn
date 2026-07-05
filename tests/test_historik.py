"""
test_historik.py

Testar kundregistret och dubbletthistoriken — SQLite i temporär fil,
helt kvotfritt.
"""

from core.historik import kontrollera_tracking_historik, registrera_sandningar
from modules.freight.rules import run_freight_audit


def _sandning(tracking, total=100.0):
    return {"tracking_number": tracking, "total_charge": total, "surcharges": [],
            "base_freight": total, "confidence": None, "review_note": None}


def test_ny_kund_har_ingen_historik(tmp_path):
    db = str(tmp_path / "test.db")
    assert kontrollera_tracking_historik("kund_a", ["JD111"], db_fil=db) == {}


def test_registrerad_sandning_hittas_vid_nasta_kontroll(tmp_path):
    db = str(tmp_path / "test.db")
    registrera_sandningar("kund_a", "FAKTURA-1", [_sandning("JD111")], db_fil=db)

    traffar = kontrollera_tracking_historik("kund_a", ["JD111", "JD222"], db_fil=db)
    assert traffar == {"JD111": "FAKTURA-1"}


def test_kunder_ar_isolerade_fran_varandra(tmp_path):
    """Kund B:s sändningar får ALDRIG flagga mot kund A:s historik."""
    db = str(tmp_path / "test.db")
    registrera_sandningar("kund_a", "FAKTURA-1", [_sandning("JD111")], db_fil=db)

    assert kontrollera_tracking_historik("kund_b", ["JD111"], db_fil=db) == {}


def test_matchning_ar_skiftlagesokanslig(tmp_path):
    """jd111 och JD111 är samma sändning."""
    db = str(tmp_path / "test.db")
    registrera_sandningar("kund_a", "FAKTURA-1", [_sandning("jd111")], db_fil=db)

    traffar = kontrollera_tracking_historik("kund_a", ["JD111"], db_fil=db)
    assert "JD111" in traffar


def test_historiktraff_ger_rod_dom_och_besparing_i_fraktrevisionen():
    """
    En sändning som redan debiterats på en TIDIGARE faktura ska ge
    🔴-flagga, röd dom, besparing och ett DUBBELDEBITERING-fynd.
    """
    faktura = {
        "invoice_number": "FAKTURA-2",
        "currency": "EUR",
        "carrier_name": "DHL",
        "total_invoice_amount": 200.0,
        "shipments": [_sandning("JD111", total=200.0)],
    }
    resultat = run_freight_audit(faktura, historik_traffar={"JD111": "FAKTURA-1"})

    assert any("🔴" in f and "FAKTURA-1" in f for f in resultat["audit_flags"])
    assert resultat["shipments"][0]["verdict"] == "röd"
    assert resultat["potential_savings"] == 200.0
    fynd = [f for f in resultat["findings"] if f["kategori"] == "DUBBELDEBITERING"]
    assert len(fynd) == 1
    assert "FAKTURA-1" in fynd[0]["beskrivning"]
