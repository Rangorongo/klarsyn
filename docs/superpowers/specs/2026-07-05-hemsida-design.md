# Design: Tullsyns landningssida (tullsyn-web)

**Datum:** 2026-07-05
**Status:** Godkänd av Romeo (premium-designspråket, ej Apple-varianten)

## Syfte

Marknadsföringssida som säljer tjänsten till importerande SME:er
(målgrupp: ekonomichefer/ägare). Besökarens nästa steg: mejla för
kostnadsfri provgranskning av 3 fakturor.

## Beslut

- **Omfattning:** ren statisk marknadsföringssida — ingen inloggning/uppladdning
  (kräver backend, ligger i backloggen).
- **Publicering:** GitHub Pages kräver publikt repo → **separat publikt repo
  `Rangorongo/tullsyn-web`** med enbart hemsidan. Affärslogiken förblir privat
  i tullsyn-repot. URL: rangorongo.github.io/tullsyn-web (egen domän kan
  kopplas senare).
- **CTA:** mailto-länk till romeo.roudneshin@gmail.com med förifyllt ämne
  "Provgranskning — Tullsyn" och mall i brödtexten (företag, kontaktperson).

## Designspråk (låst efter mockup-rundor)

- Varm ljus bas `#FBFAF7`, vita kort `#FFFFFF` med tunn kant `#E8E5DC`,
  rundade hörn 10–14 px
- Text: mörk charcoal `#111827`, sekundär `#6B7280`
- En dämpad grön accent `#0F6E56` (pengar/godkänt); domfärger i demon:
  grön `#639922`, gul `#EF9F27`, röd `#E24B4A`
- Mörk CTA-knapp `#1F2937` med len hover
- Typsnitt: Inter (Google Fonts)
- Animationer: lugna — scroll-intoning (IntersectionObserver, fade + 6 px
  slide, ~450 ms ease), uppräknande siffror (requestAnimationFrame,
  ease-out cubic), hero-demon loopar. Aldrig studsigt.

## Sidstruktur (en sida)

1. **Header** — TULLSYN-ordmärke, ankarlänkar (Så funkar det · Pris ·
   Vanliga frågor), mörk CTA-knapp. Fastnar överst (sticky) med tunn kant.
2. **Hero** — grön badge "Betala bara när vi hittar pengar", H1 "Era
   tullfakturor döljer pengar. Vi hittar dem.", en menings under-text,
   CTA + "Svar inom 48 timmar". Höger: animerad gransknings-demo
   (5 fakturarader får domar en i taget, summa räknas upp till 219,70 kr,
   loopar). Mobil: demon staplas under.
3. **Problemet** — tre punkter: felklassificerade HS-koder, outnyttjade
   frihandelsavtal, ingen hinner granska varje rad manuellt.
4. **Så funkar det** — tre steg-kort med Tabler-ikoner: Skicka fakturor
   (PDF räcker) → Vi granskar (varje rad mot EU:s tulltaxa TARIC) →
   Ni får tillbaka (vi tar 25 % av det vi hittar).
5. **Siffror** — fyra animerade räknare/fakta: 100 % träffsäkerhet i
   kontrollprov · 3 år bakåt · EU:s officiella TARIC-data · GDPR-maskering
   innan AI-analys.
6. **Pris** — mörk sektion: "25 % av det vi hittar. Hittar vi inget
   betalar ni inget." + ingen prenumeration/inga systembyten/ingen risk.
7. **Vanliga frågor** — details/summary-expanderare: datahantering (GDPR,
   maskering, radering), vem signerar mot Tullverket (Tullsyn hittar och
   dokumenterar; omprövning görs tillsammans med er/tullombud), vilka
   fakturor (digitala PDF:er, import till EU, upp till 3 år), tidsåtgång
   (provgranskning inom 48 h).
8. **Slut-CTA + footer** — upprepad mejlknapp, kontakt, © Tullsyn 2026.

## Ärlighetskrav (samma princip som produkten)

- Träffsäkerheten anges som "100 % i vårt kontrollprov (16 av 16 planterade
  fel)" — aldrig som generellt löfte.
- Återbetalningsbelopp beskrivs som "möjliga" och verifieras mot
  importdeklaration innan krav ställs.
- Inga påhittade kundcitat eller logotyper — sektionen läggs till först
  när riktiga referenser finns.

## Teknik

- Tre filer: `index.html`, `style.css`, `script.js` — ren HTML/CSS/JS,
  inga ramverk, inget byggsteg. Texter kan redigeras direkt i HTML.
- Ikoner: Tabler Icons webfont via CDN.
- Inga cookies, ingen tracking → ingen cookie-banner.
- Responsiv: CSS grid/flex med brytpunkt ~720 px.
- Publicering: GitHub Pages från master-grenen i tullsyn-web-repot,
  aktiveras via GitHub API.

## Klart-kriterier

1. Sidan live på rangorongo.github.io/tullsyn-web utan konsolfel.
2. Demon animerar och loopar; räknarna triggas vid scroll.
3. Mailto-CTA öppnar mejl med förifyllt ämne.
4. Läsbar och korrekt på mobilbredd (375 px) och desktop.
