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
| Ränta, RUT/ROT, Gåvor, Resor | ✅ Verifierade mot Skatteverket (2026-08-09) |
| Krypto (schablonmetoden) | ✅ Stabil, väletablerad regel |
| Dubbel bosättning | ⚠️ Beräknar inget belopp än, bara "kräver manuell kontroll" — avsiktligt minimalt eller en lucka? |
| Kapitalförlust aktier/fonder | Medvetet inte byggd — Skatteverket sköter oftast detta automatiskt |
| **Alla regler, varje år** | Belopp/trösklar ändras årligen (redan sett: reseavdragets tröskel höjs till 15 000 kr från inkomstår 2026). **Sätt upp en årlig rutin** för att kontrollera samtliga siffror mot Skatteverkets nya belopp inför varje deklarationssäsong. |
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
   grund för beräkningen.
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

## 7. Prioriterad åtgärdslista (kort sikt)

1. Bestäm bolagsform — prata med jurist/revisor.
2. Skriv användarvillkor + integritetspolicy (kan börja som utkast innan
   juridisk granskning).
3. Lägg till intygande-steg + svarsspår med tidsstämpel i intervjuflödet.
4. Bestäm hur ni hanterar "betalat men avdraget nekades senare" innan
   skarp betalning aktiveras.
5. Sätt upp en årlig rutin för att verifiera alla skatteregler inför varje
   ny deklarationssäsong.
6. Verifiera regulatoriskt läge för skatterådgivning som tjänst.
