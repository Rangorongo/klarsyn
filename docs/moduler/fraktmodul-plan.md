# Fraktmodul (freight) — implementationsplan

Status: PLANERAD (modul 2, byggs efter att tullmodulen är klar)
Plats i repo när den byggs: `modules/freight/`

## Varför frakt som modul två

* Samma kundgrupp som tullmodulen: importerande/exporterande SME:er.
* Branschdata visar att en stor andel av fraktfakturor innehåller fel — fynd är
  nästan garanterade, vilket success fee-modellen kräver.
* Tekniskt nästan identisk pipeline som tull: PDF → AI-extraktion → självkontroll
  → jämför mot facit → konfidens → flaggor → rapport. Enda skillnaden är
  dokumenttyp och facit (fraktavtal/index istället för TARIC).
* Krav riktas direkt mot transportören (ingen myndighetsprocess som hos
  Tullverket) → snabbare pengar till kunden.
* Korskoppling med tullmodulen: fel fraktkostnad → fel tullvärde (CIF) → fel tull
  och importmoms. En hittad fraktöverdebitering kan trigga omräkning i
  tullmodulen. Detta är plattformens unika styrka.

## Arkitektur

Följer samma modulmönster som tull:

```
modules/freight/
├── schema.py    Pydantic-modeller (FreightInvoice, Shipment, SurchargeLine)
├── facit.py     Jämförelsedata: transportörens tilläggsindex, senare kundens avtal
└── rules.py     Granskningsregler → audit_flags + potential_savings
```

Delade delar (extraktion, självkontroll, konfidenslogik, rapporter) ligger i
`core/` och återanvänds från tullmodulen utan ändringar.

## Datamodell (schema.py)

**FreightInvoice** — fakturanivå:

* invoice_number, invoice_date, carrier_name (DHL/DSV/Schenker...), currency,
  total_invoice_amount, shipments[]

**Shipment** — per sändning:

* tracking_number (kritiskt för dubblettkontroll), ship_date, origin,
  destination, service_level
* actual_weight_kg, billed_weight_kg, mått (length/width/height_cm)
* base_freight, surcharges[], total_charge
* confidence + review_note (fylls i av självkontrollen, samma som tull)

**SurchargeLine** — per tilläggsavgift:

* name, amount, percentage (om angiven i %)

Princip (samma som tull): fält som inte står i fakturan = None. AI:n får aldrig
gissa. Format bevaras exakt (inga omskrivningar av koder/namn).

## Granskningsregler — Version 1 (AVTALSLÖSA)

Kräver INTE kundens fraktavtal → ger fynd från dag ett:

1. **Dubbeldebitering**
   * Samma tracking_number mer än en gång inom fakturan → flagga + hela beloppet
     som potential_savings.
   * Mot historik: jämför mot tracking_numbers från kundens tidigare fakturor
     (kräver att vi sparar dem — databastabell i backendsteget).
   * Sändning utan tracking_number → flagga "dubblettkontroll ej möjlig".
2. **Volymviktskontroll**
   * Volymvikt = (L × B × H cm³) / divisor. Standard-divisor 5000
     (internationell express); konfigurerbar per transportör i facit.py.
   * Debiterad vikt ska vara max(verklig vikt, volymvikt).
   * Debiterad vikt > förväntad + tolerans (0.5 kg, pga transportörers
     avrundning) → flagga "överdebiterad vikt, begär omräkning".
3. **Summakontroller**
   * Radnivå: grundfrakt + summa(tillägg) = sändningens total (tolerans ~0.05
     för öresavrundning). Positiv avvikelse → savings.
   * Fakturanivå: summa(sändningarnas totaler) = fakturans totalbelopp.
     Avvikelse → flagga (odeklarerade avgifter eller extraktionsfel).
4. **Orimliga procenttillägg**
   * Bränsletillägg m.fl. över taknivå (~35 %) → flagga för manuell kontroll
     mot transportörens publicerade index.
5. **Låg AI-konfidens** (från självkontrollen i core)
   * confidence == "låg" → alltid flagga för manuell granskning med review_note
     som motivering. Samma princip som tull: AI:ns självskattning är en signal,
     koden fattar beslutet.

## Granskningsregler — Version 2 (KRÄVER FACIT)

Byggs när facit.py finns:

1. **Tilläggsindex-kontroll**: jämför fakturerat bränsletillägg mot
   transportörens publicerade veckoindex (DHL/UPS m.fl. publicerar öppet).
2. **Avtalskontroll**: extrahera kundens fraktavtal (rabattmatriser, zonpriser,
   minimidebiteringar) och jämför varje sändning. OBS: avtalen är
   ostandardiserade PDF:er — detta är modulens svåraste extraktionsproblem,
   därav V2 och inte V1.
3. **Money-back guarantee (GSR)**: expressavtal ger ofta återbetalning vid
   försening — kräver leveransdata (tracking-API) utöver fakturan.

## Kopplingar till övriga systemet

* core/extractor.py: generaliseras så den tar (text, Pydantic-schema) istället
  för att vara hårdkodad mot CustomsInvoice. Självkontrollen med formatbevarande
  och review_note-regler återanvänds rakt av.
* Databas (backendsteget): ny tabell för tracking_numbers per kund, krävs för
  dubblettkontroll mot historik.
* API: /analyze?module=freight — samma uppladdningsflöde som tull.
* Rapport: samma CSV/PDF-generator; flaggorna följer samma emoji-konvention
  (🔴 kritiskt, 💰 besparing, ⚠️ avvikelse, 🔍 manuell kontroll).

## Öppna frågor / att läsa på

* Volymviktsdivisorer per transportör och tjänst (4000/5000/6000).
* Vilka transportörers tilläggsindex som ska stödjas först (börja med den
  vanligaste hos våra pilotkunder).
* Juridik kring att driva krav mot transportör å kundens vägnar (fullmakt).
* Incoterms-hantering: vem som ska betala frakten överhuvudtaget.

## Ordningsföljd

1. Tullmodulen klar (TARIC-konfidenskoppling återstår).
2. Refaktorera till core/ + modules/customs/ (ingen logikändring).
3. Bygg freight V1 (avtalslösa kontroller ovan).
4. Backend/API-steget (FastAPI + SQLite) med båda modulerna.
5. Freight V2 (facit: index + avtal).
