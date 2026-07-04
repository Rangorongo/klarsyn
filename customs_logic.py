"""
customs_logic.py

Systemets kärnlogik för tullrevision — den digitala tullrevisorn.
Modulen tar emot validerad data från extractor.py och jämför den mot
officiell TARIC-data för att identifiera potentiella fel och överbetalningar.

Huvudsakliga uppgifter:
    - Slår upp korrekt tullsats för varje vara via TARIC
    - Kontrollerar att HS-koden matchar varubeskrivningen
    - Identifierar om frihandelsavtal kunde ha utnyttjats
    - Beräknar potentiell återbetalning i EUR
    - Flaggar alla avvikelser för manuell granskning
"""

from taric import load_taric_data, lookup_duty, verify_hs_description


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

        # 1. Kontrollera att HS-kod och ursprungsland finns
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
                        f"💶 Potentiell återbetalning för {description}: "
                        f"{duty_paid:.2f} {currency} "
                        f"(MFN {mfn_duty} på tullvärde {customs_value:.2f} {currency})"
                    )
        except (ValueError, TypeError):
            pass

        # 6. Flagga NAR-tullar som kräver manuell kontroll
        if "NAR" in str(mfn_duty):
            flags.append(
                f"🔍 Manuell kontroll krävs för {description} ({hs_code}) "
                f"— specifik tullsats (NAR) gäller, ej procentbaserad"
            )

    final_output["audit_flags"] = flags
    final_output["potential_savings"] = round(potential_savings, 2)
    final_output["currency"] = currency

    return final_output
