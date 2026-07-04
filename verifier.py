"""
verifier.py

AI-verifiering av HS-klassificeringar — den andra halvan av dubbelkontrollen.

TARIC-uppslaget (taric.py) ger oss FAKTA: den officiella beskrivningen för
varje HS-kod. Men bara en människa — eller en AI — kan avgöra om fakturans
"Elektronikkort" faktiskt är samma sak som TARIC:s "Printed circuits".
Den bedömningen görs här.

Kvotsnålt: EN (1) Gemini-förfrågan per faktura, oavsett antal varurader.
Alla rader skickas i samma prompt och AI:n svarar per rad.

Graciös degradering: om anropet misslyckas (429 kvot slut, 503 server)
returneras None istället för att krascha — customs_logic.py ger då berörda
varor domen "gul" med en notering, och pipelinen fortsätter.

OBS: LLM:en skapas INUTI funktionen, inte vid import. Därför kan tester
importera modulen utan API-nyckel, och API-nyckeln kan bytas i .env utan
kodändringar.
"""

import os
import time

from dotenv import load_dotenv


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

    # Importeras här (inte högst upp) så att tester kan importera modulen
    # utan att langchain/API-nyckel behövs.
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage
    from models import HSMatchResultat

    load_dotenv()
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        max_retries=3,
    )
    structured_llm = llm.with_structured_output(HSMatchResultat)
    prompt = _bygg_prompt(rader)

    print("Verifierar HS-klassificeringar med AI (1 anrop)...")
    try:
        resultat = structured_llm.invoke([HumanMessage(content=prompt)])
    except Exception as e:
        if "503" in str(e) or "UNAVAILABLE" in str(e):
            print("Servern överbelastad, väntar 30 sekunder...")
            time.sleep(30)
            try:
                resultat = structured_llm.invoke([HumanMessage(content=prompt)])
            except Exception:
                print("AI-verifieringen misslyckades — fortsätter utan den.")
                return None
        else:
            # T.ex. 429 (kvot slut): krascha inte, degradera snyggt.
            print(f"AI-verifieringen kunde inte köras ({type(e).__name__}) — fortsätter utan den.")
            return None

    return {b.item_index: (b.matchar, b.motivering) for b in resultat.bedomningar}
