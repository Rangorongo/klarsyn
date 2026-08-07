"""
core/extraktion.py

Generell tvåpass-extraktion — kärnan i hur systemet läser dokument.

Mönstret är detsamma oavsett dokumenttyp (tullfaktura, fraktfaktura...):
    1. Första passet: AI:n läser dokumenttexten och fyller i det Pydantic-
       schema som modulen skickar in.
    2. Självkontroll: samma AI får se originaltexten OCH sitt eget första
       svar och rättar sig själv — som en kollega som läser en gång till.

Varje modul (modules/customs, modules/freight) äger sina egna prompter
och sitt eget schema; den här funktionen äger bara flödet. Så kan nya
dokumenttyper läggas till utan att röra extraktionslogiken.

Alla anrop går via core/llm_klient.py med automatisk modellrotation.
"""

from core.llm_klient import anropa_strukturerat


def extrahera_tva_pass(text: str, schema, bygg_forsta_prompt, bygg_sjalvkontroll_prompt):
    """
    Extraherar strukturerad data ur dokumenttext i två steg.

    Args:
        text: Dokumentets råtext (redan PII-maskerad).
        schema: Pydantic-modellen som AI:n tvingas svara enligt.
        bygg_forsta_prompt: funktion (text) -> str för första extraktionen.
        bygg_sjalvkontroll_prompt: funktion (text, forsta_svar) -> str
            för självkontrollen.

    Returns:
        Pydantic-objektet från självkontrollen (det granskade svaret).
    """
    print("Extraherar dokument (steg 1/2)...")
    forsta = anropa_strukturerat(bygg_forsta_prompt(text), schema)

    print("Granskar det egna svaret (steg 2/2, självkontroll)...")
    return anropa_strukturerat(bygg_sjalvkontroll_prompt(text, forsta), schema)
