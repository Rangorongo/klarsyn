"""
taric.py

Hanterar uppslag mot EU:s officiella TARIC-data som laddats ner lokalt.

Så här fungerar det:
    - Vi läser in Excel-filerna från taric_data/ mappen en gång
    - För varje vara på fakturan slår vi upp tullsatsen baserat på HS-kod
    - Vi kontrollerar om ursprungslandet har ett frihandelsavtal med EU
    - Om frihandelsavtal finns men inte utnyttjats flaggar vi detta
"""

import os
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TARIC_DIR = os.path.join(BASE_DIR, "taric_data")

DUTIES_PATH = os.path.join(TARIC_DIR, "Duties Import 01-99.xlsx")
GEO_AREAS_PATH = os.path.join(TARIC_DIR, "Geographical areas description.xlsx")
GEO_COMP_PATH = os.path.join(TARIC_DIR, "Geographical areas composition.xlsx")
NOMENCLATURE_PATH = os.path.join(TARIC_DIR, "Nomenclature EN.xlsx")

# EU-länder har aldrig importtull
EU_COUNTRIES = {
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
    "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
    "NL", "PL", "PT", "RO", "SE", "SI", "SK"
}

# Mappning från landskod till namn i TARIC
COUNTRY_NAME_MAP = {
    "JP": "Japan",
    "CN": "China",
    "TW": "Taiwan",
    "KR": "Korea",
    "US": "United States",
    "GB": "United Kingdom",
    "NO": "Norway",
    "CH": "Switzerland",
    "VN": "Viet Nam",
    "IN": "India",
    "SG": "Singapore",
    "MX": "Mexico",
    "CA": "Canada",
    "AU": "Australia",
    "NZ": "New Zealand",
}


# Cache på modulnivå: Excel-filerna (~8 MB) läses bara EN gång per körning.
# Vid batchkörning av många fakturor sparar det ~30 sekunder per faktura.
_TARIC_CACHE = None


def load_taric_data() -> dict:
    """
    Läser in alla TARIC Excel-filer en gång och returnerar dem som DataFrames.
    Efterföljande anrop återanvänder samma data (cache) — ingen omläsning.

    Returns:
        dict: Innehåller fyra DataFrames: duties, geo_areas, geo_comp, nomenclature
    """
    global _TARIC_CACHE
    if _TARIC_CACHE is None:
        print("Laddar TARIC-data...")
        _TARIC_CACHE = {
            "duties": pd.read_excel(DUTIES_PATH, dtype=str),
            "geo_areas": pd.read_excel(GEO_AREAS_PATH, dtype=str),
            "geo_comp": pd.read_excel(GEO_COMP_PATH, dtype=str),
            "nomenclature": pd.read_excel(NOMENCLATURE_PATH, dtype=str),
        }
    return _TARIC_CACHE


def _giltiga_rader(df: pd.DataFrame) -> pd.DataFrame:
    """
    Filtrerar bort tullrader som inte gäller idag.

    TARIC-datan innehåller både utgångna och framtida tullsatser (kolumnerna
    Start date/End date, format DD-MM-ÅÅÅÅ). Utan detta filter kan en
    utgången sats råka väljas — ett verkligt korrekthetsfel.

    Rader med saknade eller oparsbara datum behålls (hellre en rad för
    mycket att granska än en missad tullsats).
    """
    if "Start date" not in df.columns or df.empty:
        return df

    idag = pd.Timestamp.today().normalize()
    start = pd.to_datetime(df["Start date"], format="%d-%m-%Y", errors="coerce")
    slut = pd.to_datetime(df.get("End date"), format="%d-%m-%Y", errors="coerce")

    har_borjat = start.isna() | (start <= idag)
    har_inte_slutat = slut.isna() | (slut >= idag)
    return df[har_borjat & har_inte_slutat]


def lookup_duty(hs_code: str, country_code: str, taric_data: dict) -> dict:
    """
    Slår upp tullsats och frihandelsavtal för en given HS-kod och ursprungsland.

    Logiken:
        1. Om landet är EU-land returneras 0% direkt
        2. Rensar HS-koden och söker i TARIC
        3. Hittar standard MFN-tullsatsen (gäller alla länder utan avtal)
        4. Kollar om ursprungslandet har preferenstullsats via frihandelsavtal
        5. Matchar på både landskod och landsnamn för säkrare träff

    Args:
        hs_code (str): HS-koden från fakturan, t.ex. '8534.00.00'
        country_code (str): Ursprungslandets landskod, t.ex. 'CN'
        taric_data (dict): Inläst TARIC-data från load_taric_data()

    Returns:
        dict: Tullsatser och frihandelsavtalsstatus
    """
    if country_code.upper() in EU_COUNTRIES:
        return {
            "hs_code": hs_code,
            "country_code": country_code,
            "mfn_duty": "0%",
            "preferential_duty": "0% (EU inre marknad)",
            "has_fta": True,
            "note": "EU-land — ingen importtull tillämpas"
        }

    duties_df = taric_data["duties"]
    clean_hs = hs_code.replace(".", "").ljust(10, "0")
    matches = duties_df[duties_df["Goods code"].str.strip() == clean_hs]
    # Bara tullsatser som gäller idag — utgångna/framtida rader sorteras bort
    matches = _giltiga_rader(matches)

    if matches.empty:
        return {
            "hs_code": hs_code,
            "country_code": country_code,
            "mfn_duty": "0% (ingen specifik rad — troligen tullfri)",
            "preferential_duty": None,
            "has_fta": False,
            "note": "HS-kod saknar explicit tullrad — kontrollera manuellt"
        }

    # MFN-tullsats — gäller alla länder utan avtal
    mfn = matches[
        (matches["Origin"].str.upper() == "ERGA OMNES") &
        (matches["Meas. type code"].isin(["103", "105", "106", "109"]))
    ]

    if not mfn.empty:
        duty_val = str(mfn["Duty"].iloc[0]).strip()
        if duty_val == "NAR":
            # Specifik tullsats (per kg/styck) — inte procentbaserad
            mfn_duty = "Kräver manuell kontroll (NAR)"
        elif "Cond" in duty_val:
            # Villkorsbaserad tullsats — beror på certifikat/villkor och
            # kan inte tolkas som en enkel procent
            mfn_duty = "Kräver manuell kontroll (villkorstull)"
        else:
            mfn_duty = duty_val
    else:
        mfn_duty = "0% (ingen MFN-rad — troligen tullfri)"

    # Preferenstull — matcha på både landskod och landsnamn
    country_name = COUNTRY_NAME_MAP.get(country_code.upper(), country_code)

    fta = matches[
        (
            (matches["Origin code"].str.upper() == country_code.upper()) |
            (matches["Origin"].str.strip() == country_name)
        ) &
        (matches["Meas. type code"].isin(["142", "145", "146"]))
    ]
    preferential_duty = fta["Duty"].iloc[0] if not fta.empty else None

    return {
        "hs_code": hs_code,
        "country_code": country_code,
        "mfn_duty": mfn_duty,
        "preferential_duty": preferential_duty,
        "has_fta": preferential_duty is not None,
    }


def lookup_antidumping(hs_code: str, country_code: str, taric_data: dict):
    """
    Kontrollerar om en vara från ett visst land omfattas av antidumpningstull.

    Antidumpningstullar (measure type 551–554) är extra tullar — ofta 30–70 % —
    som EU lägger på varor som säljs under marknadspris, vanligast vid
    Kina-import. En missad antidumpningstull i deklarationen kan ge
    tulltillägg i efterhand, så varje träff ska flaggas.

    Args:
        hs_code (str): HS-koden från fakturan, t.ex. '7326.90.98'
        country_code (str): Ursprungslandets landskod, t.ex. 'CN'
        taric_data (dict): Inläst TARIC-data från load_taric_data()

    Returns:
        str | None: Tullsatsen (t.ex. '86.500 %') om en giltig
        antidumpningsrad finns för kod + land, annars None.
    """
    duties_df = taric_data["duties"]
    clean_hs = hs_code.replace(".", "").ljust(10, "0")
    country_name = COUNTRY_NAME_MAP.get(country_code.upper(), country_code)

    matches = duties_df[
        (duties_df["Goods code"].str.strip() == clean_hs) &
        (duties_df["Meas. type code"].isin(["551", "552", "553", "554"])) &
        (
            (duties_df["Origin code"].str.upper() == country_code.upper()) |
            (duties_df["Origin"].str.strip() == country_name)
        )
    ]
    matches = _giltiga_rader(matches)

    if matches.empty:
        return None
    return str(matches["Duty"].iloc[0]).strip()


def verify_hs_description(hs_code: str, item_description: str, taric_data: dict) -> dict:
    """
    Kontrollerar att HS-koden matchar varans beskrivning i TARIC-nomenklaturen.

    Args:
        hs_code (str): HS-koden från fakturan
        item_description (str): Varubeskrivningen från fakturan
        taric_data (dict): Inläst TARIC-data

    Returns:
        dict: TARIC-beskrivningen för koden så vi kan jämföra
    """
    nomenclature_df = taric_data["nomenclature"]
    clean_hs = hs_code.replace(".", "").ljust(10, "0")

    match = nomenclature_df[
        nomenclature_df["Goods code"].str.strip().str[:10] == clean_hs
    ]

    if match.empty:
        return {
            "hs_code": hs_code,
            "taric_description": "Ej hittad",
            "invoice_description": item_description
        }

    return {
        "hs_code": hs_code,
        "taric_description": match["Description"].iloc[0],
        "invoice_description": item_description,
    }


if __name__ == "__main__":
    taric_data = load_taric_data()
    duties_df = taric_data["duties"]

    # Testa med dina faktiska varor från fakturan
    test_items = [
        ("8534.00.00", "CN", "Elektronikkort"),
        ("8542.31.90", "TW", "Mikroprocessor"),
        ("9025.19.80", "JP", "Industriell sensor"),
        ("8504.40.84", "CN", "Strömförsörjningsenhet"),
        ("8544.42.90", "PL", "Kablar och kontakter"),
    ]

    print("\n=== TULLSATSUPPSLAG ===")
    for hs, country, desc in test_items:
        result = lookup_duty(hs, country, taric_data)
        print(f"\n{desc} ({hs} från {country}):")
        print(f"  MFN-tullsats:          {result.get('mfn_duty')}")
        print(f"  Preferenstullsats:     {result.get('preferential_duty')}")
        print(f"  Frihandelsavtal finns: {result.get('has_fta')}")
        if result.get('note'):
            print(f"  Notering:              {result.get('note')}")

        desc_result = verify_hs_description(hs, desc, taric_data)
        print(f"  TARIC-beskrivning:     {desc_result.get('taric_description')}")
