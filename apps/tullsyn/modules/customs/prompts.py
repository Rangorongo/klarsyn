"""
modules/customs/prompts.py

Tullmodulens prompter för tvåpass-extraktionen (core/extraktion.py).

Självkontrollprompten är noggrant formulerad: den förbjuder AI:n att
skriva om HS-koder och landskoder till andra format (nedströms-systemen
kräver exakt originalformat) och att hitta på review_note-förklaringar
som inte går att läsa i fakturatexten.
"""

from modules.customs.schema import CustomsInvoice


def bygg_forsta_prompt(raw_text: str) -> str:
    """Bygger prompten för den första, råa extraktionen."""
    return f"""
    Du är en expert på tullfakturor. Extrahera data från följande text enligt
    schema-definitionen för CustomsInvoice.

    Fakturatext:
    {raw_text}
    """


def bygg_sjalvkontroll_prompt(raw_text: str, first_pass: CustomsInvoice) -> str:
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
    5. För VARJE varurad (item), sätt fältet "confidence" till antingen
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
