# Klarsyn — Strategi, risker och krav

Levande dokument. Uppdatera det när ni lär er nytt, fattar beslut, eller
när något nedan blir inaktuellt (t.ex. skatteregler som ändras varje år).
Skrivet efter en brainstorming-session — behandla det som en startpunkt
för diskussion, inte facit.

## 1. Vad som måste researchas innan lansering

### Juridik & bolag
- **Bolagsform.** AB rekommenderas framför enskild firma — begränsar ditt
  personliga ansvar om något går fel, och krävs sannolikt av Swish/Klarna
  för skarpa handlaravtal. Prata med en jurist eller revisionsbyrå om
  vilken form som passar (AB kräver 25 000 kr aktiekapital och mer
  administration än enskild firma).
- **Ansvarsförsäkring (konsultansvarsförsäkring).** Ni ger avdragsråd som
  direkt påverkar folks deklarationer. Om Skatteverket underkänner ett
  avdrag ni sagt var korrekt, eller om ni missar något ni borde flaggat —
  vem bär den ekonomiska risken? Detta bör tecknas innan skarp drift.
- **Kolla om skatterådgivning som kommersiell tjänst har regulatoriska
  krav i Sverige.** Revisorer och skatterådgivare med vissa titlar är
  reglerade (t.ex. auktoriserad revisor via Revisorsinspektionen), men
  ren "hitta ditt avdrag"-programvara är sannolikt oreglerad — **verifiera
  detta med en jurist, gissa inte.**
- **Användarvillkor och integritetspolicy.** Måste finnas innan ni tar
  betalt. Ska bland annat reglera: vad händer om ett hittat avdrag
  underkänns av Skatteverket efter att ni tagit betalt? Återbetalning?
  Hur länge sparas data? Hur begär man radering (redan byggt tekniskt,
  men måste beskrivas juridiskt korrekt).
- **Tullsyn specifikt:** tulldeklarationsrådgivning till företag kan ha
  andra regulatoriska aspekter än privatpersonsskatt — kolla separat.

### Teknik & infrastruktur (se även tidigare statusgenomgång)
- Riktig databas (EU-hostad Postgres), riktiga Swish/Klarna-uppgifter
  (blockerat på bolagsregistrering), riktig Anthropic-nyckel i drift.
- Domän, produktionsdeploy, felövervakning (t.ex. Sentry), backup-rutin
  för databasen.
- Säkerhetsgenomgång innan skarp drift — ni hanterar krypterad men
  mycket känslig finansiell data.

### Skatteregler att verifiera (löpande arbete, inte en engångsgrej)
| Regel | Status |
|---|---|
| Ränta, RUT/ROT, Gåvor, Resor, Dubbel bosättning, Kapitalförlust, Grön teknik | ✅ Verifierade mot Skatteverket (2026-08-09) — alla 8 regler beräknar nu ett riktigt belopp |
| Krypto (schablonmetoden) | ✅ Stabil, väletablerad regel |
| **Alla regler, varje år** | Belopp/trösklar ändras årligen (redan sett: reseavdragets tröskel höjs till 15 000 kr från inkomstår 2026). **Sätt upp en årlig rutin** för att kontrollera samtliga siffror mot Skatteverkets nya belopp inför varje deklarationssäsong. |

**Mätbar träffsäkerhet:** `apps/deklar/src/lib/rules/eval.test.ts` kör hela
regelmotorn mot 13 realistiska scenarier med handräknat facit (samma metod
som Tullsyns `eval/`-mapp) — ger ett konkret, spårbart tal istället för en
känsla, och fångar regressioner även om en enskild regels egna tester
fortfarande passerar.

- Ingen riktig Skatteverket-fil (XML/PDF) har någonsin validerats mot
  parsern — bygger fortfarande bara på publik schemadokumentation.

## 2. Hot mot idén

Saker utanför er kontroll som skulle kunna skada eller döda affären:

1. **Skatteverket förbättrar sin egen tjänst.** Om Skatteverkets app/e-tjänst
   börjar proaktivt flagga fler avdrag själva minskar behovet av er tjänst.
   De har redan börjat gå den vägen för vissa avdrag (RUT/ROT, ränta) —
   just därför är dessa redan förifyllda i de flesta fall.
2. **Konkurrens från etablerade aktörer.** Banker, revisionsbyråer, eller
   andra fintech-bolag kan bygga en liknande tjänst snabbt, särskilt med
   dagens AI-verktyg — er tekniska "moat" är svag (se Svagheter nedan).
3. **Anseenderisk vid fel råd.** Om verktyget säger "detta avdrag är
   korrekt" och en användare senare får ett skattetillägg eller
   efterbeskattning på grund av det, kan det bli mycket negativ publicitet
   och skadeståndskrav — även om felet berodde på felaktig indata från
   användaren (se krav på kunden nedan för hur ni skyddar er mot detta).
4. **Beroende av tredjeparts-AI.** Claude (Deklar) och Google Gemini
   (Tullsyn) — prisändringar, longer-term availability, eller
   kvalitetsförsämringar i modellerna påverkar er produkt direkt och är
   utanför er kontroll.
5. **Dataintrång.** Ni samlar extremt känslig finansiell/personlig data
   (inkomst, tullfakturor, ev. personnummer-relaterat) — ett intrång vore
   sannolikt dödligt för förtroendet och skulle utlösa GDPR-sanktioner.
6. **Regeländringar varje år.** Skattesatser och tröskelvärden ändras
   löpande (se tabellen ovan) — om ni missar en uppdatering ger ni fel
   råd automatiskt, i skala.
7. **Betalningsmodellens timing-problem.** Ni tar 25 % av "hittade pengar"
   — men vet ni det verkliga utfallet förrän Skatteverkets slutbesked
   kommer (månader senare)? Om en användare betalar baserat på er
   uppskattning men sedan nekas avdraget av Skatteverket, är ni
   återbetalningsskyldiga? Det här behöver ett tydligt svar innan skarp
   betalning aktiveras.
8. **Säsongsberoende kassaflöde.** Deklarationssäsongen (ca februari–maj)
   koncentrerar troligen merparten av Deklar-intäkterna till några
   månader per år — påverkar likviditetsplanering.
9. **Tullsyn-specifika hot:** konjunkturnedgång minskar importvolymer och
   därmed kundunderlaget; EU:s TARIC-regler och tullavtal ändras och
   kräver kontinuerlig bevakning; TARIC-datan laddas ner manuellt månadsvis
   — ett operativt beroende som lätt glöms bort.

## 3. Svagheter i idén (inte externa hot, utan inneboende i konceptet)

1. **"Garbage in, garbage out."** Hela värdet bygger på att användaren ger
   korrekt information i intervjun — ni har idag inget sätt att verifiera
   detta (se krav på kunden, punkt 4).
2. **Svag teknisk moat.** Regelmotorerna är i grunden villkorslogik baserad
   på offentligt tillgänglig skatteinformation. Inget hindrar en konkurrent
   från att bygga något likvärdigt — ert försprång ligger i exekvering,
   varumärke och kundrelationer, inte i teknisk unikhet.
3. **Två väldigt olika kundsegment under ett varumärke.** Privatpersoner
   (självbetjäning, låg biljettpris, hög volym) och företag (manuell
   leverans, hög biljettpris, låg volym) kräver olika säljprocesser,
   olika marknadsföring, och riskerar att sprida ett litet teams fokus
   tunt över två väldigt olika verksamheter.
4. **Kontinuerligt underhållsbehov.** Det här är inte en engångsprodukt —
   varje regel måste uppdateras årligen när skattesatser ändras. Om
   utvecklingstakten avtar (t.ex. om grundaren blir upptagen med annat)
   riskerar produkten att tysta fel in i nästa deklarationssäsong.
5. **Tullsyn är inte skalbart än.** En manuell Python-pipeline som körs åt
   varje kund kräver er tid per kund — begränsar hur många kunder ni kan
   hantera samtidigt utan att antingen automatisera eller anställa.
6. **No-cure-no-pay kan attrahera "svåra" case.** Användare med enkla,
   redan korrekt ifyllda deklarationer har ingen anledning att använda er
   (ni hittar inget, de betalar inget) — medan användare som förväntar sig
   stora, komplexa avdrag kan vara mer tidskrävande att stödja.

## 4. Möjligheter till affärsutveckling

Idéer att överväga när grunden är stabil — inte saker att bygga nu:

- **Whitelabel/B2B2C:** licensiera regelmotorn till redovisnings- eller
  revisionsbyråer som ett verktyg de använder åt sina egna kunder.
- **Förmånspartnerskap:** erbjud Klarsyn som en anställningsförmån via
  HR-avdelningar eller fackförbund.
- **Prenumerationsmodell** som komplement till success fee, för kunder som
  vill ha återkommande kontroll år efter år.
- **Integration med bokföringsprogram** (Fortnox, Visma, Bokio) för att
  automatiskt hämta underlag istället för manuell filuppladdning.
- **Utöka Tullsyn proaktivt:** rådgivning *innan* import (klassificering,
  frihandelsavtal) istället för bara efterhandsgranskning av fakturor.
- **Anonymiserad, aggregerad statistik** ("svenskar missar i snitt X kr i
  RUT-avdrag") som PR- och marknadsföringsmaterial.
- **Internationell expansion** — kräver att regelmotorn är byggd modulärt
  per land, vilket den redan är (varje regel är isolerad).

## 5. Krav på kunden — så att fel data inte blir ert ansvar

Grundprincipen: **ni ska aldrig kunna hållas ansvariga för ett fel som
berodde på att kunden gav er fel uppgifter**, och kunden ska ha ett eget
underlag att luta sig mot om Skatteverket ifrågasätter något.

1. **Explicit intygande innan beräkning.** Innan resultatet visas: en
   tydlig bekräftelse — "Jag intygar att uppgifterna jag lämnat är
   korrekta och fullständiga efter bästa förmåga." Sparas med
   tidsstämpel tillsammans med svaren.
2. **Användarvillkor måste uttryckligen reglera ansvarsfördelningen:**
   Klarsyn ansvarar för att korrekt tillämpa Skatteverkets regler på den
   data användaren lämnat — inte för konsekvenser av felaktig eller
   ofullständig data från användaren själv.
3. **Spara ett granskningsbart svarsspår.** Ni krypterar redan svaren
   (`underlagStorage.ts`) — komplettera med tidsstämpel och version av
   regelverket som användes, så att om Skatteverket ifrågasätter något
   ett år senare kan användaren (och ni) visa exakt vad som låg till
   grund för beräkningen. Sen 2026-08-11 sparas även själva den
   uppladdade deklarationsfilen (`uploadedFileStorage.ts`) och en hash av
   den länkas in i svarsspåret (`sourceDocument`-fältet) — så att ni kan
   visa exakt vilket original-underlag ett givet råd byggde på, inte bara
   vilka svar kunden gav. Samma caveat som svarsspåret: klientsidan
   (IndexedDB) tills Fas 7:s krypterade serverlagring finns —
   `UploadedDocument`-modellen är redan skissad i `prisma/schema.prisma`.
4. **Uppmuntra/kräv referens till underlag per avdrag.** Ni har redan
   `dokumentationskrav` i varje guide-mall (bra grund!) — nästa steg är
   att aktivt fråga i intervjun: "Har du kvitto/faktura/kontrolluppgift
   som styrker detta?" och spara ett ja/nej-svar (inte nödvändigtvis
   filen själv, om ni vill undvika att lagra ytterligare känsliga
   dokument) som en del av svarsspåret.
5. **Var tydlig om vad "avdrag hittat" betyder.** Texten bör alltid
   kommunicera "vi har identifierat att du sannolikt kan göra detta
   avdrag baserat på dina svar" — inte "detta är garanterat korrekt".
   Undviker att skapa ett skenbart löfte ni inte kan hålla.

## 6. Bevisunderlag per avdragstyp — vad Skatteverket kan begära

Redan delvis byggt i `dokumentationskrav`-fälten i guide-mallarna — här är
en samlad översikt att stämma av mot, och komplettera vid behov:

| Avdrag | Underlag att spara/kunna visa |
|---|---|
| Resor (bil) | Reseräkning/körjournal med avstånd, resdagar, och underlag för tidsbesparingskravet (t.ex. jämförelse av restid) |
| Resor (kollektivt) | Kvitton/biljetter eller periodkort-kvitto |
| Dubbel bosättning | Hyreskontrakt för tillfällig bostad, anställningsbevis, avståndsunderlag |
| Ränta | Kontrolluppgift/årsbesked från bank eller långivare |
| RUT/ROT | Fakturor med specificerad arbetskostnad från utförare |
| Gåvor | Kvitton/bekräftelser från gåvomottagaren med belopp och datum |
| Krypto | Fullständig transaktionshistorik från börsen/plånboken |

**Rekommendation:** gör det här till en aktiv del av produkten, inte bara
dokumentation — t.ex. en avslutande checklista i rapporten: "Innan du
skickar in, se till att du har sparat: [lista baserat på vilka avdrag som
hittades]."

## 7. Betalningsbindning — hur säkerställa att kunden faktiskt betalar

Grundproblemet har två sidor, och det finns ingen lösning som tar bort
båda riskerna helt — bara ett val om vilken risk ni hellre bär:

- **Betala vid upplåsning (nuvarande arkitektur):** ni får betalt direkt,
  men om Skatteverket sen nekar avdraget har ni tagit betalt för något
  som inte blev av — återbetalningsrisk.
- **Betala efter att kunden fått sin återbäring:** ni slipper
  återbetalningsrisken, men får istället ett indrivningsproblem — inget
  hindrar kunden från att bara inte höra av sig när pengarna väl kommit.

### Tre alternativ, i stigande bindningsgrad (och komplexitet)

**1. Enkel påminnelse + avtalstext (billigast att bygga)**
En tydlig text kunden godkänner ("Jag åtar mig att betala 25 % inom 14
dagar efter att jag mottagit min skatteåterbäring") plus ett automatiskt
mejl som skickas ut runt när Skatteverkets utbetalningar brukar komma.
Skapar ingen teknisk bindning — bara ett avtal ni i värsta fall kan
skicka till inkasso. Svagast mot kunder som medvetet undviker att betala.

**2. Sparat kort, dras automatiskt senare (rekommenderas som första steg)**
Vid attesteringssteget: be kunden lägga till ett kort (via t.ex. Stripe)
med uttryckligt samtycke till en framtida debitering "upp till X % av
vad vi hittar åt dig". Ni sparar bara en token, inga kortuppgifter rör
er egen server. När det är dags att ta betalt drar ni beloppet
automatiskt utan att kunden behöver göra något aktivt. Vanlig modell
hos brittiska skatteåterbäringsbolag (RIFT, Tax Rebate Services) — de
säkrar betalningsmedlet innan de lämnar över resultatet.
- **Varför inte Swish här:** Swish kräver att kunden aktivt godkänner
  *varje* betalning i sin app i realtid — går inte att dra pengar i
  efterhand utan att kunden öppnar appen och godkänner. Bra känsla när
  kunden själv initierar, men fungerar inte som bakomliggande automatisk
  debitering.

**3. BankID-signerat avtal + Autogiro (starkast bindning, mest jobb)**
Kunden legitimerar sig med BankID och skriver samtidigt under ett
riktigt, tidsstämplat avtal *och* ett Autogiro-medgivande (kontobaserad
dragning utan kortauktorisationers 7–30-dagarsgräns — viktigt eftersom
Skatteverkets utbetalning kan dröja månader). Ger en verklig juridisk och
praktisk grund om någon vägrar betala. Kräver en BankID-leverantör (t.ex.
Criipto, Scrive, Signicat) och Autogiro-anslutning via banken — **båda
blockerade tills bolaget är registrerat**, precis som Swish/Klarna.

### Att researcha snarare än anta
Vissa liknande tjänster utomlands låter myndigheten betala ut pengarna
*direkt till ombudets konto*, som sedan drar sin avgift och
vidarebefordrar resten. Värt att kontrollera om Skatteverket
överhuvudtaget tillåter att en återbäring styrs om till tredje part —
sannolikt nej (klassisk bedrägerivektor, skattekontot är hårt knutet
till det egna bankkontot), men bör verifieras snarare än antas. Om det
visar sig möjligt löser det hela problemet på en gång.

### Rekommendation
Börja med **alternativ 2** (sparat kort + samtycke) när en riktig
betalningsleverantör finns på plats — rimlig komplexitet, ger en verklig
indrivningsmekanism utan att vänta på bolagsregistrering och
BankID-avtal. Lägg alternativ 3 som en naturlig uppgradering längre fram,
i samma veva som Swish/Klarna sätts upp för bolaget.

## 8. Prioriterad åtgärdslista (kort sikt)

1. Bestäm bolagsform — prata med jurist/revisor.
2. Skriv användarvillkor + integritetspolicy (kan börja som utkast innan
   juridisk granskning) — inkludera betalningsvillkoren från punkt 7.
3. ~~Lägg till intygande-steg + svarsspår med tidsstämpel i intervjuflödet.~~
   **Klart** (2026-08-09) — se `apps/deklar/src/lib/answerTrail.ts` och
   attesteringssteget i `apps/deklar/src/app/interview/page.tsx`.
   ~~Spara/visa den uppladdade deklarationsfilen och länka den till
   svarsspåret.~~ **Klart** (2026-08-11) — se
   `apps/deklar/src/lib/uploadedFileStorage.ts`. Kvar: flytta båda från
   klientsidans sessionStorage/IndexedDB till riktig krypterad
   serverlagring (Fas 7, `AnswerSet`- och `UploadedDocument`-modellerna
   finns redan i `prisma/schema.prisma`).
   Angående "betala bara på det vi hittar utöver vad kunden redan gjort
   själv": redan hanterat i sak av varje regels "redan förifyllt/redan
   hanterat"-gating (se t.ex. `ranta.ts`, `rutRot.ts`) som ger
   `amountOre: 0` för sådant kunden redan fått — värt att dubbelkolla att
   gatingen är fullständig när fler avdragsområden läggs till, snarare än
   att bygga en separat "baseline vs. delta"-mekanism.
4. Bestäm betalningsmodell (se punkt 7) — sparat kort rekommenderas som
   första steg — innan skarp betalning aktiveras.
5. Sätt upp en årlig rutin för att verifiera alla skatteregler inför varje
   ny deklarationssäsong.
6. Verifiera regulatoriskt läge för skatterådgivning som tjänst.
7. Verifiera om Skatteverket tillåter omdirigerad återbäring till tredje
   part (se punkt 7) — skulle förenkla betalningsproblemet radikalt om
   möjligt.
