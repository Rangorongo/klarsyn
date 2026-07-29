# Deklarationskontrollen — Fas 1: Lokal avdragskontroll (design)

Status: godkänd, redo för implementationsplan
Datum: 2026-07-29

## Syfte

Deklarationskontrollen ska hjälpa privatpersoner hitta skatteavdrag och skattemissar de annars skulle missa i sin svenska inkomstdeklaration, utan att behöva fråga banken eller en kunnig vän. Fas 1 är den första körbara versionen: ett lokalt CLI-verktyg som läser in Skatteverkets förifyllda underlag, ställer riktade uppföljningsfrågor och levererar en tydlig rapport över möjliga avdrag.

## Roadmap / fasindelning

| Fas | Innehåll | Status |
|---|---|---|
| **Fas 1** | Skatteverket XML/PDF-inläsning, regelmotor för resor/dubbel bosättning, ränta/kapital, RUT/ROT, statiska frågemallar, Markdown-rapport, krypterad lokal lagring, ren CLI | **Denna spec** |
| Fas 2 | Krypto-CSV-import från börser + omkostnadsbelopp-beräkning, PDF-export av rapport | Ej påbörjad |
| Fas 3 | Open Banking/PSD2-integration för avdrag som inte syns i Skatteverkets data | Ej påbörjad |
| Fas 4 | Lokal LLM (Ollama) för naturligare frågeformulering och fritextolkning, ev. lokal webb-UI | Ej påbörjad |
| Fas 5 | **Betalmodell**: 25 % success fee på hittade avdrag, no-cure-no-pay, betalning via Klarna/Swish/bankkort. Kräver en riktig backend-server, användarkonton, betalningsintegration, och ett sätt att koppla mot Skatteverkets *faktiska* slutbesked (inte bara vår uppskattning) för att veta vad som ska faktureras. Egen design- och brainstormingsomgång krävs innan implementation. | Ej påbörjad — **medvetet frikopplad från Fas 1** |

Fas 1 är och förblir **lokal och gratis**. Betalmodellen i Fas 5 kräver en fundamentalt annan arkitektur (server, konton, betalningsflöde) och ska inte blandas in i Fas 1-koden. Detta var ett explicit beslut för att undvika att en ännu odesignad affärsmodell blockerar en fungerande första version.

En separat visuell UX-mockup (`mockup/`, statisk HTML/CSS/JS) har byggts för att utforska hur en framtida webbversion skulle kunna se och kännas ut, inklusive hur Fas 5:s prismodell skulle kunna kommuniceras. Mockupen är en designreferens, inte en del av Fas 1-leveransen, och representerar inte den lokala CLI-produktens faktiska gränssnitt.

## Arkitektur & komponenter (Fas 1)

```
src/deklarationskontrollen/
  ingestion/
    skatteverket/
      xml_parser.py      # Parsar Skatteverkets SRU/Inkomstdeklaration-XML
      pdf_parser.py       # Fallback: extraherar samma data ur den förifyllda PDF:en
      models.py            # Pydantic-modell "Underlag" — normaliserad datastruktur
  rules/
    engine.py              # RuleRegistry: samlar och kör alla regler mot ett Underlag
    resor.py                # Regel: resor till/från arbetet + dubbel bosättning
    ranta_kapital.py     # Regel: ränteavdrag, kapitalförlust
    rut_rot.py               # Regel: RUT/ROT-avdrag
  interview/
    runner.py               # Kör frågeflödet i terminalen, samlar och validerar svar
  report/
    markdown_report.py  # Bygger slutrapporten (Markdown)
  storage/
    encrypted_store.py  # Krypterar/sparar Underlag + svar lokalt (Fernet)
  cli/
    main.py                  # Entrypoint: `deklkontroll analysera <fil>`
tests/
docs/
  superpowers/specs/     # Denna typ av designdokument
data/                          # Gitignorad — all persondata hamnar här, krypterad
```

**Varje komponent har ett enda ansvar:**
- `ingestion` vet hur man tolkar Skatteverkets filformat och producerar ett `Underlag`-objekt. Den vet inget om regler eller frågor.
- `rules` vet vilka skattemissar som finns och vilka frågor som behövs för att avgöra dem. Den vet inget om CLI eller filformat.
- `interview` vet hur man ställer frågor i terminalen och validerar svar. Den vet inget om vilka regler som finns.
- `report` vet hur man presenterar resultatet. Den vet inget om hur resultatet togs fram.
- `storage` vet hur man krypterar och sparar/laddar data. Den vet inget om vad datan betyder.

Detta gör att varje del kan testas isolerat och bytas ut utan att påverka de andra (t.ex. kan `ingestion` senare byggas ut med krypto-import i Fas 2 utan att röra `rules`).

## Regelmotor-design

Tre arkitekturer övervägdes:

1. **Deklarativ (YAML/JSON-regler)** — lätt att lägga till enkla tröskelregler utan kod, men klumpigt för flerstegslogik (fråga → fråga → beräkning → tröskeljämförelse).
2. **Python-klasser per regel (vald)** — varje skattemiss är en klass med `check(underlag)`, `questions()`, `compute(svar)`. Registreras i en `RuleRegistry`. Typsäkert, testbart isolerat, matchar att Fas 1 bara har ~4 regler — inget behov av ett eget regelspråk än.
3. **Hybrid** (deklarativt för enkla regler, Python för komplexa som krypto) — rätt för senare faser, för tidigt nu.

**Beslut: alternativ 2.** Om regelantalet växer kraftigt i senare faser kan vi migrera till en hybridmodell då, utan kostsam omskrivning eftersom varje regel redan är isolerad bakom samma gränssnitt.

## Dataflöde

1. `deklkontroll analysera <fil>` → `ingestion` parsar filen (XML i första hand, PDF som fallback) → ett `Underlag`-objekt.
2. `RuleRegistry` kör alla registrerade regler mot `Underlag`. Varje regel avgör om den är potentiellt relevant.
3. För varje relevant regel ställer `interview` dess frågor i terminalen; svaren valideras mot enkla typer/format innan de accepteras och sparas krypterat.
4. Regeln beräknar om den slår till (givet svaren) och en uppskattad besparing, eller markerar posten som "kräver manuell kontroll" om beloppet inte går att räkna fram automatiskt (t.ex. dubbel bosättning).
5. `report` renderar allt till en Markdown-fil med belopp, motivering och källhänvisning till Skatteverkets regelverk.

## Datalagring & säkerhet

- All persondata (personnummer, inkomstuppgifter, svar) sparas lokalt i `data/` (gitignorad) och krypteras med Fernet (`cryptography`-biblioteket) med en nyckel/lösenord som användaren anger.
- Ingen data lämnar användarens dator. Ingen molntjänst, inget API-anrop med persondata i Fas 1.
- Saknad/felaktig krypteringsnyckel ger ett tydligt fel — aldrig tyst dataförlust eller okrypterad fallback.

## Felhantering

- Trasig/oväntad XML-struktur → tydligt felmeddelande med förslag att prova PDF-parsern istället (eller vice versa). Aldrig en rå stacktrace till användaren.
- En regel som inte kan avgöras säkert (svar saknas/ogiltigt) markeras som "kräver manuell kontroll" i rapporten — antas aldrig vara "nej" i tysthet.

## Testning

- `pytest` med syntetiska (handskrivna) XML/PDF-exempel som fixtures, byggda efter Skatteverkets **publika** schemadokumentation eftersom inget riktigt exempel fanns tillgängligt vid designtillfället.
  - **Öppen punkt:** dessa fixtures måste verifieras mot en riktig (avidentifierad) Skatteverket-fil så snart en sådan finns tillgänglig — se "Öppna frågor" nedan.
- Varje regelklass testas isolerat med olika `Underlag`- och svarskombinationer (gränsvärden, saknade fält, m.m.).
- Rapportgenerering testas med snapshot-jämförelse av Markdown-output.

## Repo & tooling

- `uv` för dependency management, Python 3.12+.
- Standard `src/`-layout, `pyproject.toml`.
- `.gitignore` inkluderar `data/` och andra lokala/känsliga artefakter.
- `README.md` (skrivs i implementationsfasen) med projektöversikt, faskarta, setup-instruktioner och tydlig markering av vad som är byggt vs. planerat.
- Kod och dokumentation pushas till `https://github.com/Rangorongo/Deklarations-kontrollen` (privat repo).

## Öppna frågor / att verifiera senare

1. **Riktig Skatteverket-fil saknas.** Parsern och testfixturerna är byggda mot publik schemadokumentation. Måste stämmas av mot en riktig (avidentifierad) fil innan Fas 1 kan anses produktionsklar.
2. **Fas 5 (betalmodell) är odesignad.** Kräver en egen brainstorming-/designomgång: backend-arkitektur, kontohantering, betalningsleverantör (Klarna/Swish/kort), och — viktigast — hur vi på ett pålitligt sätt kopplar en debitering till Skatteverkets *faktiska* slutliga beslut snarare än vår egen uppskattning.
3. **Mockupen (`mockup/`) är en fristående designreferens**, byggd för att utforska UX för en möjlig framtida webbversion (inkl. Fas 5-prissättning). Den är inte bindande för Fas 1:s CLI-gränssnitt och bör inte förväxlas med den faktiska leveransen i denna fas.
