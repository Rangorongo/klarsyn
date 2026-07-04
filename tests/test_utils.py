"""
test_utils.py

Rök-test för PDF-rapporten: bygger representativ fakturadata (med domar,
åtgärder och flaggor) och verifierar att save_to_pdf producerar en fil
utan att krascha.

Testet skippas automatiskt på datorer utan Arial-fonterna
(de behövs för å/ä/ö och finns bara på Windows).
"""

import os
import pytest
from utils import save_to_pdf

ARIAL_FINNS = os.path.exists("C:/Windows/Fonts/arial.ttf") and os.path.exists("C:/Windows/Fonts/arialbd.ttf")


@pytest.mark.skipif(not ARIAL_FINNS, reason="Arial-fonter saknas — PDF-testet kräver Windows")
def test_save_to_pdf_skapar_fil_med_full_data(tmp_path):
    """En komplett granskning med alla sorters innehåll ska ge en giltig PDF-fil."""
    final_data = {
        "invoice_number": "INV-2026-001",
        "invoice_date": "2026-07-01",
        "supplier_name": "Test Electronics Ltd",
        "currency": "EUR",
        "shipping_cost": 100.0,
        "total_invoice_amount": 9700.0,
        "items": [
            {
                "description": "Elektronikkort",
                "hs_code": "8534.00.00",
                "country_of_origin": "JP",
                "quantity": 10,
                "unit_price": 50.0,
                "total_item_price": 500.0,
                "taric_description": "Printed circuits",
                "taric_mfn_duty": "3.300 %",
                "verdict": "grön",
                "verdict_reasons": ["Alla kontroller överens"],
            },
            {
                "description": "Mystisk vara med väldigt lång beskrivning " * 5,
                "hs_code": None,
                "country_of_origin": "CN",
                "quantity": 1,
                "unit_price": 100.0,
                "total_item_price": 100.0,
                "verdict": "röd",
                "verdict_reasons": ["HS-kod saknas — varan kan inte granskas mot TARIC"],
            },
        ],
        "audit_flags": [
            "⚠️ Saknar HS-kod: Mystisk vara",
            "💶 Möjlig återbetalning för Elektronikkort: upp till 18.15 EUR — "
            "gäller endast om MFN-tull betalades vid importen, kontrollera importdeklarationen",
        ],
        "action_items": [
            {"prioritet": "hög", "atgard": "Komplettera fakturaunderlaget: Mystisk vara saknar HS-kod."},
            {"prioritet": "medel", "atgard": "Begär ursprungsintyg (EUR.1/REX) för Elektronikkort."},
        ],
        "potential_savings": 18.15,
        "verdict_summary": {"grön": 1, "gul": 0, "röd": 1},
    }

    pdf_fil = tmp_path / "rapport.pdf"
    save_to_pdf(final_data, str(pdf_fil))

    assert pdf_fil.exists()
    assert pdf_fil.stat().st_size > 1000  # en riktig PDF, inte en tom fil


@pytest.mark.skipif(not ARIAL_FINNS, reason="Arial-fonter saknas — PDF-testet kräver Windows")
def test_save_to_pdf_klarar_manga_varor_utan_krasch(tmp_path):
    """
    30 varor ska ge sidbrytningar — inte innehåll utanför papperskanten.
    (Gamla canvas-rapporten kraschade inte men skrev osynligt; platypus
    bryter sida automatiskt. Testet säkrar att inga exceptions kastas.)
    """
    varor = [
        {
            "description": f"Vara nummer {i}",
            "hs_code": "8534.00.00",
            "country_of_origin": "CN",
            "quantity": 1,
            "unit_price": 10.0,
            "total_item_price": 10.0,
            "taric_description": "Printed circuits",
            "taric_mfn_duty": "3.300 %",
            "verdict": "grön",
            "verdict_reasons": ["Alla kontroller överens"],
        }
        for i in range(30)
    ]
    final_data = {
        "invoice_number": "INV-MÅNGA",
        "invoice_date": "2026-07-01",
        "supplier_name": "Bulk Import AB",
        "currency": "EUR",
        "shipping_cost": 0.0,
        "total_invoice_amount": 300.0,
        "items": varor,
        "audit_flags": [],
        "action_items": [],
        "potential_savings": 0.0,
        "verdict_summary": {"grön": 30, "gul": 0, "röd": 0},
    }

    pdf_fil = tmp_path / "many.pdf"
    save_to_pdf(final_data, str(pdf_fil))
    assert pdf_fil.exists()


@pytest.mark.skipif(not ARIAL_FINNS, reason="Arial-fonter saknas — PDF-testet kräver Windows")
def test_save_batch_summary_skapar_oversikt(tmp_path):
    """Batchöversikten ska sammanfatta flera fakturor + lista misslyckade."""
    from utils import save_batch_summary

    granskningar = [
        {
            "invoice_number": "INV-001",
            "supplier_name": "Leverantör A",
            "currency": "EUR",
            "potential_savings": 120.50,
            "verdict_summary": {"grön": 3, "gul": 1, "röd": 0},
        },
        {
            "invoice_number": "INV-002",
            "supplier_name": "Leverantör B",
            "currency": "EUR",
            "potential_savings": 0.0,
            "verdict_summary": {"grön": 1, "gul": 0, "röd": 2},
        },
    ]
    pdf_fil = tmp_path / "batch_sammanfattning.pdf"
    save_batch_summary(granskningar, ["trasig_faktura.pdf"], str(pdf_fil))

    assert pdf_fil.exists()
    assert pdf_fil.stat().st_size > 1000
