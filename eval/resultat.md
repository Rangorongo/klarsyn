# Eval-resultat 2026-07-05

**TRÄFFSÄKERHET: 16/16 (100 %)**

Körd i två omgångar pga dagskvot: eval_01–04 i första körningen,
eval_05 i andra (efter minutkvot-återhämtning). eval_05:s besparingskontroll
verifierad mot sparad audit-CSV (potential_savings = 219.70 EUR).

## eval_01_korrekt.pdf
*Helt korrekt faktura — mäter falsklarm*

- ✅ Inga röda domar
- ✅ Inga räknefelsflaggor
- ✅ Inga saknat fält-flaggor
- ✅ Ingen felklassificeringsflagga

## eval_02_felklassificerad.pdf
*Läderhandskar under kretskorts-HS-kod — AI:n ska upptäcka det*

- ✅ Felklassificeringen flaggas
- ✅ Handskarna döms röda
- ✅ Kretskortet förblir grönt

## eval_03_raknefel.pdf
*Radsumma 5×100=480 (fel) och totalbelopp 910 (fel, ska vara 810)*

- ✅ Radfelet flaggas
- ✅ Totalfelet flaggas
- ✅ Raden med räknefel döms röd

## eval_04_saknade_falt.pdf
*Rad 1 saknar HS-kod, rad 2 saknar ursprungsland — AI:n får inte hitta på*

- ✅ Saknad HS-kod flaggas
- ✅ Saknat ursprungsland flaggas
- ✅ Båda raderna döms röda

## eval_05_fta_missad.pdf
*Polypropylen från Japan: MFN 6.5% men EPA ger 0% — möjlig återbetalning*

- ✅ Återbetalningen flaggas
- ✅ FTA-möjligheten flaggas
- ✅ Besparing minst 200 EUR (uppmätt: 219.70 EUR)

## Noteringar från körningen

- Modellrotationen (llm_klient.py) räddade samtliga anrop utom ett genom att
  hoppa mellan gratis-modellerna när kvoter tog slut — utan den hade körningen
  stannat efter första fakturan.
- gemini-2.0-flash rapporterar `limit: 0` på free tier — den modellen verkar
  sakna gratiskvot numera och kan tas bort ur rotationslistan.
- Buggfix i denna körning: kor_eval.py kraschade på ≈-tecknet i Windows-
  terminalens cp1252-kodning — fixat med sys.stdout.reconfigure(utf-8).
