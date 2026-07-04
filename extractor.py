"""
extractor.py

Denna modul hanterar inläsning och dataextraktion från ostrukturerade PDF-dokument.

Extraktionen sker nu i TVÅ steg istället för ett:
    1. Första extraktion: AI:n läser fakturan och fyller i CustomsInvoice-schemat,
       precis som tidigare.
    2. Självkontroll: Samma AI får se originaltexten OCH sitt eget första svar,
       och ombeds granska det en gång till — som att be en kollega läsa igenom
       fakturan en andra gång innan den skickas vidare. Den rättar eventuella
       fel och sätter en konfidensnivå ("hög"/"låg") per varurad.

Varför två anrop istället för ett?
    Vi har medvetet valt kvalitet över hastighet/kostnad: färre fakturor per
    dag på gratiskvoten är okej, eftersom kunden hellre ska vänta lite längre
    och lita på resultatet. (Se docs/model_upgrade_plan.md för vilka starkare
    modeller som ska bytas in när vi lanserar på riktigt.)
"""

import os
import time
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
from models import CustomsInvoice, CustomsGraphState

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite",
    google_api_key=api_key,
    max_retries=3
)


def _run_extraction(structured_llm, prompt: str) -> CustomsInvoice:
    """
    Skickar ett prompt-anrop till AI:n och hanterar de vanligaste felen.

    Detta är samma retry-logik som tidigare fanns direkt i extract_invoice_data,
    men flyttad till en egen funktion eftersom vi nu behöver köra den två gånger
    (en gång för första extraktionen, en gång för självkontrollen) och vill
    slippa skriva samma felhantering två gånger.

    Args:
        structured_llm: LLM-objektet som tvingar svaret till CustomsInvoice-formatet.
        prompt (str): Den färdigformulerade texten som skickas till AI:n.

    Returns:
        CustomsInvoice: AI:ns strukturerade svar.
    """
    try:
        return structured_llm.invoke([HumanMessage(content=prompt)])
    except Exception as e:
        if "503" in str(e) or "UNAVAILABLE" in str(e):
            print("Servern överbelastad, väntar 30 sekunder...")
            time.sleep(30)
            return structured_llm.invoke([HumanMessage(content=prompt)])
        else:
            raise


def _build_first_pass_prompt(raw_text: str) -> str:
    """Bygger prompten för den första, råa extraktionen."""
    return f"""
    Du är en expert på tullfakturor. Extrahera data från följande text enligt 
    schema-definitionen för CustomsInvoice.

    Fakturatext:
    {raw_text}
    """


def _build_self_check_prompt(raw_text: str, first_pass: CustomsInvoice) -> str:
    """
    Bygger prompten för självkontrollssteget.

    AI:n får se originaltexten igen tillsammans med sitt eget första svar,
    och ombeds agera som en andra, kritisk läsare.
    """
    first_pass_json = first_pass.model_dump_json(indent=2)

    return f"""
    Du är en erfaren tullrevisor som granskar en kollegas arbete en andra gång,
    innan fakturan skickas vidare till kund. Var extra noga och kritisk.

    Originalfakturans text:
    {raw_text}

    Kollegans första utkast (i JSON-format):
    {first_pass_json}

    Din uppgift:
    1. Läs originaltexten noga igen och jämför med utkastet ovan.
    2. Rätta eventuella fel du hittar (fel HS-kod, fel ursprungsland, fel belopp,
       felstavade fält, felaktig valuta, etc.).
    3. Om ett fält saknas i fakturan ska det vara None — hitta ALDRIG på data.
    4. BEVARA EXAKT FORMAT på "hs_code" och "country_of_origin" precis som de
       skrevs i kollegans utkast och i originalfakturan:
       - Om utkastet har landet som en kod (t.ex. "CN", "PL", "JP"), behåll
         koden — skriv INTE om den till fullt landsnamn ("Kina", "Polen").
       - Om utkastet har HS-koden med punkter (t.ex. "8534.00.00"), behåll
         samma skrivsätt.
       Du får bara ändra värdet om det är sakligt FEL (fel land, fel kod),
       aldrig bara för att "förtydliga" eller skriva om till annat format.
       Nedströms-system förväntar sig exakt samma format som ursprungligen.
    4. För VARJE varurad (item), sätt fältet "confidence" till antingen
       "hög" eller "låg":
       - "hög": du är säker på att alla fält för denna vara är korrekta.
       - "låg": något är otydligt, tvetydigt, eller du var tvungen att gissa.
    6. Om confidence är "låg", förklara varför i fältet "review_note"
       (kort, en mening). Om confidence är "hög" lämnar du "review_note" tomt.

    VIKTIGT om "review_note": den får ENDAST beskriva vad som faktiskt går att
    läsa i originalfakturans text ovan (t.ex. "HS-koden är svårläst i texten",
    "beskrivningen är för vag för att avgöra exakt varutyp",
    "beloppet stämmer inte med antal × pris"). Hitta ALDRIG på en bakomliggande
    förklaring, ett dokument, ett avtal eller en omständighet som inte
    uttryckligen står i fakturatexten. Om du är osäker men inte kan peka på en
    konkret textrad som orsak, skriv istället: "Osäker efter granskning av
    fakturatexten, ingen specifik anledning identifierad."

    Returnera hela den granskade och eventuellt rättade fakturan enligt
    CustomsInvoice-schemat.
    """


def extract_invoice_data(state: CustomsGraphState) -> CustomsGraphState:
    """
    Extraherar strukturerad data från fakturatexten i två steg:
    en första extraktion och en efterföljande självkontroll.

    Använder Pydantic-modellen CustomsInvoice för att tvinga AI:n att
    returnera data i ett förutsägbart och validerbart format i båda stegen.

    Args:
        state (CustomsGraphState): Innehåller råtexten från PDF:en

    Returns:
        CustomsGraphState: Uppdaterat state med extraherad och självgranskad faktурadata
    """
    raw_text = state["raw_pdf_text"]
    structured_llm = llm.with_structured_output(CustomsInvoice)

    # Steg 1: Första extraktionen (som tidigare)
    print("Extraherar faktura (steg 1/2)...")
    first_pass = _run_extraction(structured_llm, _build_first_pass_prompt(raw_text))

    # Steg 2: Självkontroll — AI:n granskar sitt eget första svar
    print("Granskar det egna svaret (steg 2/2, självkontroll)...")
    second_pass = _run_extraction(
        structured_llm,
        _build_self_check_prompt(raw_text, first_pass)
    )

    return {
        "final_output": second_pass.model_dump()
    }
