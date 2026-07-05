"""
core/metadata.py

Granskningsmetadata — spårbarheten som gör revisionsprotokollet
myndighetsklart. Ett protokoll som kan ligga till grund för en
ändringsansökan ska kunna svara på: NÄR gjordes granskningen, MOT VILKEN
version av tulltaxan, MED VILKA AI-modeller och LÄSTES underlaget med OCR?
"""

from collections import Counter
from datetime import datetime

# Systemversionen — höjs vid större förändringar av granskningslogiken.
VERSION = "1.0.0"


def bygg_granskningsmetadata(ocr_anvand: bool = False) -> dict:
    """
    Samlar spårbarhetsuppgifter för aktuell körning.

    Args:
        ocr_anvand: True om något dokument lästes med OCR (mer felbenäget
            underlag — ska framgå i protokollet).

    Returns:
        dict med tidsstämpel, systemversion, AI-anropsstatistik,
        TARIC-ålder/-varning och OCR-status.
    """
    from core.llm_klient import hamta_anropslogg
    from modules.customs.taric import hamta_taric_alder_dagar, kontrollera_taric_alder

    logg = hamta_anropslogg()
    lyckade_per_modell = Counter(
        p["modell"] for p in logg if p["status"] == "lyckat"
    )

    return {
        "tidsstampel": datetime.now().isoformat(timespec="seconds"),
        "systemversion": VERSION,
        "ai_anrop_totalt": len(logg),
        "ai_anrop_per_modell": dict(lyckade_per_modell),
        "taric_alder_dagar": hamta_taric_alder_dagar(),
        "taric_varning": kontrollera_taric_alder(),
        "ocr_anvand": ocr_anvand,
    }
