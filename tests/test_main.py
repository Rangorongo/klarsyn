"""
test_main.py

Testar kommandoradslogiken i main.py — helt kvotfritt.
Själva pipelinen (som kräver Gemini-anrop) testas inte här; bara
logiken som avgör VILKA fakturor som ska köras.
"""

import pytest
from main import hitta_fakturor


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
