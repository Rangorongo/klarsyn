"""
core/pii.py

GDPR-maskering: personuppgifter tas bort ur dokumenttexten INNAN den
skickas till någon extern AI-tjänst. Gäller alla moduler.

Lika viktigt som att maska rätt är att INTE maska fel: HS-koder, belopp,
datum och tracking-nummer är granskningens kärna och måste lämnas orörda.
Mönstren nedan är därför medvetet snäva, och tests/test_pii.py bevisar
båda riktningarna.

Ordningen spelar roll: e-post först, sedan person-/organisationsnummer,
sist telefonnummer (så att t.ex. ett orgnummer inte hinner "ätas upp"
av telefonmönstret).
"""

import re

# ÅÅMMDD-XXXX eller ÅÅÅÅMMDD-XXXX — täcker både personnummer och
# organisationsnummer (som delar formatet XXXXXX-XXXX).
_PNR_MONSTER = re.compile(r'\b\d{6,8}-\d{4}\b')

# +46-format: +46 följt av 7–14 tecken siffror/mellanslag/bindestreck
_TELEFON_PLUS46 = re.compile(r'\+46[\d\s\-()]{6,14}\d')

# 0X-format: riktnummer + minst två sifferblock, t.ex. 070-123 45 67.
# Kräver minst två avgränsade block efter riktnumret så att datum
# (06-15) och fakturanummer inte träffas.
_TELEFON_INRIKES = re.compile(r'\b0\d{1,3}[\s\-]\d{2,4}(?:[\s\-]\d{2,3}){1,3}\b')

_EPOST = re.compile(r'[\w\.-]+@[\w\.-]+')


def mask_pii(text: str) -> str:
    """Maskerar känslig info: e-post, person-/orgnummer och telefonnummer (GDPR)."""
    text = _EPOST.sub('[MASKED_EMAIL]', text)
    text = _PNR_MONSTER.sub('[MASKED_PNR]', text)
    text = _TELEFON_PLUS46.sub('[MASKED_PHONE]', text)
    text = _TELEFON_INRIKES.sub('[MASKED_PHONE]', text)
    return text
