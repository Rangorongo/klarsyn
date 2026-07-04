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


def _bygg_faktura(items, shipping_cost=0.0, currency="EUR", total_invoice_amount=None):
    """Hjälpfunktion: bygger ett minimalt faktura-dict för tester."""
    return {
        "items": items,
        "shipping_cost": shipping_cost,
        "currency": currency,
        "total_invoice_amount": total_invoice_amount,
    }


def _vara(description="Testvara", hs_code="8534.00.00", country="CN",
          total_price=100.0, quantity=1, unit_price=None,
          confidence=None, review_note=None):
    """
    Hjälpfunktion: bygger ett minimalt varurad-dict för tester.

    Om unit_price inte anges räknas det ut så att aritmetiken stämmer
    (antal × styckpris = radpris) — tester som VILL ha räknefel
    skickar in ett avvikande unit_price själva.
    """
    if unit_price is None:
        unit_price = total_price / quantity
    return {
        "description": description,
        "hs_code": hs_code,
        "country_of_origin": country,
        "quantity": quantity,
        "unit_price": unit_price,
        "total_item_price": total_price,
        "confidence": confidence,
        "review_note": review_note,
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


# --- Aritmetikkontroller (🧮) ---

def test_raknefel_pa_varurad_ger_flagga(taric_data_patchad):
    """2 × 10 = 20, men radpriset säger 25 — ska ge 🧮-flagga med båda beloppen."""
    faktura = _bygg_faktura([_vara(quantity=2, unit_price=10.0, total_price=25.0)])
    resultat = run_customs_audit(faktura)
    raknefel = [f for f in resultat["audit_flags"] if "🧮" in f]
    assert len(raknefel) == 1
    assert "20.00" in raknefel[0] and "25.00" in raknefel[0]


def test_korrekt_aritmetik_ger_ingen_flagga(taric_data_patchad):
    """2 × 10 = 20 och radpriset är 20 — ingen 🧮-flagga."""
    faktura = _bygg_faktura([_vara(quantity=2, unit_price=10.0, total_price=20.0)])
    resultat = run_customs_audit(faktura)
    assert not any("🧮" in f for f in resultat["audit_flags"])


def test_avrundningsoren_flaggas_inte(taric_data_patchad):
    """Avvikelse under toleransen (1 öre / 0,5 %) ska inte ge falsklarm."""
    # 3 × 33.333333 = 99.999999 ≈ radpris 100.00 — skillnad under 1 öre
    faktura = _bygg_faktura([_vara(quantity=3, unit_price=33.333333, total_price=100.0)])
    resultat = run_customs_audit(faktura)
    assert not any("🧮" in f for f in resultat["audit_flags"])


def test_raknefel_flaggas_aven_utan_hs_kod(taric_data_patchad):
    """Aritmetikkontrollen ska köras även om varan saknar HS-kod."""
    faktura = _bygg_faktura([_vara(hs_code=None, quantity=2, unit_price=10.0, total_price=25.0)])
    resultat = run_customs_audit(faktura)
    assert any("🧮" in f for f in resultat["audit_flags"])
    assert any("⚠️" in f for f in resultat["audit_flags"])  # HS-varningen ska också finnas kvar


def test_fakturatotal_som_inte_stammer_ger_flagga(taric_data_patchad):
    """Radsumma 100 + frakt 10 = 110, men fakturan anger 150 — ska ge 🧮-flagga."""
    faktura = _bygg_faktura(
        [_vara(total_price=100.0)],
        shipping_cost=10.0,
        total_invoice_amount=150.0,
    )
    resultat = run_customs_audit(faktura)
    assert any("🧮" in f and "totalbelopp" in f.lower() for f in resultat["audit_flags"])


def test_korrekt_fakturatotal_ger_ingen_flagga(taric_data_patchad):
    """Radsumma 100 + frakt 10 = 110 och fakturan anger 110 — ingen 🧮-flagga."""
    faktura = _bygg_faktura(
        [_vara(total_price=100.0)],
        shipping_cost=10.0,
        total_invoice_amount=110.0,
    )
    resultat = run_customs_audit(faktura)
    assert not any("🧮" in f and "totalbelopp" in f.lower() for f in resultat["audit_flags"])


# --- Konfidensflagga (🟡) ---

def test_lag_konfidens_ger_gul_flagga_med_review_note(taric_data_patchad):
    """Vara med confidence='låg' ska flaggas med 🟡 och AI:ns förklaring."""
    faktura = _bygg_faktura([
        _vara(confidence="låg", review_note="HS-koden är svårläst i fakturatexten")
    ])
    resultat = run_customs_audit(faktura)
    gula = [f for f in resultat["audit_flags"] if "🟡" in f]
    assert len(gula) == 1
    assert "HS-koden är svårläst i fakturatexten" in gula[0]


def test_hog_konfidens_ger_ingen_gul_flagga(taric_data_patchad):
    """Vara med confidence='hög' ska INTE få någon 🟡-flagga."""
    faktura = _bygg_faktura([_vara(confidence="hög")])
    resultat = run_customs_audit(faktura)
    assert not any("🟡" in f for f in resultat["audit_flags"])


# --- Ärlig besparingsformulering (💶) ---

def test_besparingsflaggan_ar_arligt_formulerad(taric_data_patchad):
    """
    💶-flaggan får inte lova pengar: den ska tydligt säga att beloppet
    bara gäller OM MFN-tull betalades, och hänvisa till importdeklarationen.
    """
    faktura = _bygg_faktura([_vara(country="JP")])
    resultat = run_customs_audit(faktura)
    euro_flaggor = [f for f in resultat["audit_flags"] if "💶" in f]
    assert len(euro_flaggor) == 1
    assert "om MFN-tull betalades" in euro_flaggor[0]
    assert "importdeklarationen" in euro_flaggor[0]


def test_eu_vara_far_ingen_besparingsflagga(taric_data_patchad):
    """
    EU-varor (t.ex. Polen) har ingen importtull alls — det finns inget att
    'spara'. En 💰-flagga vore vilseledande brus för kunden.
    """
    faktura = _bygg_faktura([_vara(country="PL")])
    resultat = run_customs_audit(faktura)
    assert not any("💰" in f for f in resultat["audit_flags"])
    assert not any("💶" in f for f in resultat["audit_flags"])


# --- Konfidensarkitekturen: slutdom per vara (grön/gul/röd) ---

def test_allt_stammer_ger_gron_dom(taric_data_patchad):
    """Vara där alla signaler är ok och AI säger 'ja' ska få domen grön."""
    faktura = _bygg_faktura([_vara()])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "grön"


def test_ai_sager_nej_ger_rod_dom_och_flagga(taric_data_patchad, monkeypatch):
    """AI-bedömning 'nej' = trolig felklassificering → röd dom + 🔴-flagga med motivering."""
    monkeypatch.setattr(
        "customs_logic.verify_hs_matches",
        lambda rader: {r["index"]: ("nej", "Beskrivningen avser en helt annan varutyp.") for r in rader}
    )
    faktura = _bygg_faktura([_vara()])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "röd"
    assert any(
        "🔴" in f and "Beskrivningen avser en helt annan varutyp." in f
        for f in resultat["audit_flags"]
    )


def test_ai_sager_osaker_ger_gul_dom(taric_data_patchad, monkeypatch):
    """AI-bedömning 'osäker' ska ge gul dom."""
    monkeypatch.setattr(
        "customs_logic.verify_hs_matches",
        lambda rader: {r["index"]: ("osäker", "Beskrivningen är för vag.") for r in rader}
    )
    faktura = _bygg_faktura([_vara()])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "gul"


def test_misslyckad_ai_verifiering_ger_gul_dom(taric_data_patchad, monkeypatch):
    """
    Om AI-verifieringen inte kan köras (kvot slut → None) ska varan bli gul
    med en notering — pipelinen får ALDRIG krascha på kvotfel.
    """
    monkeypatch.setattr("customs_logic.verify_hs_matches", lambda rader: None)
    faktura = _bygg_faktura([_vara()])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "gul"
    assert any("kunde inte köras" in skal for skal in resultat["items"][0]["verdict_reasons"])


def test_raknefel_ger_rod_dom(taric_data_patchad):
    """Räknefel på raden är en hård motsägelse → röd dom, även om AI säger 'ja'."""
    faktura = _bygg_faktura([_vara(quantity=2, unit_price=10.0, total_price=25.0)])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "röd"


def test_lag_konfidens_ger_gul_dom(taric_data_patchad):
    """Låg konfidens från självkontrollen → gul dom (om inget rött finns)."""
    faktura = _bygg_faktura([_vara(confidence="låg", review_note="Otydlig text")])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "gul"


def test_saknad_hs_kod_ger_rod_dom(taric_data_patchad):
    """Utan HS-kod kan varan inte granskas alls → röd dom."""
    faktura = _bygg_faktura([_vara(hs_code=None)])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "röd"


def test_hs_kod_ej_i_taric_ger_rod_dom(taric_data_patchad):
    """HS-kod som inte finns i TARIC → röd dom."""
    faktura = _bygg_faktura([_vara(hs_code="9999999999")])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "röd"


def test_nar_ger_gul_dom(taric_data_patchad):
    """NAR-tullsats kräver manuell kontroll → gul dom (om inget rött finns)."""
    faktura = _bygg_faktura([_vara(hs_code="8542.31.90")])
    resultat = run_customs_audit(faktura)
    assert resultat["items"][0]["verdict"] == "gul"


def test_verdict_summary_raknar_ratt(taric_data_patchad):
    """verdict_summary ska räkna antal gröna/gula/röda över alla varor."""
    varor = [
        _vara(description="Grön vara"),
        _vara(description="Gul vara", confidence="låg", review_note="Otydligt"),
        _vara(description="Röd vara", hs_code=None),
    ]
    resultat = run_customs_audit(_bygg_faktura(varor))
    assert resultat["verdict_summary"] == {"grön": 1, "gul": 1, "röd": 1}


def test_verdict_reasons_forklarar_domen(taric_data_patchad):
    """Domen ska alltid åtföljas av begripliga skäl i verdict_reasons."""
    faktura = _bygg_faktura([_vara(confidence="låg", review_note="Otydlig HS-kod i texten")])
    resultat = run_customs_audit(faktura)
    skal = resultat["items"][0]["verdict_reasons"]
    assert len(skal) >= 1
    assert any("konfidens" in s.lower() for s in skal)
