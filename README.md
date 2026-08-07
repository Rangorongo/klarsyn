# Klarsyn

Klarsyn hjälper företag och privatpersoner hitta pengar de annars skulle
missa — i tullfakturor och i skattedeklarationer. Ett bolag, två fristående
produkter, samlade i ett monorepo.

## Produkter

| App | Vad det är | Målgrupp | Stack | Status |
|---|---|---|---|---|
| [`apps/deklar`](apps/deklar) | Hittar skatteavdrag och skattemissar i den svenska inkomstdeklarationen | Privatpersoner | Next.js, TypeScript, Prisma/Postgres, Claude AI | Prototyp — se `apps/deklar/docs` för status |
| [`apps/tullsyn`](apps/tullsyn) | Granskar tullfakturor mot EU:s TARIC-data för felklassificeringar, outnyttjade frihandelsavtal m.m. | Importföretag | Python, Google Gemini | Prototyp, körs som CLI-pipeline |
| [`apps/tullsyn-web`](apps/tullsyn-web) | Marknadsföringssajt för Tullsyn | — | Statisk HTML/CSS/JS | Live-innehåll, ingen backend |
| [`apps/klarsyn-web`](apps/klarsyn-web) | Gemensam varumärkessajt som länkar till båda produkterna | — | TBD | Under uppbyggnad |

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

- `apps/tullsyn-web` låg tidigare på GitHub Pages från sitt eget repo —
  att fortsätta hosta den så kräver ett separat deploy-steg nu när den
  ligger i en undermapp av monorepot, inte i repo-roten.
- `apps/klarsyn-web` är ännu bara en platshållare.
