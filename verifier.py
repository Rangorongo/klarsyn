"""
verifier.py

AI-verifiering av HS-klassificeringar — den andra halvan av dubbelkontrollen.

TARIC-uppslaget (taric.py) ger oss FAKTA: den officiella beskrivningen för
varje HS-kod. Men bara en människa — eller en AI — kan avgöra om fakturans
"Elektronikkort" faktiskt är samma sak som TARIC:s "Printed circuits".
Den bedömningen görs här.

Kvotsnålt: EN (1) Gemini-förfrågan per faktura, oavsett antal varurader.
Alla rader skickas i samma prompt och AI:n svarar per rad.

Anropet går via llm_klient.py som roterar mellan gratis-modellerna vid
kvotfel. Graciös degradering: om ALLA modeller misslyckas returneras None
istället för att krascha — customs_logic.py ger då berörda varor domen
"gul" med en notering, och pipelinen fortsätter.
"""

from llm_klient import anropa_strukturerat


def _bygg_prompt(rader: list) -> str:
    """
    Bygger prompten som listar alla varurader med bådas beskrivningar.

    Args:
        rader: lista av dictar med index, hs_code, invoice_description,
               taric_description.
    """
    radtext = "\n".join(
        f"- item_index {r['index']}: HS-kod {r['hs_code']} | "
        f"Fakturans beskrivning: \"{r['invoice_description']}\" | "
        f"TARIC:s officiella beskrivning: \"{r['taric_description']}\""
        for r in rader
    )

    return f"""
    Du är en erfaren tullexpert. För varje varurad nedan: bedöm om varans
    beskrivning från fakturan rimligen kan klassificeras under den officiella
    TARIC-beskrivningen för den angivna HS-koden.

    Svara per rad med fältet "matchar":
    - "ja": fakturans beskrivning passar tydligt under TARIC-beskrivningen.
    - "nej": varan hör uppenbart hemma under en annan HS-kod (felklassificering).
    - "osäker": beskrivningen är för vag eller tvetydig för att avgöra.

    Ge alltid en kort motivering på svenska (en mening). Bedöm ENDAST utifrån
    texterna nedan — hitta aldrig på egenskaper som inte står där. Använd samma
    item_index som i listan.

    Varurader:
    {radtext}
    """


def verify_hs_matches(rader: list):
    """
    Verifierar med EN Gemini-förfrågan att varubeskrivningarna matchar
    sina TARIC-beskrivningar.

    Args:
        rader: lista av dictar med nycklarna index, hs_code,
               invoice_description och taric_description.

    Returns:
        dict: {item_index: (matchar, motivering)} vid lyckat anrop,
        None om anropet misslyckades (kvot slut, serverfel m.m.) —
        anroparen förväntas då degradera snyggt istället för att krascha.
    """
    if not rader:
        return {}

    from models import HSMatchResultat

    prompt = _bygg_prompt(rader)
    print("Verifierar HS-klassificeringar med AI (1 anrop)...")
    try:
        resultat = anropa_strukturerat(prompt, HSMatchResultat)
    except Exception as e:
        # Även med modellrotation kan allt misslyckas — krascha inte,
        # degradera snyggt så pipelinen kan slutföra granskningen.
        print(f"AI-verifieringen kunde inte köras ({type(e).__name__}) — fortsätter utan den.")
        return None

    return {b.item_index: (b.matchar, b.motivering) for b in resultat.bedomningar}
