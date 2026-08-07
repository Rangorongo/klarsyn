"""
core/ocr.py

OCR-läsning av inskannade PDF:er — riktiga kunders fakturor är ofta
bilder av papper, inte digital text.

Teknik:
    - pypdfium2 (ren pip-installation) renderar PDF-sidorna till bilder
    - pytesseract läser bilderna — kräver att Tesseract-programmet är
      installerat på datorn:  winget install UB-Mannheim.TesseractOCR

Integritet: OCR körs HELT LOKALT på datorn — inga bilder eller texter
lämnar maskinen förrän den maskade texten skickas till AI-extraktionen,
precis som för vanliga PDF:er.

OCR-läst text är mer felbenägen än digital text. Därför markeras
resultatet (ocr_anvand) och granskningen blir extra försiktig: gröna
domar sänks till gula med uppmaning att kontrollera mot originalet.
"""


def tesseract_finns() -> bool:
    """Kollar om Tesseract-programmet är installerat och nåbart."""
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def las_text_med_ocr(pdf_path: str) -> str:
    """
    Läser en inskannad PDF med OCR, sida för sida.

    Returns:
        str: den OCR-lästa texten (kan vara tom om sidorna är oläsliga).
    """
    import pypdfium2 as pdfium
    import pytesseract

    pdf = pdfium.PdfDocument(pdf_path)
    sidtexter = []
    for sida in pdf:
        # 300 DPI ger bra OCR-kvalitet utan orimlig filstorlek
        bild = sida.render(scale=300 / 72).to_pil()
        try:
            sidtexter.append(pytesseract.image_to_string(bild, lang="swe+eng"))
        except pytesseract.TesseractError:
            # Svenska språkdata saknas — engelska klarar siffror och koder
            sidtexter.append(pytesseract.image_to_string(bild, lang="eng"))
    pdf.close()

    return "\n".join(sidtexter)
