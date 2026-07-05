"""
test_metadata_valuta.py

Testar granskningsmetadatan, TARIC-färskhetsvarningen och
SEK-konverteringen — kvotfritt och utan nätverk (ECB mockas).
"""

import os
import time

import pytest

import core.valuta as valuta
from core.metadata import bygg_granskningsmetadata
from modules.customs.taric import kontrollera_taric_alder


# --- TARIC-färskhet ---

def test_farsk_taric_ger_ingen_varning(tmp_path):
    """Nyss nedladdade filer ska inte ge någon varning."""
    (tmp_path / "Duties.xlsx").write_bytes(b"x")
    assert kontrollera_taric_alder(max_dagar=35, taric_dir=str(tmp_path)) is None


def test_gammal_taric_ger_varning(tmp_path):
    """Filer äldre än gränsen ska ge en varning som nämner CIRCABC."""
    fil = tmp_path / "Duties.xlsx"
    fil.write_bytes(b"x")
    gammal_tid = time.time() - 60 * 86400  # 60 dagar sedan
    os.utime(fil, (gammal_tid, gammal_tid))

    varning = kontrollera_taric_alder(max_dagar=35, taric_dir=str(tmp_path))
    assert varning is not None
    assert "CIRCABC" in varning


def test_saknad_taric_ger_varning(tmp_path):
    """Tom mapp ska ge varning — inte krasch."""
    varning = kontrollera_taric_alder(taric_dir=str(tmp_path))
    assert "saknas" in varning


# --- Granskningsmetadata ---

def test_metadata_innehaller_sparbarhetsfalten():
    """Metadatan ska ha alla fält protokollet behöver."""
    metadata = bygg_granskningsmetadata(ocr_anvand=True)
    for falt in ("tidsstampel", "systemversion", "ai_anrop_totalt",
                 "ai_anrop_per_modell", "taric_alder_dagar", "ocr_anvand"):
        assert falt in metadata
    assert metadata["ocr_anvand"] is True


# --- SEK-konvertering ---

_FEJKKURSER = {"datum": "2026-07-04", "kurser": {"SEK": 11.30, "USD": 1.08}}


def test_eur_till_sek(monkeypatch):
    monkeypatch.setattr(valuta, "_hamta_fran_ecb", lambda: _FEJKKURSER)
    kurs, datum = valuta.hamta_sek_kurs("EUR")
    assert kurs == pytest.approx(11.30)
    assert datum == "2026-07-04"


def test_usd_till_sek_via_eur_kors(monkeypatch):
    """SEK per USD = 11.30 / 1.08 ≈ 10.463."""
    monkeypatch.setattr(valuta, "_hamta_fran_ecb", lambda: _FEJKKURSER)
    kurs, _ = valuta.hamta_sek_kurs("USD")
    assert kurs == pytest.approx(11.30 / 1.08, abs=0.001)


def test_sek_ar_alltid_ett():
    kurs, _ = valuta.hamta_sek_kurs("SEK")
    assert kurs == 1.0


def test_natverksfel_faller_tillbaka_pa_cache(monkeypatch, tmp_path):
    """Vid nätverksfel ska cachade kurser användas — inte krasch."""
    cache = tmp_path / "valutakurser.json"
    import json
    cache.write_text(json.dumps(_FEJKKURSER), encoding="utf-8")

    def natverksfel():
        raise OSError("ingen internetanslutning")

    monkeypatch.setattr(valuta, "_hamta_fran_ecb", natverksfel)
    monkeypatch.setattr(valuta, "CACHE_FIL", str(cache))

    kurs, datum = valuta.hamta_sek_kurs("EUR")
    assert kurs == pytest.approx(11.30)


def test_natverksfel_utan_cache_ger_none(monkeypatch, tmp_path):
    """Utan nät OCH utan cache ska konverteringen hoppa över — (None, None)."""
    def natverksfel():
        raise OSError("ingen internetanslutning")

    monkeypatch.setattr(valuta, "_hamta_fran_ecb", natverksfel)
    monkeypatch.setattr(valuta, "CACHE_FIL", str(tmp_path / "finns_inte.json"))

    assert valuta.hamta_sek_kurs("EUR") == (None, None)
