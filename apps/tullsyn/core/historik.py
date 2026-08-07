"""
core/historik.py

Kundregister och sändningshistorik — grunden för dubblettkontroll ÖVER TID.

Dubbeldebitering inom en och samma faktura fångas av fraktreglerna direkt,
men transportörer debiterar också samma sändning på OLIKA fakturor med
veckor emellan. Det kan bara upptäckas med minne: varje granskad sändnings
tracking-nummer sparas per kund, och nya fakturor kontrolleras mot
historiken innan de registreras.

Lagring: SQLite (Python-standardbiblioteket) i tullsyn.db i projektroten.
Filen gitignoras — den innehåller kunddata.
"""

import os
import sqlite3
from datetime import datetime

_PROJEKTROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_FIL = os.path.join(_PROJEKTROT, "tullsyn.db")


def _anslut(db_fil: str = None) -> sqlite3.Connection:
    """Öppnar databasen och ser till att tabellen finns."""
    con = sqlite3.connect(db_fil or DB_FIL)
    con.execute("""
        CREATE TABLE IF NOT EXISTS frakthistorik (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kund TEXT NOT NULL,
            tracking_number TEXT NOT NULL,
            faktura TEXT,
            belopp REAL,
            registrerad TEXT NOT NULL
        )
    """)
    return con


def kontrollera_tracking_historik(kund: str, tracking_numbers: list, db_fil: str = None) -> dict:
    """
    Kontrollerar vilka tracking-nummer som redan granskats för kunden.

    Args:
        kund: kundens id (t.ex. mappnamn eller e-postadress).
        tracking_numbers: tracking-nummer från den nya fakturan.

    Returns:
        dict: {tracking_number: tidigare_fakturanummer} för de som redan
        finns i historiken — kandidater för dubbeldebitering över tid.
    """
    con = _anslut(db_fil)
    try:
        traffar = {}
        for tracking in tracking_numbers:
            if not tracking:
                continue
            rad = con.execute(
                "SELECT faktura FROM frakthistorik "
                "WHERE kund = ? AND tracking_number = ? LIMIT 1",
                (kund, str(tracking).strip().upper()),
            ).fetchone()
            if rad:
                traffar[tracking] = rad[0] or "okänd faktura"
        return traffar
    finally:
        con.close()


def registrera_sandningar(kund: str, faktura: str, shipments: list, db_fil: str = None):
    """
    Registrerar en granskad fakturas sändningar i historiken.

    Anropas EFTER dubblettkontrollen — annars flaggar fakturan sig själv.
    """
    con = _anslut(db_fil)
    try:
        nu = datetime.now().isoformat(timespec="seconds")
        for s in shipments:
            tracking = s.get("tracking_number")
            if not tracking:
                continue
            con.execute(
                "INSERT INTO frakthistorik (kund, tracking_number, faktura, belopp, registrerad) "
                "VALUES (?, ?, ?, ?, ?)",
                (kund, str(tracking).strip().upper(), faktura,
                 float(s.get("total_charge") or 0), nu),
            )
        con.commit()
    finally:
        con.close()
