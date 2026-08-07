"""
core/valuta.py

Valutakonvertering till SEK — Tullverket räknar i svenska kronor, så
protokollets belopp blir direkt användbara i ansökan när de även anges i SEK.

Källa: ECB:s dagliga referenskurser (eurofxref-daily.xml), som anger alla
kurser mot EUR. SEK-kursen för en godtycklig valuta räknas via EUR-korset:
    SEK per USD = (SEK per EUR) / (USD per EUR)

Robusthet: senast hämtade kurser cachas i valutakurser.json. Vid nätverksfel
används cachen med en varning; utan cache hoppas konverteringen över med en
tydlig notering — granskningen stannar ALDRIG på grund av valutakurser.
"""

import json
import os
import urllib.request
import xml.etree.ElementTree as ET

ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
_PROJEKTROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_FIL = os.path.join(_PROJEKTROT, "valutakurser.json")


def _hamta_fran_ecb() -> dict:
    """Hämtar dagens referenskurser från ECB. Bryts ut för testbarhet."""
    with urllib.request.urlopen(ECB_URL, timeout=10) as svar:
        xml_data = svar.read()

    rot = ET.fromstring(xml_data)
    ns = {"e": "http://www.ecb.int/vocabulary/2002-08-01/eurofxref"}
    dag_nod = rot.find(".//e:Cube[@time]", ns)

    kurser = {}
    for nod in dag_nod.findall("e:Cube", ns):
        kurser[nod.get("currency")] = float(nod.get("rate"))

    return {"datum": dag_nod.get("time"), "kurser": kurser}


def _las_cache():
    try:
        with open(CACHE_FIL, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _skriv_cache(data: dict):
    try:
        with open(CACHE_FIL, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except OSError:
        pass  # cache är en bekvämlighet — får aldrig krascha körningen


def hamta_sek_kurs(valuta: str):
    """
    Hämtar SEK-kursen för en valuta.

    Args:
        valuta: t.ex. "EUR", "USD" eller "SEK".

    Returns:
        tuple (kurs, kursdatum) — t.ex. (11.32, "2026-07-04") betyder
        1 EUR = 11.32 SEK. (None, None) om kursen inte kan avgöras.
    """
    valuta = (valuta or "").upper()
    if valuta == "SEK":
        return 1.0, "—"

    try:
        data = _hamta_fran_ecb()
        _skriv_cache(data)
    except Exception:
        data = _las_cache()
        if data is None:
            print("Valutakurser kunde inte hämtas (och ingen cache finns) — "
                  "SEK-konvertering hoppas över.")
            return None, None
        print(f"Valutakurser kunde inte hämtas — använder cachade kurser "
              f"från {data.get('datum')}.")

    kurser = data.get("kurser", {})
    sek_per_eur = kurser.get("SEK")
    if sek_per_eur is None:
        return None, None

    if valuta == "EUR":
        return round(sek_per_eur, 4), data.get("datum")

    valuta_per_eur = kurser.get(valuta)
    if not valuta_per_eur:
        return None, None
    return round(sek_per_eur / valuta_per_eur, 4), data.get("datum")
