"""
kor_eval.py

Kör eval-setet: granskar varje testfaktura med den riktiga pipelinen
och jämför resultatet mot facit.json. Skriver träffsäkerheten till
konsolen och till eval/resultat.md.

KVOTVARNING: varje faktura kostar 3 Gemini-anrop (2 extraktion +
1 verifiering). Hela setet = 15 anrop av gratiskvotens 20/dag.

Kör hela setet:      python eval/kor_eval.py
Kör enstaka fakturor: python eval/kor_eval.py eval_02_felklassificerad.pdf eval_05_fta_missad.pdf
"""

import json
import os
import sys
from datetime import date

# Windows-terminalen använder cp1252 som standard och kraschar på tecken
# som ≈ och emoji — tvinga UTF-8 så att utskrifterna alltid fungerar.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Gör att skriptet hittar main.py oavsett varifrån det körs
PROJEKTROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJEKTROT)

from main import run_pipeline  # noqa: E402  (importen kräver sys.path-raden ovan)

EVALMAPP = os.path.join(PROJEKTROT, "eval")
FAKTURAMAPP = os.path.join(EVALMAPP, "fakturor")


def _kontrollera(forvantning: dict, resultat: dict) -> bool:
    """Utvärderar EN förväntning från facit mot pipelinens resultat."""
    kontroll = forvantning["kontroll"]
    flaggor = resultat.get("audit_flags", [])
    items = resultat.get("items", [])

    if kontroll == "flagga_med":
        return any(forvantning["text"] in f for f in flaggor)

    if kontroll == "ingen_flagga_med":
        return not any(forvantning["text"] in f for f in flaggor)

    if kontroll == "antal_roda":
        antal = sum(1 for i in items if i.get("verdict") == "röd")
        return antal == forvantning["varde"]

    if kontroll == "vara_har_dom":
        for item in items:
            if forvantning["vara"].lower() in str(item.get("description", "")).lower():
                return item.get("verdict") == forvantning["dom"]
        return False  # varan hittades inte alls i extraktionen

    if kontroll == "besparing_minst":
        return float(resultat.get("potential_savings", 0)) >= forvantning["varde"]

    raise ValueError(f"Okänd kontrolltyp i facit: {kontroll}")


def main():
    with open(os.path.join(EVALMAPP, "facit.json"), encoding="utf-8") as f:
        facit = json.load(f)

    # Valfritt: kör bara utpekade fakturor (spar kvot)
    urval = sys.argv[1:]
    if urval:
        facit = {k: v for k, v in facit.items() if k in urval}

    rapportrader = [f"# Eval-resultat {date.today().isoformat()}", ""]
    totalt_ratt, totalt_antal = 0, 0

    for filnamn, spec in facit.items():
        sokvag = os.path.join(FAKTURAMAPP, filnamn)
        print(f"\n{'=' * 60}\n{filnamn}: {spec['beskrivning']}\n{'=' * 60}")
        rapportrader.append(f"## {filnamn}")
        rapportrader.append(f"*{spec['beskrivning']}*")
        rapportrader.append("")

        try:
            resultat = run_pipeline(sokvag)
        except Exception as e:
            print(f"KUNDE INTE KÖRAS: {e}")
            rapportrader.append(f"- KUNDE INTE KÖRAS: {e}")
            rapportrader.append("")
            continue

        if resultat is None:
            print("KUNDE INTE KÖRAS: extraktionen gav inget resultat")
            rapportrader.append("- KUNDE INTE KÖRAS: extraktionen gav inget resultat")
            rapportrader.append("")
            continue

        for forvantning in spec["forvantningar"]:
            traff = _kontrollera(forvantning, resultat)
            symbol = "TRÄFF " if traff else "MISS  "
            print(f"  [{symbol}] {forvantning['namn']}")
            rapportrader.append(f"- {'✅' if traff else '❌'} {forvantning['namn']}")
            totalt_ratt += int(traff)
            totalt_antal += 1
        rapportrader.append("")

    if totalt_antal:
        procent = 100 * totalt_ratt / totalt_antal
        slutrad = f"TRÄFFSÄKERHET: {totalt_ratt}/{totalt_antal} ({procent:.0f} %)"
        print(f"\n{'=' * 60}\n{slutrad}")
        rapportrader.insert(2, f"**{slutrad}**")
        rapportrader.insert(3, "")

    with open(os.path.join(EVALMAPP, "resultat.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(rapportrader))
    print(f"Resultat sparat till eval/resultat.md")


if __name__ == "__main__":
    main()
