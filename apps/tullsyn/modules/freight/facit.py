"""
modules/freight/facit.py

Fraktmodulens jämförelsedata ("facit") — de referensvärden som
granskningsreglerna mäter fakturorna mot.

Version 1 innehåller de avtalslösa referenserna. När transportörernas
publicerade tilläggsindex och kundernas fraktavtal läggs in (V2) hamnar
de också här — reglerna i rules.py behöver då inte ändras, bara facit.
"""

# Volymviktsdivisor per transportör: volymvikt = (L × B × H cm³) / divisor.
# 5000 är internationell standard för expressfrakt. Nyckeln matchas
# skiftlägesokänsligt mot transportörens namn (delsträng räcker).
VOLYMVIKTSDIVISOR = {
    "dhl": 5000,
    "ups": 5000,
    "fedex": 5000,
    "dsv": 5000,
    "schenker": 5000,
    "postnord": 5000,
    "tnt": 4000,  # TNT använder historiskt 4000 för vissa tjänster
}
STANDARD_DIVISOR = 5000

# Tolerans för viktjämförelser — transportörer avrundar ofta uppåt till
# närmaste halvkilo, det ska inte ge falsklarm.
VIKTTOLERANS_KG = 0.5

# Tolerans för beloppsjämförelser (öresavrundning).
BELOPPSTOLERANS = 0.05

# Procenttillägg (t.ex. bränsle) över denna nivå är orimliga och ska
# kontrolleras manuellt mot transportörens publicerade index.
MAX_PROCENTTILLAGG = 35.0


def hamta_divisor(carrier_name) -> int:
    """
    Hämtar volymviktsdivisorn för en transportör.

    Matchar delsträng skiftlägesokänsligt: "DHL Express Sweden" → dhl → 5000.
    Okänd transportör får standarddivisorn 5000.
    """
    if not carrier_name:
        return STANDARD_DIVISOR
    namn = str(carrier_name).lower()
    for nyckel, divisor in VOLYMVIKTSDIVISOR.items():
        if nyckel in namn:
            return divisor
    return STANDARD_DIVISOR
