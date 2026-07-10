# Projekthistorik — hur Tullsyn byggdes

*För dig som är ny: det här dokumentet berättar hur projektet gått till,
vilka beslut som fattats och varför, hur vi arbetar — och var det finns
luckor som nya ögon kan fylla.*

## Idén

Importföretag betalar ofta för mycket i tull utan att veta om det:
felklassificerade varor, outnyttjade frihandelsavtal, räknefel och
dubbeldebiterad frakt. Felen går att återkräva (tull upp till 3 år bakåt
hos Tullverket, frakt direkt mot transportören) men små och medelstora
företag har ingen som hinner leta. Tullsyn granskar fakturorna automatiskt
och tar betalt först när pengar hittas (25 % success fee) — kunden tar
noll risk.

## Resan i etapper

Projektet byggdes i tydligt avgränsade etapper, var och en med en skriven
design-spec (se `docs/superpowers/specs/`) innan kod skrevs:

**0. Ursprunget (customs_recovery_ai).** Ett Python-skript som läste en
faktura-PDF med Gemini och slog upp tullsatser i EU:s tulltaxa TARIC.
Började som multi-agent (två extraktions-AI + domare) men skrotades till
single-agent: samma modell med samma prompt gav nästan identiska svar, och
tre AI-anrop per faktura åt upp gratiskvoten. Lärdomen präglar allt sedan
dess: **varje AI-anrop ska förtjäna sin plats**.

**1. Grundtrygghet.** Git-repo (kod utan versionshantering är en riskabel
hobbyverksamhet), GitHub-backup och en testsvit som kör helt utan API-anrop
— syntetiska TARIC-tabeller i stället för 8 MB Excel. Från denna punkt har
varje ändring skyddats av tester.

**2. Ärligare siffror.** Insikten att fakturan aldrig visar vilken tull som
*betalades* (det gör bara importdeklarationen) ledde till projektets
viktigaste princip: **systemet lovar aldrig pengar**. Alla belopp är övre
gränser "om MFN-tull betalades — verifiera mot deklarationen". Samtidigt
byggdes AI-fria aritmetikkontroller (antal × pris, radsumma + frakt).

**3. Konfidensarkitekturen.** Varje vara får en slutdom — grön (lita på
resultatet), gul (bör granskas), röd (måste granskas) — byggd på flera
oberoende signaler: TARIC-fakta, AI:ns självkontroll, aritmetik och en
AI-bedömning av om varubeskrivningen matchar TARIC-texten. Dubbelkontrollen
(deterministisk fakta + AI-nyans) är kvalitetslöftet; AI:n får aldrig
ensam fälla avgörandet.

**4. Produktifiering.** Beslutsrapport-PDF som säljer sig själv i kunddemo
(åtgärdslista, domfärger, sidbrytningar), CLI med batchkörning, och ett
eval-set: testfakturor med kända planterade fel + facit. Första fulla
mätningen: **16 av 16 fel hittade (100 %)**.

**5. Korrekthet och robusthet (etapp 2).** Datakontroll av riktiga TARIC-
filer avslöjade att 6 536 varukoder har flera tullsatsrader — utan
datumfiltrering kunde en UTGÅNGEN sats väljas. Fixades tillsammans med
villkorstullar, TARIC-cache, automatisk modellrotation vid kvotstopp,
antidumpningsflaggor (stor bötesrisk vid Kina-import) och GitHub Actions-CI.

**6. Komplett system.** Omstrukturering till `core/` + `modules/` enligt
modulplanen, fraktmodul V1 (dubbeldebitering, volymvikt, summakontroller),
momskonsekvens av tullfel, automatisk dokumenttypsdetektering och det
formella **revisionsprotokollet** — numrerade fynd med belopp, beräkning,
referens och åtgärd: färdigt underlag för ändringsansökan.

**7. Lanseringsetappen.** Anropslogg (kostnadskoll), utökad GDPR-maskering
(personnummer, orgnummer, telefon), granskningsmetadata i protokollet
(spårbarhet: när, vilken TARIC-version, vilka modeller), TARIC-
färskhetsvarning, SEK-konvertering via ECB, kundregister med
fraktdubbletter över tid (SQLite) och OCR-stöd för inskannade fakturor.

**8. MVP-beslutet (nuläget).** Teknisk MVP bedömdes klar — **feature-frys
råder**. Det som återstår för lansering är inte kod: pilotkund med riktiga
fakturor, betald API-nyckel, Tesseract-installation, uppdragsavtal och
tullombudskontakt. Skalstegen (backend, e-postintag, kundportal) väntar
tills en riktig kund bevisat värdeloopen.

En marknadssida byggdes också (separat publikt repo `tullsyn-web`,
premium-design med animerad gransknings-demo) men publiceringen via GitHub
Pages strulade och parkerades — frontenden ägs nu av grundaren själv.

## Bärande principer (läs dessa innan du ändrar kod)

1. **Lova aldrig pengar.** Belopp är övre gränser tills de verifierats.
   Formuleringar i rapporter/protokoll är juridiskt medvetna.
2. **AI:n får aldrig gissa.** Saknas ett fält i fakturan är det `None`.
   Självkontrollprompten förbjuder påhittade förklaringar.
3. **Bevara originalformat.** HS-koder, landskoder och tracking-nummer
   skrivs aldrig om — nedströms matchning kräver exakt form.
4. **Deterministik före AI.** Allt som kan avgöras med kod (aritmetik,
   datum, dubbletter, dokumenttyp) avgörs med kod. AI används där bara
   språkförståelse duger (extraktion, beskrivningsmatchning).
5. **Flaggor och findings skapas på samma kodställe** så att människo-
   rapporten och protokollet aldrig kan glida isär.
6. **Kvotfria tester.** Hela testsviten (121 tester) kör utan nätverk och
   API-nyckel. AI-beroenden mockas; en fejk-LLM testar rotationen.
7. **Graciös degradering.** Kvotstopp, serverfel, saknad OCR-binär eller
   utebliven valutakurs får ALDRIG krascha en granskning — de ger gula
   domar och tydliga noteringar i stället.

## Arbetsmetoden

Varje spår följer samma slinga: **brainstorm → kort design-spec (godkänns)
→ tester först (TDD) → implementation → hela sviten grön → commit + push →
CI grön**. Efter större omstruktureringar körs dessutom en skarp
E2E-körning — den har två gånger fångat fel som enhetstesterna missade
(en kvarglömd import, en smutsig global flagga). Specarna i
`docs/superpowers/specs/` är beslutslogg; git-historikens 27 commits går
att läsa som en dagbok.

## Ärligt: här brister det

- **Aldrig testat mot riktiga fakturor.** Allt är bevisat mot genererade
  testfakturor. Detta är projektets största okända — och första prioritet.
- **Eval-setet är litet** (6 fakturor). 100 % träffar låter bra men
  statistiken är tunn; 20+ fakturor behövs för en siffra som håller.
- **PDF-rapporterna är Windows-bundna** (Arial-sökvägar) — blockerar
  serverdrift på Linux.
- **Ingen körningslogg till fil** — allt skrivs bara i konsolen; felsökning
  av gamla kundkörningar blir svår.
- **Prompterna är oversionerade** och aldrig A/B-testade mot varandra.
- **Kunddata lagras okrypterat lokalt** (SQLite-historik, fakturamappar).
- **Batchkörning antar en valuta** i protokollets summering.

## Öppna trådar — här kan nya ögon göra skillnad

- **Föreslå rätt HS-kod**, inte bara flagga fel: sök i TARIC-nomenklaturen
  (t.ex. embeddings) och ge kandidater med motivering. Skulle höja värdet
  på varje rött fynd dramatiskt.
- **Importdeklarationsparsning** — uppgraderar "möjlig återbetalning" till
  "bekräftad överbetalning". Störst affärshävstång av allt.
- **Tullvärdeskontroll**: är CIF-komponenterna (frakt/försäkring) rätt
  inräknade i tullvärdet?
- **Benchmark mot människa**: låt ett tullombud granska samma fakturor och
  jämför — säljargument och kvalitetsmått i ett.
- **Frakt V2**: transportörernas publicerade bränsleindex, kundavtal
  (rabattmatriser), money-back-garantier (GSR). Se
  `docs/moduler/fraktmodul-plan.md`.
- **Fler moduler i samma mönster**: elektronikskatt, kemikalieskatt,
  Intrastat — arkitekturen (`core/` + modul med schema/facit/rules) är
  byggd för att kopieras.
