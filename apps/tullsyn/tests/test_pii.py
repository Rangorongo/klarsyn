"""
test_pii.py

Testar GDPR-maskeringen — både att känsliga uppgifter maskas OCH att
affärsdata (HS-koder, belopp, datum, tracking-nummer) lämnas orörd.
Det senare är lika viktigt: översmaskning förstör granskningen.
"""

from core.pii import mask_pii


def test_epost_maskeras():
    assert "[MASKED_EMAIL]" in mask_pii("Kontakt: anna.svensson@bolaget.se")
    assert "anna.svensson" not in mask_pii("Kontakt: anna.svensson@bolaget.se")


def test_personnummer_maskeras():
    """Både ÅÅMMDD-XXXX och ÅÅÅÅMMDD-XXXX ska maskas."""
    text = "Referens: Anna Svensson, 850612-3456 och 19850612-3456"
    resultat = mask_pii(text)
    assert "850612-3456" not in resultat
    assert "[MASKED_PNR]" in resultat


def test_organisationsnummer_maskeras():
    """Org-nummer har samma form som personnummer — båda ska bort."""
    resultat = mask_pii("Säljare: Bolaget AB, org.nr 556677-8899")
    assert "556677-8899" not in resultat


def test_telefonnummer_maskeras():
    """Svenska nummer i +46- och 0X-format med vanliga avgränsare."""
    resultat = mask_pii("Ring +46 70 123 45 67 eller 070-123 45 67.")
    assert "+46 70 123 45 67" not in resultat
    assert "070-123 45 67" not in resultat
    assert "[MASKED_PHONE]" in resultat


def test_hs_koder_maskeras_inte():
    """HS-koder med punkter får ALDRIG maskas — de är granskningens kärna."""
    text = "HS-kod: 8534.00.00 | HS-kod: 3902.10.00"
    assert mask_pii(text) == text


def test_belopp_och_datum_maskeras_inte():
    """Belopp, antal och datum ska lämnas orörda."""
    text = "Antal: 200 | À-pris: 3.00 EUR | Radsumma: 600.00 EUR | Datum: 2026-06-15"
    assert mask_pii(text) == text


def test_tracking_nummer_maskeras_inte():
    """Tracking-nummer (bokstäver + siffror) ska lämnas orörda."""
    text = "Tracking: JD014600003SE | AWB: 807-12345675"
    resultat = mask_pii(text)
    assert "JD014600003SE" in resultat