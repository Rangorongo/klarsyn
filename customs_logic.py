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

from taric import load_taric_data, lookup_duty, verify_hs_description


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

    for item in items:
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
        except (ValueError, TypeError):
            pass

        # 1b. Lyft fram varor där AI:ns självkontroll var osäker
        if item.get("confidence") == "låg":
            anledning = item.get("review_note") or "ingen specifik anledning angiven"
            flags.append(
                f"🟡 Låg konfidens från AI-granskningen för {description}: {anledning}"
            )

        # 1c. Kontrollera att HS-kod och ursprungsland finns
        if not hs_code:
            flags.append(f"⚠️ Saknar HS-kod: {description}")
            continue

        if not country:
            flags.append(f"⚠️ Saknar ursprungsland: {description}")
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

        # 3. Flagga om HS-koden inte hittas i TARIC
        if taric_description == "Ej hittad":
            flags.append(
                f"🔴 HS-kod {hs_code} hittades inte i TARIC för: {description} "
                f"— kan vara felklassificerad"
            )

        # 4. Flagga om frihandelsavtal finns men verkar inte utnyttjat
        if has_fta and preferential_duty and "0" in str(preferential_duty):
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
        if "NAR" in str(mfn_duty):
            flags.append(
                f"🔍 Manuell kontroll krävs för {description} ({hs_code}) "
                f"— specifik tullsats (NAR) gäller, ej procentbaserad"
            )

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
    except (ValueError, TypeError):
        pass

    final_output["audit_flags"] = flags
    final_output["potential_savings"] = round(potential_savings, 2)
    final_output["currency"] = currency

    return final_output
