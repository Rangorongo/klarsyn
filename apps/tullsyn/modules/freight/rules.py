"""
modules/freight/rules.py

Fraktmodulens granskningsregler — den digitala fraktrevisorn.

Version 1: avtalslösa kontroller som ger fynd utan att kundens fraktavtal
behövs. Facit-baserade kontroller (transportörsindex, avtal, GSR) läggs
till i V2 via facit.py.

Kontroller:
    1. Dubbeldebitering — samma tracking-nummer flera gånger i fakturan
    2. Volymviktskontroll — debiterad vikt mot max(verklig, volymvikt)
    3. Summakontroller — radnivå (grundfrakt + tillägg) och fakturanivå
    4. Orimliga procenttillägg — bränsle m.m. över taknivån
    5. Låg AI-konfidens — självkontrollens osäkerhet lyfts alltid fram

Samma dom- och rapportmönster som tullmodulen: flaggor för människor,
strukturerade findings för revisionsprotokollet, grön/gul/röd per sändning.
"""

from modules.freight.facit import (
    BELOPPSTOLERANS,
    MAX_PROCENTTILLAGG,
    VIKTTOLERANS_KG,
    hamta_divisor,
)


def _namn(shipment: dict, index: int) -> str:
    """Mänskligt namn på en sändning: tracking-nummer eller radnummer."""
    return shipment.get("tracking_number") or f"sändning {index + 1}"


def run_freight_audit(final_output: dict, historik_traffar: dict = None) -> dict:
    """
    Utför en automatiserad fraktrevision av extraherad fakturadata.

    Args:
        final_output (dict): Extraherad fraktfakturadata enligt
            FreightInvoice-schemat.
        historik_traffar (dict): {tracking_number: tidigare_faktura} från
            kundens historik (core/historik.py) — sändningar som redan
            debiterats på TIDIGARE fakturor.

    Returns:
        dict: Samma dictionary utökad med audit_flags, findings,
        potential_savings, action_items och verdicts per sändning.
    """
    print("Kör fraktrevision...")

    flags = []
    findings = []
    action_items = []
    potential_savings = 0.0
    shipments = final_output.get("shipments", [])
    currency = final_output.get("currency") or "EUR"
    carrier = final_output.get("carrier_name")
    divisor = hamta_divisor(carrier)

    roda_skal = {i: [] for i in range(len(shipments))}
    gula_skal = {i: [] for i in range(len(shipments))}
    historik_traffar = historik_traffar or {}

    # 0. Dubbeldebitering ÖVER TID: tracking-nummer som redan debiterats
    # på en tidigare faktura enligt kundens historik.
    for i, s in enumerate(shipments):
        tracking = s.get("tracking_number")
        if tracking and tracking in historik_traffar:
            tidigare = historik_traffar[tracking]
            belopp = float(s.get("total_charge") or 0)
            flags.append(
                f"🔴 Dubbeldebitering över tid: {tracking} debiterades redan på "
                f"faktura {tidigare} — {belopp:.2f} {currency} kan vara dubbelt debiterat"
            )
            roda_skal[i].append(f"Tracking-nummer {tracking} redan debiterat på faktura {tidigare}")
            potential_savings += belopp
            findings.append({
                "modul": "frakt",
                "kategori": "DUBBELDEBITERING",
                "objekt": _namn(s, i),
                "beskrivning": f"Tracking-nummer {tracking} är redan debiterat på den "
                               f"tidigare fakturan {tidigare} enligt kundens historik.",
                "belopp": belopp,
                "berakning": f"Dubblettens hela belopp: {belopp:.2f} {currency}",
                "referens": f"Tracking-nummer {tracking}, tidigare faktura {tidigare}",
                "atgard": "Begär kreditering av dubbeldebiteringen från transportören "
                          "med båda fakturorna som underlag.",
            })
            action_items.append({
                "prioritet": "hög",
                "atgard": f"Begär kreditering av {belopp:.2f} {currency} — {tracking} "
                          f"debiterades även på faktura {tidigare}."
            })

    # 1. Dubbeldebitering: samma tracking-nummer mer än en gång i fakturan.
    sedda_tracking = {}
    for i, s in enumerate(shipments):
        tracking = s.get("tracking_number")
        namn = _namn(s, i)

        if not tracking:
            flags.append(
                f"⚠️ {namn} saknar tracking-nummer — dubblettkontroll ej möjlig"
            )
            gula_skal[i].append("Tracking-nummer saknas — dubblettkontroll ej möjlig")
            action_items.append({
                "prioritet": "medel",
                "atgard": f"Begär tracking-nummer från transportören för {namn} "
                          f"så att dubblettkontroll kan göras."
            })
            continue

        nyckel = str(tracking).strip().upper()
        if nyckel in sedda_tracking:
            belopp = float(s.get("total_charge") or 0)
            flags.append(
                f"🔴 Dubbeldebitering: tracking-nummer {tracking} förekommer flera "
                f"gånger på fakturan — {belopp:.2f} {currency} kan vara dubbelt debiterat"
            )
            roda_skal[i].append(f"Dubbeldebitering av tracking-nummer {tracking}")
            potential_savings += belopp
            findings.append({
                "modul": "frakt",
                "kategori": "DUBBELDEBITERING",
                "objekt": namn,
                "beskrivning": f"Tracking-nummer {tracking} är debiterat mer än en gång "
                               f"på samma faktura (rad {sedda_tracking[nyckel] + 1} och rad {i + 1}).",
                "belopp": belopp,
                "berakning": f"Dubblettens hela belopp: {belopp:.2f} {currency}",
                "referens": f"Tracking-nummer {tracking}",
                "atgard": "Begär kreditering av dubbeldebiteringen från transportören.",
            })
            action_items.append({
                "prioritet": "hög",
                "atgard": f"Begär kreditering av {belopp:.2f} {currency} för "
                          f"dubbeldebiterad sändning {tracking}."
            })
        else:
            sedda_tracking[nyckel] = i

    for i, s in enumerate(shipments):
        namn = _namn(s, i)

        # 2. Volymviktskontroll: debiterad vikt ska vara max(verklig, volymvikt).
        try:
            actual = s.get("actual_weight_kg")
            billed = s.get("billed_weight_kg")
            l, b, h = s.get("length_cm"), s.get("width_cm"), s.get("height_cm")
            if all(v is not None for v in (actual, billed, l, b, h)):
                volymvikt = (float(l) * float(b) * float(h)) / divisor
                forvantad = max(float(actual), volymvikt)
                if float(billed) > forvantad + VIKTTOLERANS_KG:
                    flags.append(
                        f"🧮 Överdebiterad vikt för {namn}: debiterad {float(billed):.1f} kg, "
                        f"men max(verklig {float(actual):.1f} kg, volymvikt {volymvikt:.1f} kg) "
                        f"= {forvantad:.1f} kg — begär omräkning"
                    )
                    roda_skal[i].append(
                        f"Debiterad vikt ({float(billed):.1f} kg) överstiger förväntad ({forvantad:.1f} kg)"
                    )
                    findings.append({
                        "modul": "frakt",
                        "kategori": "VIKT",
                        "objekt": namn,
                        "beskrivning": f"Debiterad vikt {float(billed):.1f} kg överstiger den "
                                       f"förväntade debiteringsvikten {forvantad:.1f} kg.",
                        "belopp": None,
                        "berakning": f"Volymvikt = {l} × {b} × {h} / {divisor} = {volymvikt:.1f} kg; "
                                     f"förväntad debiterad = max({float(actual):.1f}; {volymvikt:.1f}) "
                                     f"= {forvantad:.1f} kg; tolerans {VIKTTOLERANS_KG} kg",
                        "referens": f"Volymviktsdivisor {divisor} ({carrier or 'standard'})",
                        "atgard": "Begär omräkning av fraktkostnaden baserat på korrekt vikt.",
                    })
                    action_items.append({
                        "prioritet": "hög",
                        "atgard": f"Begär omräkning av {namn} — debiterad vikt "
                                  f"{float(billed):.1f} kg mot förväntad {forvantad:.1f} kg."
                    })
        except (ValueError, TypeError):
            pass

        # 3a. Summakontroll radnivå: grundfrakt + tillägg = sändningens total.
        try:
            base = s.get("base_freight")
            total = s.get("total_charge")
            if base is not None and total is not None:
                tillagg = sum(float(rad.get("amount") or 0) for rad in (s.get("surcharges") or []))
                forvantad_total = float(base) + tillagg
                diff = float(total) - forvantad_total
                if abs(diff) > BELOPPSTOLERANS:
                    flags.append(
                        f"🧮 Summafel för {namn}: grundfrakt + tillägg = "
                        f"{forvantad_total:.2f}, men debiterat {float(total):.2f} {currency}"
                    )
                    roda_skal[i].append(
                        f"Radsumman stämmer inte ({forvantad_total:.2f} förväntat, {float(total):.2f} debiterat)"
                    )
                    if diff > 0:
                        # Positiv avvikelse = odeklarerad överdebitering
                        potential_savings += diff
                        findings.append({
                            "modul": "frakt",
                            "kategori": "RÄKNEFEL",
                            "objekt": namn,
                            "beskrivning": "Debiterat belopp överstiger grundfrakt plus "
                                           "specificerade tillägg.",
                            "belopp": round(diff, 2),
                            "berakning": f"{float(total):.2f} − ({float(base):.2f} + {tillagg:.2f}) "
                                         f"= {diff:.2f} {currency}",
                            "referens": f"Sändning {namn}",
                            "atgard": "Stäm av det odeklarerade beloppet med transportören.",
                        })
                    action_items.append({
                        "prioritet": "hög",
                        "atgard": f"Stäm av beloppen för {namn} med transportören — "
                                  f"radsumman stämmer inte med specifikationen."
                    })
        except (ValueError, TypeError):
            pass

        # 4. Orimliga procenttillägg (t.ex. bränsle över taknivån).
        for rad in (s.get("surcharges") or []):
            try:
                procent = rad.get("percentage")
                if procent is not None and float(procent) > MAX_PROCENTTILLAGG:
                    flags.append(
                        f"🔍 Orimligt tillägg för {namn}: {rad.get('name', 'tillägg')} "
                        f"på {float(procent):.1f} % överstiger taknivån {MAX_PROCENTTILLAGG:.0f} % "
                        f"— kontrollera mot transportörens publicerade index"
                    )
                    gula_skal[i].append(
                        f"Tillägg {rad.get('name', '')} på {float(procent):.1f} % över taknivån"
                    )
                    findings.append({
                        "modul": "frakt",
                        "kategori": "TILLÄGG",
                        "objekt": namn,
                        "beskrivning": f"Tillägget '{rad.get('name', 'okänt')}' på "
                                       f"{float(procent):.1f} % överstiger rimlig nivå.",
                        "belopp": float(rad.get("amount") or 0) or None,
                        "berakning": f"{float(procent):.1f} % > taknivå {MAX_PROCENTTILLAGG:.0f} %",
                        "referens": f"Transportör: {carrier or 'okänd'}",
                        "atgard": "Kontrollera procentsatsen mot transportörens publicerade index.",
                    })
                    action_items.append({
                        "prioritet": "medel",
                        "atgard": f"Kontrollera tillägget '{rad.get('name', 'okänt')}' "
                                  f"({float(procent):.1f} %) för {namn} mot transportörens index."
                    })
            except (ValueError, TypeError):
                pass

        # 5. Låg konfidens från självkontrollen.
        if s.get("confidence") == "låg":
            anledning = s.get("review_note") or "ingen specifik anledning angiven"
            flags.append(f"🟡 Låg konfidens från AI-granskningen för {namn}: {anledning}")
            gula_skal[i].append(f"Låg konfidens i AI:ns självkontroll: {anledning}")
            action_items.append({
                "prioritet": "medel",
                "atgard": f"Dubbelkolla {namn} mot originalfakturan — {anledning}."
            })

    # 3b. Summakontroll fakturanivå: sändningarnas totaler mot fakturans totalbelopp.
    try:
        fakturatotal = final_output.get("total_invoice_amount")
        if fakturatotal is not None and shipments:
            radsumma = sum(float(s.get("total_charge") or 0) for s in shipments)
            if abs(radsumma - float(fakturatotal)) > BELOPPSTOLERANS:
                flags.append(
                    f"🧮 Fakturans totalbelopp stämmer inte: sändningarna summerar till "
                    f"{radsumma:.2f}, men fakturan anger {float(fakturatotal):.2f} {currency} "
                    f"— odeklarerade avgifter eller extraktionsfel"
                )
                findings.append({
                    "modul": "frakt",
                    "kategori": "RÄKNEFEL",
                    "objekt": f"Faktura {final_output.get('invoice_number', '?')}",
                    "beskrivning": "Fakturans totalbelopp stämmer inte med summan av "
                                   "sändningarnas kostnader.",
                    "belopp": round(abs(radsumma - float(fakturatotal)), 2),
                    "berakning": f"|{radsumma:.2f} − {float(fakturatotal):.2f}| = "
                                 f"{abs(radsumma - float(fakturatotal)):.2f} {currency}",
                    "referens": f"Faktura {final_output.get('invoice_number', '?')}",
                    "atgard": "Begär specifikation av mellanskillnaden från transportören.",
                })
                action_items.append({
                    "prioritet": "hög",
                    "atgard": "Begär specifikation från transportören — fakturans totalbelopp "
                              "stämmer inte med sändningarnas summa."
                })
    except (ValueError, TypeError):
        pass

    # Slutdom per sändning: röda skäl vinner över gula, annars grön.
    verdict_summary = {"grön": 0, "gul": 0, "röd": 0}
    for i, s in enumerate(shipments):
        if roda_skal[i]:
            s["verdict"] = "röd"
            s["verdict_reasons"] = roda_skal[i] + gula_skal[i]
        elif gula_skal[i]:
            s["verdict"] = "gul"
            s["verdict_reasons"] = gula_skal[i]
        else:
            s["verdict"] = "grön"
            s["verdict_reasons"] = ["Alla kontroller överens"]
        verdict_summary[s["verdict"]] += 1

    action_items.sort(key=lambda a: 0 if a["prioritet"] == "hög" else 1)

    final_output["audit_flags"] = flags
    final_output["findings"] = findings
    final_output["potential_savings"] = round(potential_savings, 2)
    final_output["currency"] = currency
    final_output["verdict_summary"] = verdict_summary
    final_output["action_items"] = action_items

    return final_output
