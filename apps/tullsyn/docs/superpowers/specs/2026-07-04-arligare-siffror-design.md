# Design: Ärligare siffror — korrekt feedback utan överlöften

**Datum:** 2026-07-04
**Status:** Godkänd av Romeo (via chatt)

## Syfte

Rapporten ska aldrig lova pengar som kanske inte finns. Idag räknas hela
MFN-tullen som "potentiell återbetalning" så fort ett frihandelsavtal *finns* —
men fakturan bevisar inte vilken tull som faktiskt *betalades* (det gör bara
importdeklarationen). Dessutom samlas AI:ns konfidensbedömning in men används
aldrig, och rena räknefel på fakturan upptäcks inte alls.

Allt i denna design är kvotfritt — inga nya Gemini-anrop.

## Ändringar

### A. Ärlig besparingsformulering (customs_logic.py + utils.py)

- 💶-flaggan omformuleras: *"Möjlig återbetalning för X: upp till N EUR (MFN ... på
  tullvärde ...) — gäller ENDAST om MFN-tull betalades vid import, kontrollera
  importdeklarationen"*.
- PDF-rapportens rubrik ändras från "Potentiell återbetalning" till
  **"Möjlig återbetalning (övre gräns)"** med en förklarande rad under:
  beloppet förutsätter att MFN-tull betalades; verifiera mot importdeklarationen
  innan återbetalning söks hos Tullverket.
- Beräkningen i sig behålls (den är korrekt som övre gräns) och nyckeln
  `potential_savings` behåller sitt namn (CSV/PDF-exporten beror på den).

### B. Aritmetikkontroller (customs_logic.py — nya AI-fria flaggor)

- **Radnivå:** `antal × styckpris` jämförs med radpriset. Avvikelse större än
  toleransen ger 🧮-flagga med båda beloppen utskrivna.
- **Fakturanivå:** summan av alla radpriser + frakt jämförs med fakturans
  totalbelopp (om det finns). Avvikelse ger 🧮-flagga.
- **Tolerans:** `max(0,01; 0,5 % av förväntat belopp)` — avrundningsören ska
  inte ge falsklarm.
- Kontrollerna körs FÖRE HS-kod/ursprungskontrollen eftersom de inte behöver
  TARIC — en vara utan HS-kod ska ändå få sina räknefel flaggade.

### C. Konfidensfältet används (customs_logic.py)

- Varje vara där självkontrollen satte `confidence: "låg"` får en 🟡-flagga med
  texten från `review_note` (eller "ingen specifik anledning angiven" om tom).
- Körs också före HS-kod-kontrollen, av samma skäl som ovan.

### D. Tester (tests/test_customs_logic.py)

Nya kvotfria testfall:

| Testfall | Förväntat |
|----------|-----------|
| 2 × 10 men radpris 25 | 🧮-flagga |
| 2 × 10 och radpris 20 | ingen 🧮-flagga |
| Radpris avviker < 1 öre | ingen 🧮-flagga (tolerans) |
| Radsumma + frakt ≠ totalbelopp | 🧮-flagga |
| `confidence: "låg"` med review_note | 🟡-flagga som innehåller notens text |
| `confidence: "hög"` | ingen 🟡-flagga |
| 💶-flaggans text | innehåller "om MFN-tull betalades" och "importdeklarationen" |

Befintliga 17 tester ska fortsätta gå grönt.

## Avgränsningar

- Ingen inläsning av importdeklarationer ännu (framtida spår — då kan "möjlig"
  uppgraderas till "bekräftad" överbetalning).
- Ingen ändring av extractor-prompterna.
