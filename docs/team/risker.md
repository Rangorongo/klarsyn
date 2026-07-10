# Riskregister — vad som behöver granskas, bevakas och lösas

*Per 2026-07-11. Varje risk anges med allvarlighetsgrad, nuvarande skydd
och vad som återstår att granska. Juridiska punkter är flaggade — de
kräver riktig juridisk rådgivning, det här dokumentet är inte det.*

Allvarlighetsgrad: 🔴 hög (kan skada kund eller affär), 🟡 medel, 🟢 låg.

---

## A. Affärskritiska risker

### A1. 🔴 Systemet är obevisat mot riktiga fakturor
Allt är verifierat mot genererade testfakturor (16/16 träffar) — men
riktiga fakturor har layouter, språkblandningar och kvalitetsproblem som
testfakturorna inte fångar.
**Skydd idag:** tvåpass-extraktion med självkontroll, konfidensdomar,
aritmetiska rimlighetskontroller.
**Att granska:** kör 5–10 riktiga fakturor från en pilotkund och granska
varje extraktion manuellt mot originalet innan något fynd kommuniceras.

### A2. 🔴 Ett felaktigt fynd kan skada förtroendet — eller mer
Om systemet påstår en felklassificering som inte stämmer och kunden agerar
på den kan det ge kostnader, badwill eller tvist.
**Skydd idag:** alla belopp formuleras som övre gränser "verifiera mot
importdeklarationen"; protokollet är explicit ett underlag, inte en
ansökan; röda fynd kräver mänsklig granskning per definition.
**Att granska:** ⚖️ ansvarsbegränsning i uppdragsavtalet och eventuell
ansvarsförsäkring — kräver juridisk rådgivning.

### A3. 🟡 Nyckelpersonberoende
Hela driften körs på en persons dator med en persons kunskap.
**Skydd idag:** allt i git (privat GitHub-repo), CI, spec-dokument,
denna teamdokumentation.
**Att granska:** backup-rutin för det som INTE ligger i git (`.env`,
`tullsyn.db`, kundmappar, `taric_data/`); åtminstone en person till med
tillgång och körkunskap.

### A4. 🟡 Affärsmodellens juridik är oklar
Success fee på återkrävd tull, och vem som får företräda kunden mot
Tullverket (ombudskrav/fullmakt).
**Skydd idag:** protokollet är utformat så att kunden/ombudet gör själva
ansökan.
**Att granska:** ⚖️ avtalsutformning, fullmakter och tullombudssamarbete —
kräver juridisk rådgivning.

---

## B. Datarisker och GDPR

### B1. 🔴 Fakturadata skickas till Googles AI-tjänst
Fakturor innehåller affärsdata och ibland personuppgifter; texten går till
Gemini (Google, sannolikt behandling utanför EU).
**Skydd idag:** PII-maskering FÖRE varje anrop (e-post, personnummer,
orgnummer, telefon); OCR körs helt lokalt.
**Att granska:** ⚖️ personuppgiftsbiträdesavtal/villkor för Gemini API,
laglig grund, information till kund i avtalet, dokumenterad
raderingsrutin. Maskeringens täckning bör också granskas mot riktiga
fakturor (namn i fritext maskas t.ex. inte idag).

### B2. 🟡 Kunddata lagras okrypterat lokalt
`tullsyn.db` (frakthistorik), kundmappar med fakturor och rapporter ligger
oskyddade på disk.
**Skydd idag:** datan lämnar inte datorn; `.gitignore` hindrar att den
råkar committas.
**Att granska:** diskkryptering (BitLocker), åtkomstskydd, raderingsrutin
per kund.

### B3. 🟡 API-nyckeln ligger i klartext i `.env`
**Skydd idag:** `.env` är gitignorad och har aldrig committats.
**Att granska:** nyckelrotation, separat nyckel per miljö när backend
byggs; aldrig skicka `.env` via mejl/chat.

---

## C. Korrekthetsrisker (tekniska)

### C1. 🔴 AI-extraktionen kan läsa fel utan att det märks
Fel belopp, fel HS-kod eller hopblandade rader ur en ovanlig fakturalayout.
**Skydd idag:** självkontrollpass med formatbevarande-regler, konfidens
per rad (låg → gul dom), aritmetikkontroller som fångar inkonsistens,
AI-verifiering av beskrivningar.
**Att granska:** felfrekvens på riktiga fakturor (A1); överväg att visa
extraherad rådata bredvid original i rapporten för snabb mänsklig koll.

### C2. 🟡 AI-verifieringens bedömningar kan vara fel åt båda håll
"Nej" på korrekt klassificering (falsklarm) eller "ja" på fel (miss).
**Skydd idag:** bedömningen är EN signal bland flera och fäller aldrig
ensam avgörandet; "osäker" ger gul dom i stället för grönt.
**Att granska:** mät falsklarm/missar på ett större eval-set (20+
fakturor); vaga TARIC-beskrivningar ("Other") ger idag medvetet "osäker".

### C3. 🟡 TARIC-datan kan vara inaktuell eller ändra format
Tulltaxan uppdateras månadsvis; nedladdningen är manuell. EU kan ändra
kolumnformat i Excel-filerna.
**Skydd idag:** färskhetsvarning >35 dagar (konsol + protokoll),
datumfiltrering av tullsatser, integrationstest som verifierar kolumnerna.
**Att granska:** kalenderrutin för månadsnedladdning; på sikt automatisk
hämtning.

### C4. 🟡 OCR kan felläsa tecken
En suddig skanning kan göra 8 till 3 — fel belopp eller HS-kod in i
granskningen.
**Skydd idag:** OCR-underlag ger aldrig gröna domar (allt minst gult),
protokollet flaggar att OCR använts, aritmetikkontrollerna fångar
inkonsistenta belopp.
**Att granska:** OCR-kvalitet på riktiga skanningar; svensk språkdata i
Tesseract-installationen.

### C5. 🟢 Villkorstullar och NAR automatiseras inte
Duty-värden som "Cond: …" och NAR (kr/kg) flaggas för manuell kontroll i
stället för att beräknas — medveten begränsning, ingen felkälla, men
begränsar automatiseringsgraden (33 703 villkorsrader finns i TARIC).

### C6. 🟢 Valutakurser kan saknas eller vara gamla
**Skydd idag:** ECB-hämtning med cache-fallback och tydlig notering;
konvertering hoppar över hellre än gissar. Batchsummering antar dessutom
en gemensam valuta — blandvalutabatchar summeras fel i SEK-raden.

---

## D. Drift- och beroenderisker

### D1. 🟡 Beroendet av Gemini free tier
Kvoter kan ta slut mitt i uppdrag; Google kan ändra villkor/priser;
`gemini-2.0-flash` har redan tappat gratiskvot.
**Skydd idag:** modellrotation över fyra modeller, anropslogg, graciös
degradering (gul dom i stället för krasch).
**Att granska:** betald nyckel före kunduppdrag; på sikt abstraktion som
tillåter byte av AI-leverantör.

### D2. 🟡 Windows-beroenden blockerar serverdrift
PDF-rapporter kräver Arial på `C:/Windows/Fonts/`; sökvägar är
Windows-formade.
**Skydd idag:** inget behov ännu (lokal drift).
**Att granska:** font-bundling och sökvägsneutralitet den dag backend/Linux
blir aktuellt.

### D3. 🟢 Globalt tillstånd tål inte parallell körning
TARIC-cache, anropslogg och OCR-flaggor är modulglobala — korrekt för
dagens sekventiella CLI, men måste göras om vid API-server med samtidiga
anrop. (OCR-flaggan orsakade redan en bugg som testerna fångade.)

### D4. 🟢 Beroendeversioner är opinnade
`requirements.txt` saknar versionslås — en framtida paketuppdatering kan
ändra beteende tyst.
**Att granska:** pinna versioner (`pip freeze`) inför första kunduppdraget.

---

## Sammanfattning: granskningsordning

1. **A1** — kör riktiga fakturor (låser upp bedömning av C1, C2, C4)
2. **B1 + A2 + A4** — ⚖️ juridikpaketet: avtal, GDPR, ombud (extern hjälp)
3. **D1** — betald nyckel
4. **A3 + B2** — backup- och skyddsrutin för lokal data
5. Resten bevakas löpande; D2–D4 blir aktuella först vid backend-steget.
