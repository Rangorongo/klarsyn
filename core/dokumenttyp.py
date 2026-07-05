"""
core/dokumenttyp.py

Avgör om en PDF är en TULLFAKTURA eller en FRAKTFAKTURA — deterministiskt.

Medvetet designval: nyckelordspoäng istället för AI. Det är kvotfritt,
blixtsnabbt, testbart och ger samma svar varje gång. Vid för svag eller
tvetydig signal GISSAR systemet ALDRIG — det ber användaren ange modul
med --modul-flaggan istället. Hellre en fråga än en felgranskning.
"""

# Ord som typiskt bara förekommer i fraktfakturor
FRAKT_SIGNALER = [
    "tracking", "awb", "waybill", "fraktsedel",
    "volymvikt", "volumetric", "debiterad vikt", "chargeable weight",
    "bränsletillägg", "fuel surcharge",
    "grundfrakt", "freight invoice", "fraktfaktura",
    "dhl", "dsv", "schenker", "ups", "fedex", "postnord", "bring", "geodis",
]

# Ord som typiskt bara förekommer i handelsfakturor för tull
TULL_SIGNALER = [
    "hs-kod", "hs code", "hs kod", "tullvarukod",
    "ursprungsland", "country of origin",
    "tulltaxa", "taric", "customs", "commercial invoice", "handelsfaktura",
    "incoterm", "tariff",
]


def identifiera_dokumenttyp(text: str) -> str:
    """
    Klassificerar dokumenttexten som "tull" eller "frakt".

    Args:
        text: Dokumentets råtext (från pdfplumber).

    Returns:
        str: "tull" eller "frakt".

    Raises:
        ValueError: när signalerna är för svaga eller tvetydiga —
        felmeddelandet ber användaren ange --modul själv.
    """
    t = text.lower()
    frakt_poang = sum(1 for signal in FRAKT_SIGNALER if signal in t)
    tull_poang = sum(1 for signal in TULL_SIGNALER if signal in t)

    if frakt_poang >= 2 and frakt_poang > tull_poang:
        return "frakt"
    if tull_poang >= 2 and tull_poang > frakt_poang:
        return "tull"

    raise ValueError(
        f"Kunde inte avgöra dokumenttyp (tullsignaler: {tull_poang}, "
        f"fraktsignaler: {frakt_poang}). Ange modul själv: "
        f"python main.py <fil> --modul tull  ELLER  --modul frakt"
    )
