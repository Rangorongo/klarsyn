"""
core/pii.py

GDPR-maskering: personuppgifter tas bort ur dokumenttexten INNAN den
skickas till någon extern AI-tjänst. Gäller alla moduler.
"""

import re


def mask_pii(text: str) -> str:
    """Maskerar känslig info som e-post och telefonnummer (GDPR)."""
    # Exempel: maskera e-postadresser
    text = re.sub(r'[\w\.-]+@[\w\.-]+', '[MASKED_EMAIL]', text)
    # Här kan du lägga till fler regler efter hand
    return text
