# Deklar — molnbaserad webbapp med betalning (design)

Status: godkänd, redo för implementation
Datum: 2026-07-29
Ersätter: `2026-07-29-fas1-lokal-avdragskontroll-design.md` (se SUPERSEDED-banner i det dokumentet)

## Syfte

Deklar ska hjälpa unga vuxna hitta skatteavdrag och skattemissar de annars skulle missa i sin svenska inkomstdeklaration, med en dynamisk quiz, en regelmotor + AI-scanning (krypto, resor, dubbel bosättning), en steg-för-steg-guide för att faktiskt deklarera hos Skatteverket, och en betalspärr (Swish/Klarna) för att låsa upp fullständiga resultat.

## Beslut: molnapp istället för lokal CLI

Den tidigare planen (`Fas 1`) var en lokal, gratis, offline Python-CLI utan betalning, med betalmodellen medvetet frikopplad till en framtida odesignad `Fas 5`. Ägaren har beslutat att hoppa direkt till den molnbaserade webbappen med riktig betalning nu. Detta dokument är den nya, gällande designen. Den statiska UX-mockupen (`mockup/`) behålls oförändrad som permanent design-/copy-referens och portas in i den riktiga appen istället för att kastas.

## Stack

- **Next.js** (App Router, TypeScript) — en app för frontend + API-routes, ingen separat backend.
- **Postgres** (EU-hostad, t.ex. Neon/Supabase) via **Prisma**.
- **Auth.js** (NextAuth v5) med e-post magic-link för MVP. BankID är en naturlig framtida uppgradering men delad blockering med Swish/Klarna-live (svenskt org.nr) — se Öppna frågor.
- **Anthropic Claude** (`@anthropic-ai/sdk`) för avgränsade AI-assisterade uppgifter.
- **Zod** vid varje datagräns.
- Inläsning av Skatteverkets XML/PDF sker i TypeScript (`fast-xml-parser`, `pdf-parse`/`unpdf`) — ingen separat Python-tjänst, samma enkel-ansvar-per-modul-filosofi som den gamla planen (ingestion / rules / questionnaire / guide / storage, var och en ovetande om de andra).

## Projektstruktur

```
/prisma/schema.prisma

/src
  /app
    /(marketing)/page.tsx              -- landning (portar mockup view-landing)
    /upload/page.tsx                   -- dropzone (portar view-upload)
    /interview/page.tsx                -- adaptiv quiz (portar view-interview)
    /report/[reportId]/page.tsx        -- resultat + betalspärr (portar view-report)
    /account/page.tsx                  -- session, radera-min-data
    /auth/signin/page.tsx
    /api/auth/[...nextauth]/route.ts
    /api/upload/route.ts
    /api/questionnaire/next/route.ts
    /api/report/[reportId]/compute/route.ts
    /api/report/[reportId]/guide/route.ts
    /api/payments/swish/create|callback/route.ts
    /api/payments/klarna/create|webhook/route.ts
    /api/account/delete/route.ts

  /lib
    /ingestion/skatteverket/{xmlParser,pdfParser,models,redactPersonnummer}.ts
    /rules/{types,registry,resor,dubbelBosattning,krypto}.ts
    /questionnaire/{types,engine}.ts
    /ai/{claude,validateAiOutput}.ts + /ai/prompts/*.ts
    /guide/{generate}.ts + /guide/templates/*.ts
    /payments/{types}.ts + /payments/swish/client.ts + /payments/klarna/client.ts
    /storage/{encryption,blobStorage}.ts
    /db/prisma.ts
    /auth/authOptions.ts

  /components
  /styles/globals.css

/tests

mockup/   -- oförändrad, permanent designreferens
```

## Regelmotor

En modul per avdragstyp, samma `check/questions/compute`-mönster som den gamla planen valde:
- `appliesTo(underlag)` — är regeln överhuvudtaget relevant givet inläst data.
- `questions(underlag, tidigareSvar)` — anropas varje steg, kan förgrena sig baserat på tidigare svar.
- `compute(underlag, svar)` — returnerar `{ badge, title, amount: number|null, motivation, source, needsReview }`. `amount` är `null` endast när posten är genuint icke-numerisk utan manuell kontroll (dubbel bosättning) — aldrig en tyst ersättning för "ej berättigad". Saknat/ogiltigt obligatoriskt svar ger alltid `needsReview: true`, aldrig ett tyst 0.

Initiala regler: `resor.ts`, `dubbelBosattning.ts`, `krypto.ts` (schablonmetoden).

## Dynamisk frågeflöde

Pull-baserat, omräknat varje steg (inte ett statiskt förberäknat träd): varje steg frågar `RuleRegistry.getApplicable(underlag)` om kandidatregler, sedan varje regels `questions()` om nästa obesvarade fråga. Uppladdad fildata smalnar av omfattningen både på regelnivå (`appliesTo`) och frågenivå (`prefillFrom`). Förloppsindikatorn ("Fråga X av Y") har en levande nämnare eftersom grenar kan växa/krympa den.

## AI (Claude) — skyddsräcken mot hallucination

Exakt tre avgränsade användningar:
1. **Fritextolkning** — extraherar strukturerade fält (Zod-validerat via tvingad tool-use). Matar bara `compute()`:s indata, aldrig dess utdata.
2. **Flaggning av oklara fall** (främst dubbel bosättning) — returnerar endast `{ needsReview, explanation }`; schemat har inget belopp-fält alls.
3. **Guidetext-formulering** — putsar bara språket givet redan beräknade fakta som fast indata; `validateAiOutput.ts` kontrollerar att varje siffra i den genererade texten matchar en siffra i källdatan, annars faller systemet tillbaka på mallens råtext.

## Steg-för-steg Skatteverket-guide

En mall per avdragstyp (ruta/bilaga-referens, dokumentationskrav, ordnade steg), fylld från regelns beräknade resultat, ev. putsad av Claude (med samma guard som ovan). Lagras som strukturerad steglista, inte fri text.

## Betalning: Swish + Klarna (riktig sandbox)

Direkt integration mot båda (inte via tredjeparts-PSP): Klarna Playground-sandbox, Swish MSS-testmiljö (mTLS, kräver publikt nåbar HTTPS-callback). Enhetligt bakom ett `PaymentProvider`-interface, separata konkreta klienter eftersom API:erna är strukturellt olika.

**Blockerare för skarp drift (inte dev/test):** Swish kräver svenskt org.nr + bank-utfärdat Swish-nummer; Klarnas skarpa handlarsavtal har liknande krav. Båda sandlådorna fungerar direkt utan detta. Rekommendation: starta svensk bolagsregistrering parallellt med utvecklingen.

## Auth, kryptering, GDPR

- Auth.js + Prisma-adapter, e-post magic-link, databas-sessioner (återkallningsbara).
- Personnummer lagras aldrig — redigeras bort vid parsning (`redactPersonnummer.ts`) innan det når databasen.
- AES-256-GCM-kryptering på blob-nivå över `Underlag`, `AnswerMap` och uppladdade filer.
- `/api/account/delete` gör en riktig kaskaderande hård radering, ingen mjuk flagga.

## Faserad byggordning

0. Städning (detta dokument + SUPERSEDED-banner).
1. Scaffold (Next.js, verktyg, Prisma, CI, designtokens).
2. Datamodell + regelmotor (ingen UI).
3. Inläsning/parsning.
4. Frågeflöde-UI + adaptiv motor.
5. AI-integration.
6. Rapport + guidegenerering.
7. Auth + kryptering + GDPR.
8. Betalning/betalspärr.
9. Polering/härdning.

## Öppna frågor / att verifiera senare

1. Swish/Klarna kräver svensk bolagsregistrering för skarp drift.
2. BankID-inlogg delar samma beroende, uteslutet ur MVP.
3. Ingen riktig Skatteverket-XML/PDF finns ännu att validera parsern mot.
4. Exakta aktuella trösklar/satser för resor och dubbel bosättning måste hämtas från Skatteverkets publicerade regler vid implementationstillfället.
5. Val av DB/hosting-region: rekommenderar EU.
