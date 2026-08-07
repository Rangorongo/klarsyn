"""
modules/freight/prompts.py

Fraktmodulens prompter för tvåpass-extraktionen (core/extraktion.py).
Samma disciplin som tullmodulen: inget påhittat, format bevaras exakt.
"""

from modules.freight.schema import FreightInvoice


def bygg_forsta_prompt(raw_text: str) -> str:
    """Bygger prompten för den första, råa extraktionen."""
    return f"""
    Du är en expert på fraktfakturor från transportörer som DHL, DSV, Schenker,
    UPS och PostNord. Extrahera data från följande text enligt
    schema-definitionen för FreightInvoice.

    Viktigt:
    - Varje sändning (tracking-nummer) blir ett eget Shipment-objekt.
    - Tilläggsavgifter (bränsletillägg, vägavgift, etc.) blir SurchargeLine-rader.
    - Fält som inte står i texten ska vara None — hitta ALDRIG på data.

    Fakturatext:
    {raw_text}
    """


def bygg_sjalvkontroll_prompt(raw_text: str, first_pass: FreightInvoice) -> str:
    """
    Bygger prompten för självkontrollssteget — en andra, kritisk läsning.
    """
    first_pass_json = first_pass.model_dump_json(indent=2)

    return f"""
    Du är en erfaren fraktrevisor som granskar en kollegas arbete en andra gång,
    innan fakturan skickas vidare till kund. Var extra noga och kritisk.

    Originalfakturans text:
    {raw_text}

    Kollegans första utkast (i JSON-format):
    {first_pass_json}

    Din uppgift:
    1. Läs originaltexten noga igen och jämför med utkastet ovan.
    2. Rätta eventuella fel (fel vikt, fel belopp, missad tilläggsavgift,
       hopblandade sändningar, fel valuta).
    3. Om ett fält saknas i fakturan ska det vara None — hitta ALDRIG på data.
    4. BEVARA EXAKT FORMAT på "tracking_number" precis som i originaltexten —
       skriv aldrig om, förkorta eller "städa" numret. Dubblettkontrollen
       nedströms kräver exakt originalformat.
    5. För VARJE sändning, sätt "confidence" till "hög" eller "låg":
       - "hög": du är säker på att alla fält för sändningen är korrekta.
       - "låg": något är otydligt, tvetydigt, eller du var tvungen att gissa.
    6. Vid "låg": förklara kort i "review_note" — ENDAST sådant som faktiskt
       går att läsa i fakturatexten (t.ex. "vikten är otydligt angiven",
       "tillägget saknar belopp"). Hitta aldrig på omständigheter. Kan du inte
       peka på en konkret textrad, skriv: "Osäker efter granskning av
       fakturatexten, ingen specifik anledning identifierad."

    Returnera hela den granskade och eventuellt rättade fakturan enligt
    FreightInvoice-schemat.
    """
