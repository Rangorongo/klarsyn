"""
customs_logic.py

Systemets kärnlogik för tullrevision — den digitala tullrevisorn.
Modulen tar emot validerad data från extractor.py och jämför den mot
officiell TARIC-data för att identifiera potentiella fel och överbetalningar.

Huvudsakliga uppgifter:
    - Slår upp korrekt tullsats för varje vara via TARIC
    - Kontrollerar att HS-koden matchar varubeskrivningen
    - Identifierar om frihandelsavtal kunde ha utnyttjats
    - Beräknar möjlig återbetalning i EUR (övre gräns — se nedan)
    - Kontrollerar fakturans aritmetik (antal × pris, radsumma + frakt)
    - Lyfter fram varor där AI:ns självkontroll var osäker
    - Flaggar alla avvikelser för manuell granskning

Viktigt om besparingsbeloppen:
    Fakturan visar aldrig vilken tull som faktiskt BETALADES — det gör bara
    importdeklarationen. Beloppen här är därför en ÖVRE GRÄNS som gäller
    endast om MFN-tull betalades vid importen. Det ska alltid framgå i
    rapporten, så att vi aldrig lovar kunden pengar som inte finns.
"""

from taric import load_taric_data, lookup_antidumping, lookup_duty, verify_hs_description
from verifier import verify_hs_matches


def _avviker(forvantat: float, faktiskt: float) -> bool:
    """
    Avgör om två belopp skiljer sig mer än toleransen.

    Toleransen är 1 öre/cent eller 0,5 % av det förväntade beloppet
    (det största av dem) — vanliga avrundningsören ska inte ge falsklarm.
    """
    tolerans = max(0.01, 0.005 * abs(forvantat))
    return abs(forvantat - faktiskt) > tolerans


def run_customs_audit(final_output: dict) -> dict:
    """
    Utför en automatiserad tullgranskning av extraherad faktурadata.

    Analyserar varje vara i fakturan mot officiell TARIC-data och
    flaggar avvikelser som kan indikera överbetalda tullar.

    Args:
        final_output (dict): Extraherad och validerad faktурadata enligt
            CustomsInvoice-schemat.

    Returns:
        dict: Samma dictionary utökad med audit_flags och potential_savings
    """
    print("Kör tullanalys...")

    # Ladda TARIC-data en gång för alla varor
    taric_data = load_taric_data()

    flags = []
    potential_savings = 0.0
    items = final_output.get("items", [])
    currency = final_output.get("currency", "EUR")

    # Signaler som bygger slutdomen per vara: röda skäl tvingar domen "röd",
    # gula skäl ger "gul" (om inget rött finns), annars blir varan "grön".
    roda_skal = {i: [] for i in range(len(items))}
    gula_skal = {i: [] for i in range(len(items))}

    # Underlag för åtgärdslistan
    fta_mojligheter = []      # varor med beräknad möjlig återbetalning
    add_varor = []            # varor med möjlig antidumpningstull
    fakturatotal_fel = False  # totalbeloppet stämmer inte med raderna

    for i, item in enumerate(items):
        description = item.get("description", "Okänd vara")
        hs_code = item.get("hs_code")
        country = item.get("country_of_origin")
        total_price = float(item.get("total_item_price") or 0)
        shipping = float(final_output.get("shipping_cost") or 0)

        # 1a. Aritmetikkontroll: antal × styckpris ska stämma med radpriset.
        # Körs FÖRE HS-kontrollen — räknefel ska hittas även på ofullständiga rader.
        try:
            quantity = item.get("quantity")
            unit_price = item.get("unit_price")
            if quantity is not None and unit_price is not None:
                forvantat_radpris = float(quantity) * float(unit_price)
                if _avviker(forvantat_radpris, total_price):
                    flags.append(
                        f"🧮 Räknefel på varurad: {description} — "
                        f"{quantity} × {unit_price} = {forvantat_radpris:.2f}, "
                        f"men radpriset anger {total_price:.2f}"
                    )
                    roda_skal[i].append("Räknefel på raden (antal × pris stämmer inte med radpriset)")
        except (ValueError, TypeError):
            pass

        # 1b. Lyft fram varor där AI:ns självkontroll var osäker
        if item.get("confidence") == "låg":
            anledning = item.get("review_note") or "ingen specifik anledning angiven"
            flags.append(
                f"🟡 Låg konfidens från AI-granskningen för {description}: {anledning}"
            )
            gula_skal[i].append(f"Låg konfidens i AI:ns självkontroll: {anledning}")

        # 1c. Kontrollera att HS-kod och ursprungsland finns
        if not hs_code:
            flags.append(f"⚠️ Saknar HS-kod: {description}")
            roda_skal[i].append("HS-kod saknas — varan kan inte granskas mot TARIC")
            continue

        if not country:
            flags.append(f"⚠️ Saknar ursprungsland: {description}")
            roda_skal[i].append("Ursprungsland saknas — tullsatsen kan inte avgöras")
            continue

        # 2. Slå upp tullsats i TARIC
        duty_result = lookup_duty(hs_code, country, taric_data)
        desc_result = verify_hs_description(hs_code, description, taric_data)

        mfn_duty = duty_result.get("mfn_duty", "")
        has_fta = duty_result.get("has_fta", False)
        preferential_duty = duty_result.get("preferential_duty")
        taric_description = desc_result.get("taric_description", "Ej hittad")

        # Spara TARIC-info på varan
        item["taric_mfn_duty"] = mfn_duty
        item["taric_description"] = taric_description
        item["has_fta"] = has_fta
        item["preferential_duty"] = preferential_duty

        # 2b. Antidumpningstull? Missad ADD kan ge tulltillägg i efterhand.
        add_duty = lookup_antidumping(hs_code, country, taric_data)
        if add_duty:
            flags.append(
                f"🚨 Antidumpningstull kan gälla för {description} från {country}: "
                f"{add_duty} — kontrollera att den deklarerats"
            )
            gula_skal[i].append(
                f"Antidumpningstull kan gälla ({add_duty}) — kontrollera deklarationen"
            )
            add_varor.append(description)

        # 3. Flagga om HS-koden inte hittas i TARIC
        if taric_description == "Ej hittad":
            flags.append(
                f"🔴 HS-kod {hs_code} hittades inte i TARIC för: {description} "
                f"— kan vara felklassificerad"
            )
            roda_skal[i].append("HS-koden finns inte i TARIC-nomenklaturen")

        # 4. Flagga om frihandelsavtal finns men verkar inte utnyttjat.
        # EU-varor hoppas över: de har ingen importtull alls, så det finns
        # inget frihandelsavtal att "utnyttja" — en flagga vore bara brus.
        ar_eu_vara = "EU" in str(duty_result.get("note", ""))
        if not ar_eu_vara and has_fta and preferential_duty and "0" in str(preferential_duty):
            flags.append(
                f"💰 Möjlig besparing: {description} från {country} kan importeras "
                f"tullfritt via frihandelsavtal (EPA/FTA) — verifiera att detta utnyttjats"
            )

        # 5. Beräkna potentiell besparing om MFN-tull betalats istället för FTA
        try:
            if mfn_duty and "%" in str(mfn_duty):
                rate_str = str(mfn_duty).replace("%", "").strip()
                rate = float(rate_str) / 100
                # Tullvärde = varupris + frakt (CIF)
                customs_value = total_price + (shipping / max(len(items), 1))
                duty_paid = customs_value * rate

                if duty_paid > 0 and has_fta:
                    potential_savings += duty_paid
                    fta_mojligheter.append(description)
                    flags.append(
                        f"💶 Möjlig återbetalning för {description}: "
                        f"upp till {duty_paid:.2f} {currency} "
                        f"(MFN {mfn_duty} på tullvärde {customs_value:.2f} {currency}) "
                        f"— gäller endast om MFN-tull betalades vid importen, "
                        f"kontrollera importdeklarationen"
                    )
        except (ValueError, TypeError):
            pass

        # 6. Flagga NAR-tullar som kräver manuell kontroll
        if "manuell kontroll" in str(mfn_duty).lower():
            flags.append(
                f"🔍 Manuell kontroll krävs för {description} ({hs_code}) "
                f"— {mfn_duty}"
            )
            gula_skal[i].append(f"Specialtullsats ({mfn_duty}) — kräver manuell kontroll")

    # 7. Aritmetikkontroll på fakturanivå: radsumma + frakt ska stämma
    # med fakturans totalbelopp (om det finns angivet).
    try:
        total_invoice = final_output.get("total_invoice_amount")
        if total_invoice is not None and items:
            radsumma = sum(float(i.get("total_item_price") or 0) for i in items)
            frakt = float(final_output.get("shipping_cost") or 0)
            forvantad_total = radsumma + frakt
            if _avviker(forvantad_total, float(total_invoice)):
                flags.append(
                    f"🧮 Fakturans totalbelopp stämmer inte: radsumma + frakt = "
                    f"{forvantad_total:.2f}, men fakturan anger {float(total_invoice):.2f}"
                )
                fakturatotal_fel = True
    except (ValueError, TypeError):
        pass

    # 8. AI-verifiering: matchar varubeskrivningarna sina TARIC-beskrivningar?
    # EN Gemini-förfrågan för alla verifierbara rader (de med hittad beskrivning).
    verifierbara = [
        {
            "index": i,
            "hs_code": items[i].get("hs_code"),
            "invoice_description": items[i].get("description", "Okänd vara"),
            "taric_description": items[i].get("taric_description"),
        }
        for i in range(len(items))
        if items[i].get("taric_description") and items[i].get("taric_description") != "Ej hittad"
    ]

    ai_bedomningar = verify_hs_matches(verifierbara) if verifierbara else {}

    if ai_bedomningar is None:
        # Kvot slut eller serverfel — degradera snyggt, krascha aldrig.
        for rad in verifierbara:
            gula_skal[rad["index"]].append(
                "AI-verifieringen kunde inte köras (kvot/serverfel) — granska manuellt"
            )
    else:
        for rad in verifierbara:
            idx = rad["index"]
            bedomning = ai_bedomningar.get(idx)
            if bedomning is None:
                gula_skal[idx].append("AI-verifieringen gav inget svar för denna rad")
                continue
            matchar, motivering = bedomning
            beskrivning = items[idx].get("description", "Okänd vara")
            if str(matchar).lower() == "nej":
                roda_skal[idx].append(f"AI: beskrivningen matchar inte TARIC — {motivering}")
                flags.append(
                    f"🔴 Trolig felklassificering: {beskrivning} matchar inte "
                    f"TARIC-beskrivningen '{items[idx].get('taric_description')}' — {motivering}"
                )
            elif str(matchar).lower() == "osäker":
                gula_skal[idx].append(f"AI osäker på beskrivningsmatchningen — {motivering}")
                flags.append(f"🟡 Osäker klassificering: {beskrivning} — {motivering}")

    # 9. Slutdom per vara: röda skäl vinner över gula, annars grön.
    verdict_summary = {"grön": 0, "gul": 0, "röd": 0}
    for i, item in enumerate(items):
        if roda_skal[i]:
            item["verdict"] = "röd"
            item["verdict_reasons"] = roda_skal[i] + gula_skal[i]
        elif gula_skal[i]:
            item["verdict"] = "gul"
            item["verdict_reasons"] = gula_skal[i]
        else:
            item["verdict"] = "grön"
            item["verdict_reasons"] = ["Alla kontroller överens"]
        verdict_summary[item["verdict"]] += 1

    # 10. Åtgärdslista — konkreta nästa steg för kunden, hög prioritet först.
    # Härleds från domskälen så att varje problem får en tydlig handling.
    action_items = []
    for i, item in enumerate(items):
        namn = item.get("description", "Okänd vara")
        for skal in roda_skal[i]:
            if "matchar inte TARIC" in skal:
                action_items.append({
                    "prioritet": "hög",
                    "atgard": f"Låt tullombud verifiera HS-koden för {namn} — trolig "
                              f"felklassificering. Omprövning kan begäras hos Tullverket "
                              f"upp till 3 år bakåt."
                })
            elif "finns inte i TARIC" in skal:
                action_items.append({
                    "prioritet": "hög",
                    "atgard": f"Rätta HS-koden för {namn} — koden finns inte i tulltaxan."
                })
            elif "saknas" in skal.lower():
                action_items.append({
                    "prioritet": "hög",
                    "atgard": f"Komplettera fakturaunderlaget från leverantören: "
                              f"{namn} — {skal.split(' — ')[0].lower()}."
                })
            elif "Räknefel" in skal:
                action_items.append({
                    "prioritet": "hög",
                    "atgard": f"Stäm av beloppen för {namn} med leverantören innan "
                              f"underlaget används i deklarationen."
                })
        for skal in gula_skal[i]:
            if "NAR" in skal or "villkorstull" in skal:
                action_items.append({
                    "prioritet": "medel",
                    "atgard": f"Låt tullombud bedöma specialtullsatsen för {namn} "
                              f"(NAR eller villkorsbaserad sats)."
                })
            elif "Antidumpning" in skal:
                continue  # får en egen hög-prioritetsåtgärd nedan
            else:
                action_items.append({
                    "prioritet": "medel",
                    "atgard": f"Dubbelkolla varuraden {namn} mot originalfakturan — {skal}."
                })

    for namn in add_varor:
        action_items.append({
            "prioritet": "hög",
            "atgard": f"Kontrollera omgående att antidumpningstullen deklarerats "
                      f"för {namn} — missad ADD kan ge tulltillägg i efterhand."
        })

    for namn in fta_mojligheter:
        action_items.append({
            "prioritet": "medel",
            "atgard": f"Begär ursprungsintyg (EUR.1/REX) för {namn} från leverantören och "
                      f"kontrollera i importdeklarationen om preferenstull yrkades."
        })

    if fakturatotal_fel:
        action_items.append({
            "prioritet": "hög",
            "atgard": "Stäm av fakturans totalbelopp med leverantören — "
                      "radsumman plus frakt stämmer inte med angivet totalbelopp."
        })

    action_items.sort(key=lambda a: 0 if a["prioritet"] == "hög" else 1)

    final_output["audit_flags"] = flags
    final_output["potential_savings"] = round(potential_savings, 2)
    final_output["currency"] = currency
    final_output["verdict_summary"] = verdict_summary
    final_output["action_items"] = action_items

    return final_output
