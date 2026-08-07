# Klarsyn

Klarsyn hjälper företag och privatpersoner hitta pengar de annars skulle
missa — i tullfakturor och i skattedeklarationer. Ett bolag, ett gemensamt
varumärke, två spår.

`apps/deklar` är numera den enda webbplatsen/appen under Klarsyn-namnet: den
betjänar både privatpersoner (`/`, självbetjänings-flödet i `/upload` →
`/interview` → `/report`) och företag (`/foretag`, marknadsföring + kontakt
för den mer manuella Tullsyn-tjänsten). All backend-logik från den tidigare
Deklar-appen (auth, kryptering, regelmotor, AI, betalning) är oförändrad —
bara namnet och designen är nytt.

## Appar

| App | Vad det är | Målgrupp | Stack | Status |
|---|---|---|---|---|
| [`apps/deklar`](apps/deklar) | Klarsyns webbplats: `/` + självbetjänings-flöde för privatpersoner, `/foretag` för företag | Privatpersoner + företag | Next.js, TypeScript, Prisma/Postgres, Claude AI | Prototyp — se `apps/deklar/docs` för status |
| [`apps/tullsyn`](apps/tullsyn) | Granskar tullfakturor mot EU:s TARIC-data för felklassificeringar, outnyttjade frihandelsavtal m.m. — den faktiska tjänsten bakom `/foretag` | Importföretag | Python, Google Gemini | Prototyp, körs som CLI-pipeline, levereras manuellt |
| [`apps/tullsyn-web`](apps/tullsyn-web) | Tullsyns tidigare fristående marknadssajt | — | Statisk HTML/CSS/JS | Ersatt av `apps/deklar/foretag` — se Kända uppföljningspunkter |

## Varför monorepo

Produkterna delar ingen kod (helt olika tech stacks), men samlas i ett repo
för att en enskild utvecklare/litet team ska ha en tydlig, granskningsbar
bas — en plats att öppna, en historik att följa, en uppsättning
CI-workflows att underhålla. Varje app är fortfarande tekniskt oberoende:
egna beroenden, egen `.gitignore` där det behövs, egen CI-workflow
(`.github/workflows/deklar-ci.yml`, `.github/workflows/tullsyn-ci.yml`)
som bara triggas av ändringar i respektive `apps/*`-mapp.

Historiken för Deklar, Tullsyn och tullsyn-web är bevarad från deras
tidigare separata repon (importerade med `git subtree`) — `git log` visar
allt som hänt i respektive app innan sammanslagningen.

## Säkerhet & data — gemensamma principer för alla appar

- Hemligheter (API-nycklar, DB-uppkopplingar) lever bara i lokala
  `.env`-filer, aldrig i git. Verifierat: ingen `.env` har någonsin
  committats i någon av de sammanslagna historikerna.
- Persondata krypteras (se `apps/deklar/src/lib/storage/encryption.ts`)
  och personnummer redigeras bort vid inläsning innan de når databasen
  (`apps/deklar/src/lib/ingestion/skatteverket/redactPersonnummer.ts`).
  Kontodata kan raderas hårt och kaskaderande (`apps/deklar/src/app/api/account/delete`).
- Tullsyns genererade rapporter (innehåller kunders fakturadata) är
  gitignorade i `apps/tullsyn/.gitignore` — de lämnar aldrig repot.
- Nya appar/moduler i det här repot ska följa samma princip: känslig data
  krypteras eller redigeras bort vid källan, hemligheter i `.env` som
  aldrig committas.

## Dokumentation

Designspecar för hela bolaget/produkterna ligger i [`docs/superpowers/specs`](docs/superpowers/specs).
Varje app kan också ha egen dokumentation i sin egen mapp (se
`apps/deklar/docs`, `apps/tullsyn/docs`).

## Kända uppföljningspunkter

- `apps/tullsyn-web` är kvar i repot (historik bevarad) men dess innehåll
  har ersatts av `apps/deklar/src/app/foretag`. Besluta om den ska tas bort
  helt eller behållas som arkiv.
- `/foretag`-sidans "Boka ett samtal"-knapp länkar till en platshållar-adress
  (`hej@klarsyn.se`) — byt till en riktig adress innan sidan går live.
- Ingen backend/databas för leads än — kontaktvägen för företag är just nu
  bara en mailto-länk, inte ett formulär som sparas i databasen.
