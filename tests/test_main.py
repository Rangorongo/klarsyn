"""
test_main.py

Testar kommandoradslogiken i main.py — helt kvotfritt.
Själva pipelinen (som kräver Gemini-anrop) testas inte här; bara
logiken som avgör VILKA fakturor som ska köras.
"""

import pytest
from main import hitta_fakturor, load_pdf_text


def test_skannad_pdf_ger_begripligt_fel(tmp_path):
    """
    En PDF utan läsbar text (t.ex. inskannad bild) ska ge ett tydligt
    svenskt felmeddelande — inte en tom text som ger obegripliga AI-fel.
    """
    from reportlab.pdfgen import canvas

    tom_pdf = tmp_path / "skannad.pdf"
    c = canvas.Canvas(str(tom_pdf))
    c.rect(100, 100, 200, 200)  # bara grafik, ingen text
    c.save()

    with pytest.raises(ValueError, match="inskannad"):
        load_pdf_text(str(tom_pdf))


def test_enskild_pdf_ger_lista_med_en(tmp_path):
    """En sökväg till en PDF-fil ska ge en lista med exakt den filen."""
    pdf = tmp_path / "faktura.pdf"
    pdf.write_bytes(b"%PDF-1.4 test")
    resultat = hitta_fakturor(str(pdf))
    assert resultat == [str(pdf)]


def test_mapp_ger_alla_pdfer_sorterade(tmp_path):
    """En mapp ska ge alla PDF-filer i bokstavsordning — andra filtyper ignoreras."""
    (tmp_path / "b_faktura.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "a_faktura.pdf").write_bytes(b"%PDF-1.4")
    (tmp_path / "anteckningar.txt").write_text("inte en faktura")
    resultat = hitta_fakturor(str(tmp_path))
    assert [r.split("\\")[-1].split("/")[-1] for r in resultat] == ["a_faktura.pdf", "b_faktura.pdf"]


def test_tom_mapp_ger_tydligt_fel(tmp_path):
    """En mapp utan PDF:er ska ge ett begripligt felmeddelande."""
    with pytest.raises(FileNotFoundError, match="Inga PDF-filer"):
        hitta_fakturor(str(tmp_path))


def test_saknad_sokvag_ger_tydligt_fel():
    """En sökväg som inte finns ska ge ett begripligt felmeddelande."""
    with pytest.raises(FileNotFoundError, match="finns inte"):
        hitta_fakturor("C:/finns/absolut/inte/faktura.pdf")


def test_fel_filtyp_ger_tydligt_fel(tmp_path):
    """En fil som inte är PDF ska ge ett begripligt felmeddelande."""
    txt = tmp_path / "fel.txt"
    txt.write_text("hej")
    with pytest.raises(ValueError, match="inte en PDF"):
        hitta_fakturor(str(txt))


# --- Batchkörning: vilka lyckades och vilka måste köras om? ---

def test_kor_batch_listar_vilka_som_misslyckades(monkeypatch):
    """
    Batchkörningen ska hålla reda på exakt VILKA fakturor som misslyckades
    — annars vet användaren inte vilka som måste köras om.
    """
    import main as main_modul

    def fejk_granskning(faktura, modul=None, kund="standard"):
        if "trasig" in faktura:
            raise RuntimeError("simulerat kvotfel")
        if "tom" in faktura:
            return None  # extraktionen gav inget
        return {"items": []}

    monkeypatch.setattr(main_modul, "granska_dokument", fejk_granskning)

    resultat = main_modul.kor_batch(["bra_1.pdf", "trasig.pdf", "tom.pdf", "bra_2.pdf"])

    assert resultat["lyckade"] == ["bra_1.pdf", "bra_2.pdf"]
    assert resultat["misslyckade"] == ["trasig.pdf", "tom.pdf"]
    # Granskningsresultaten samlas in för batch-översiktsrapporten
    assert len(resultat["granskningar"]) == 2


def test_kor_batch_fortsatter_efter_fel(monkeypatch):
    """Ett fel i första fakturan får inte stoppa resten av batchen."""
    import main as main_modul

    anropade = []

    def fejk_granskning(faktura, modul=None, kund="standard"):
        anropade.append(faktura)
        if faktura == "forsta.pdf":
            raise RuntimeError("simulerat fel")
        return {"items": []}

    monkeypatch.setattr(main_modul, "granska_dokument", fejk_granskning)

    resultat = main_modul.kor_batch(["forsta.pdf", "andra.pdf"])

    assert anropade == ["forsta.pdf", "andra.pdf"]  # båda kördes
    assert resultat["misslyckade"] == ["forsta.pdf"]
    assert resultat["lyckade"] == ["andra.pdf"]


# --- Dokumentrouting: rätt PDF till rätt modul ---

FRAKT_TEXT = """FREIGHT INVOICE — DHL Express
Tracking: JD014600003SE | Bränsletillägg (fuel surcharge): 22.5%
Debiterad vikt: 14.5 kg"""

TULL_TEXT = """COMMERCIAL INVOICE — Incoterm CIF
HS-kod: 8534.00.00 | Ursprungsland: CN"""


def test_granska_dokument_routar_frakt_automatiskt(monkeypatch):
    """En fraktfaktura ska automatiskt hamna i fraktmodulens pipeline."""
    import main as main_modul

    monkeypatch.setattr(main_modul, "load_pdf_text", lambda p: FRAKT_TEXT)
    monkeypatch.setattr(main_modul, "run_freight_pipeline",
                        lambda p, raw_text=None, kund="standard": {"typ": "frakt"})
    monkeypatch.setattr(main_modul, "run_pipeline",
                        lambda p, raw_text=None: {"typ": "tull"})

    assert main_modul.granska_dokument("nagon.pdf") == {"typ": "frakt"}


def test_granska_dokument_routar_tull_automatiskt(monkeypatch):
    """En tullfaktura ska automatiskt hamna i tullmodulens pipeline."""
    import main as main_modul

    monkeypatch.setattr(main_modul, "load_pdf_text", lambda p: TULL_TEXT)
    monkeypatch.setattr(main_modul, "run_freight_pipeline",
                        lambda p, raw_text=None, kund="standard": {"typ": "frakt"})
    monkeypatch.setattr(main_modul, "run_pipeline",
                        lambda p, raw_text=None: {"typ": "tull"})

    assert main_modul.granska_dokument("nagon.pdf") == {"typ": "tull"}


def test_modul_flaggan_overstyar_detekteringen(monkeypatch):
    """--modul tull ska tvinga tullmodulen även för fraktliknande text."""
    import main as main_modul

    monkeypatch.setattr(main_modul, "load_pdf_text", lambda p: FRAKT_TEXT)
    monkeypatch.setattr(main_modul, "run_freight_pipeline",
                        lambda p, raw_text=None, kund="standard": {"typ": "frakt"})
    monkeypatch.setattr(main_modul, "run_pipeline",
                        lambda p, raw_text=None: {"typ": "tull"})

    assert main_modul.granska_dokument("nagon.pdf", modul="tull") == {"typ": "tull"}
