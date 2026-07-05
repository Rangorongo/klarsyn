"""
llm_klient.py

Gemensam Gemini-klient med automatisk modellrotation — projektets enda
väg ut mot AI:n. Både extractor.py och verifier.py anropar via denna modul.

Varför rotation?
    Varje Gemini-gratismodell har sin EGEN dagskvot (20 anrop). När
    gemini-2.5-flash-lite tar slut (429) provar vi nästa modell i listan —
    den effektiva dagskvoten flerdubblas utan att det kostar något.

Felhantering:
    - 429 / RESOURCE_EXHAUSTED (kvot slut) → prova nästa modell
    - 503 / UNAVAILABLE (server överlastad) → vänta 30 s, försök samma
      modell igen, därefter nästa modell
    - Andra fel (t.ex. trasig prompt) → propagera direkt, döljs ALDRIG
    - Alla modeller slut → tydligt RuntimeError på svenska

LLM:en skapas inuti anropet — modulen kan importeras utan API-nyckel
(viktigt för tester och CI), och nyckeln byts i .env utan kodändringar.
"""

import os
import time

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage

# Modeller i den ordning de provas — snabbast/snålast först
MODELLER = [
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]


def _skapa_llm(modell: str):
    """Skapar en Gemini-klient för given modell. Bryts ut för testbarhet."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    load_dotenv()
    return ChatGoogleGenerativeAI(
        model=modell,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        max_retries=1,
    )


def _ar_kvotfel(e: Exception) -> bool:
    s = str(e)
    return "429" in s or "RESOURCE_EXHAUSTED" in s or "quota" in s.lower()


def _ar_serverfel(e: Exception) -> bool:
    s = str(e)
    return "503" in s or "UNAVAILABLE" in s


def anropa_strukturerat(prompt: str, schema):
    """
    Gör ETT strukturerat Gemini-anrop med automatisk modellrotation.

    Args:
        prompt (str): Den färdigbyggda prompten.
        schema: Pydantic-modellen som svaret tvingas till.

    Returns:
        Pydantic-objektet från den första modell som lyckas svara.

    Raises:
        RuntimeError: när alla modeller misslyckats (troligen kvot slut).
        Exception: andra fel (t.ex. trasig prompt) propageras direkt.
    """
    senaste_fel = None

    for modell in MODELLER:
        structured_llm = _skapa_llm(modell).with_structured_output(schema)
        try:
            return structured_llm.invoke([HumanMessage(content=prompt)])
        except Exception as e:
            if _ar_kvotfel(e):
                print(f"Kvot slut för {modell} — provar nästa modell...")
                senaste_fel = e
                continue
            if _ar_serverfel(e):
                print(f"Servern överbelastad ({modell}), väntar 30 sekunder...")
                time.sleep(30)
                try:
                    return structured_llm.invoke([HumanMessage(content=prompt)])
                except Exception as e2:
                    print(f"{modell} svarar fortfarande inte — provar nästa modell...")
                    senaste_fel = e2
                    continue
            raise

    raise RuntimeError(
        f"Alla Gemini-modeller misslyckades — troligen är dagskvoten slut "
        f"för samtliga. Senaste fel: {senaste_fel}"
    )
