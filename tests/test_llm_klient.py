"""
test_llm_klient.py

Testar modellrotationen i llm_klient.py — helt utan riktiga API-anrop.
Fejk-LLM:er simulerar kvotfel (429), serverfel (503) och lyckade svar.
"""

import pytest
import llm_klient


class _FejkStructured:
    """Låtsas vara en structured-output-LLM: svarar eller kastar enligt manus."""

    def __init__(self, beteende):
        self.beteende = beteende  # lista av svar/exceptions, ett per anrop

    def invoke(self, meddelanden):
        steg = self.beteende.pop(0)
        if isinstance(steg, Exception):
            raise steg
        return steg


class _FejkLLM:
    def __init__(self, structured):
        self.structured = structured

    def with_structured_output(self, schema):
        return self.structured


def _fejka_modeller(monkeypatch, manus):
    """
    Ersätter _skapa_llm med fejkar enligt manus: {modellnamn: [beteenden]}.
    Loggar även vilka modeller som faktiskt skapades.
    """
    skapade = []

    def fejk_skapa(modell):
        skapade.append(modell)
        return _FejkLLM(_FejkStructured(manus[modell]))

    monkeypatch.setattr(llm_klient, "_skapa_llm", fejk_skapa)
    return skapade


def test_kvotfel_roterar_till_nasta_modell(monkeypatch):
    """429 på första modellen ska ge automatiskt byte till nästa — inte krasch."""
    skapade = _fejka_modeller(monkeypatch, {
        llm_klient.MODELLER[0]: [Exception("429 RESOURCE_EXHAUSTED: kvot slut")],
        llm_klient.MODELLER[1]: ["svar från modell 2"],
    })
    resultat = llm_klient.anropa_strukturerat("testprompt", schema=None)
    assert resultat == "svar från modell 2"
    assert skapade == [llm_klient.MODELLER[0], llm_klient.MODELLER[1]]


def test_serverfel_vantar_och_forsoker_samma_modell_igen(monkeypatch):
    """503 ska ge en väntan och ETT nytt försök på samma modell."""
    monkeypatch.setattr(llm_klient.time, "sleep", lambda s: None)  # ingen riktig väntan i test
    skapade = _fejka_modeller(monkeypatch, {
        llm_klient.MODELLER[0]: [Exception("503 UNAVAILABLE"), "svar efter retry"],
    })
    resultat = llm_klient.anropa_strukturerat("testprompt", schema=None)
    assert resultat == "svar efter retry"
    assert skapade == [llm_klient.MODELLER[0]]  # ingen rotation behövdes


def test_alla_modeller_slut_ger_tydligt_fel(monkeypatch):
    """När ALLA modeller ger kvotfel ska ett begripligt fel kastas."""
    _fejka_modeller(monkeypatch, {
        modell: [Exception("429 RESOURCE_EXHAUSTED")] for modell in llm_klient.MODELLER
    })
    with pytest.raises(RuntimeError, match="Alla Gemini-modeller"):
        llm_klient.anropa_strukturerat("testprompt", schema=None)


def test_okant_fel_propageras_direkt(monkeypatch):
    """Fel som inte är kvot/server (t.ex. programmeringsfel) ska INTE döljas av rotation."""
    _fejka_modeller(monkeypatch, {
        llm_klient.MODELLER[0]: [ValueError("trasig prompt")],
    })
    with pytest.raises(ValueError, match="trasig prompt"):
        llm_klient.anropa_strukturerat("testprompt", schema=None)
