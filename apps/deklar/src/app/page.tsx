import Link from "next/link";

export default function LandingPage() {
  return (
    <main id="main-content">
      <div className="hero-band">
        <div className="hero-card">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="hero-eyebrow">För privatpersoner</span>
              <h1 id="landing-heading" tabIndex={-1}>
                Hitta pengarna du <span className="accent">missar</span> i din
                deklaration
              </h1>
              <p className="lead">
                Ladda upp din förifyllda deklaration från Skatteverket. Vi
                ställer några enkla följdfrågor och visar exakt vilka avdrag du
                kan ha missat.
              </p>
              <div className="hero-actions">
                <Link href="/upload" className="btn btn-primary">
                  Starta analys
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </Link>
              </div>

              <div className="trust-row">
                <span className="trust-item">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12l4 4 10-10" />
                  </svg>
                  Betala bara om vi hittar pengar
                </span>
                <span className="trust-item">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  Klart på under 15 minuter
                </span>
                <span className="trust-item">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
                  </svg>
                  Krypterad lagring, GDPR-säkert
                </span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="stat-panel">
                <span className="stat-label">Illustrativt exempel</span>
                <div className="stat-number">+12 400 kr</div>
                <p className="stat-caption">
                  Vad en analys skulle kunna hitta åt en typisk användare
                </p>
                <div className="mini-chart" aria-hidden="true">
                  <span style={{ "--h": "48%" } as React.CSSProperties} />
                  <span style={{ "--h": "88%" } as React.CSSProperties} />
                  <span style={{ "--h": "62%" } as React.CSSProperties} />
                </div>
                <div className="mini-chart-labels">
                  <span>Resor</span>
                  <span>Dubbel</span>
                  <span>Krypto</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 16l1.5-5A2 2 0 017.4 9.5h9.2a2 2 0 011.9 1.5L20 16" />
              <rect x="3" y="16" width="18" height="4" rx="1.5" />
              <circle cx="7.5" cy="20" r="1.3" />
              <circle cx="16.5" cy="20" r="1.3" />
            </svg>
          </span>
          <h3>Resor & dubbel bosättning</h3>
          <p>
            Missade reseavdrag och avdrag för tillfälligt boende på annan ort.
          </p>
        </div>
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="2.5" />
              <circle cx="17" cy="17" r="2.5" />
              <path d="M18 6L6 18" />
            </svg>
          </span>
          <h3>Krypto</h3>
          <p>
            Rätt omkostnadsbelopp vid försäljning — schablonmetoden jämfört med
            din faktiska anskaffningsutgift.
          </p>
        </div>
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="2.5" />
              <circle cx="17" cy="17" r="2.5" />
              <path d="M18 6L6 18" />
            </svg>
          </span>
          <h3>Ränta & kapital</h3>
          <p>
            Skattereduktion för ränteutgifter — 30 % upp till 100 000 kr, 21 %
            därutöver, om det inte redan är förifyllt.
          </p>
        </div>
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 11l8-6 8 6" />
              <path d="M6 10v9h12v-9" />
            </svg>
          </span>
          <h3>RUT & ROT</h3>
          <p>
            Kontroll att du fått avdraget vid betalning, och att du inte
            missat att ansöka i efterhand.
          </p>
        </div>
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
            </svg>
          </span>
          <h3>Gåvor till välgörenhet</h3>
          <p>
            25 % skattereduktion på gåvor till godkända mottagare — lätt att
            missa eftersom den inte alltid syns automatiskt.
          </p>
        </div>
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </span>
          <h3>Grön teknik</h3>
          <p>
            15–50 % på solceller, batterilagring och laddpunkt för elbil —
            kontroll att du fått hela avdraget.
          </p>
        </div>
        <div className="feature-card">
          <span className="icon-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
          </span>
          <h3>Kapitalförlust — aktier & fonder</h3>
          <p>
            Nettade förluster kvoteras till 70 % avdragsgillt — värt att
            dubbelkolla att det syns rätt.
          </p>
        </div>
      </div>

      <section className="section" aria-labelledby="problem-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Problemet</span>
          <h2 id="problem-heading">
            Deklarationen är byggd för att du ska missa saker
          </h2>
          <p>
            Det här är vad vi själva stötte på — och vad vi vet att fler känner
            igen.
          </p>
        </div>
        <div className="problem-grid">
          <div className="problem-item">
            <span className="icon-badge">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5" />
                <path d="M12 16.5h.01" />
              </svg>
            </span>
            <div>
              <h3>Skatteverkets regler är svåra att tolka</h3>
              <p>
                Vad som räknas som avdragsgillt beror på detaljer som är lätta
                att missa om man inte jobbar med det dagligen.
              </p>
            </div>
          </div>
          <div className="problem-item">
            <span className="icon-badge">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="8" r="3" />
                <path d="M2 20c0-3.3 3-5 7-5" />
                <circle cx="17" cy="8" r="2.5" />
                <path d="M15 20c.3-2.6 2-4.3 4.5-4.8" />
              </svg>
            </span>
            <div>
              <h3>Vänner och bekanta ger olika svar</h3>
              <p>
                Man frågar runt, får motstridig information, och vet ändå inte
                om man gjorde rätt.
              </p>
            </div>
          </div>
          <div className="problem-item">
            <span className="icon-badge">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18" />
                <path d="M7 14h4" />
              </svg>
            </span>
            <div>
              <h3>Att ta hjälp av banken eller en rådgivare kostar</h3>
              <p>
                Tid, bokade möten och ibland en avgift — för något som borde gå
                snabbt att kolla.
              </p>
            </div>
          </div>
          <div className="problem-item">
            <span className="icon-badge">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <div>
              <h3>De flesta godkänner bara det som redan är ifyllt</h3>
              <p>
                Skatteverkets förslag är inte optimerat för dig — det är en
                utgångspunkt, inte facit.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="howitworks-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Så fungerar det</span>
          <h2 id="howitworks-heading">Från underlag till hittade pengar</h2>
          <p>
            Fyra steg, och din del av jobbet tar mindre tid än en kafferast.
          </p>
        </div>
        <div className="steps-list">
          <div className="step-item">
            <span className="step-number">1</span>
            <div>
              <h3>Ladda upp ditt underlag</h3>
              <p>
                Din förifyllda deklaration från Skatteverket (XML eller PDF) —
                eller prova med exempeldata direkt.
              </p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">2</span>
            <div>
              <h3>Svara på några snabba frågor</h3>
              <p>
                Vi ställer bara följdfrågor som faktiskt spelar roll för just
                din situation.
              </p>
              <span className="step-meta">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                Din arbetsinsats: under 15 minuter
              </span>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">3</span>
            <div>
              <h3>Vi analyserar och hittar möjliga avdrag</h3>
              <p>
                Du får en tydlig lista med belopp, motivering och källhänvisning
                till Skatteverkets regler.
              </p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">4</span>
            <div>
              <h3>Du betalar bara om vi hittar pengar</h3>
              <p>
                Ingen träff, ingen kostnad. Hittar vi något tar vi en andel av
                det du faktiskt får tillbaka.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="pricing-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Modellen</span>
          <h2 id="pricing-heading">Vi tjänar bara pengar när du gör det</h2>
        </div>
        <div className="pricing-card">
          <div className="pricing-headline">25% av det vi hittar åt dig</div>
          <p className="pricing-sub">
            Ingen fast avgift, inget abonnemang. Vi tar en andel av de pengar
            vår analys faktiskt hjälper dig få tillbaka — inget annat.
          </p>
          <div className="pricing-points">
            <span className="pricing-point">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12l4 4 10-10" />
              </svg>
              Hittar vi inget betalar du inget
            </span>
            <span className="pricing-point">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              Din arbetsinsats: under 15 minuter
            </span>
            <span className="pricing-point">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="6" width="18" height="13" rx="2" />
                <path d="M3 10h18" />
              </svg>
              Betala enkelt när du fått pengarna
            </span>
          </div>
          <div className="pricing-example">
            Exempel: hittar vi <strong>10 000 kr</strong> i avdrag betalar du{" "}
            <strong>2 500 kr</strong> i avgift — du behåller{" "}
            <strong>7 500 kr</strong> du annars hade missat.
          </div>
          <div className="payment-methods">
            <span className="payment-pill">Klarna</span>
            <span className="payment-pill">Swish</span>
            <span className="payment-pill">Bankkort</span>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="about-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Om plattformen</span>
          <h2 id="about-heading">
            Byggd för att lösa ett problem vi själva hade
          </h2>
        </div>
        <div className="card about-card">
          <p>
            Klarsyn startade som ett sätt att sluta gissa sig fram varje vår.
            Istället för att ringa banken eller fråga en kompis som &quot;kan
            sånt&quot;, ville vi ha ett verktyg som faktiskt går igenom
            underlaget systematiskt och visar var pengarna finns.
          </p>
          <p>
            Målet är att göra samma typ av avdragskoll som en rådgivare skulle
            göra — tillgänglig för alla, utan krångel och utan att du behöver
            kunna skattelagstiftning.
          </p>
          <div className="about-stats">
            <div className="about-stat">
              <div className="value">8</div>
              <div className="label">avdragsområden vid start</div>
            </div>
            <div className="about-stat">
              <div className="value">&lt;15 min</div>
              <div className="label">din arbetsinsats</div>
            </div>
            <div className="about-stat">
              <div className="value">0 kr</div>
              <div className="label">om vi inget hittar</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="faq-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Frågor</span>
          <h2 id="faq-heading">Vanliga frågor</h2>
        </div>
        <div className="faq-list">
          <details className="faq-item">
            <summary>
              Vad kostar det om ni inte hittar något?
              <svg
                className="chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="faq-answer">
              Ingenting. Vi jobbar enligt no cure no pay — hittar vi inga avdrag
              du kan använda betalar du inte en krona.
            </p>
          </details>
          <details className="faq-item">
            <summary>
              Hur betalar jag avgiften?
              <svg
                className="chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="faq-answer">
              Med Klarna, Swish eller bankkort — när vi visat exakt vad vi
              hittat och du godkänt det.
            </p>
          </details>
          <details className="faq-item">
            <summary>
              Är mina uppgifter säkra?
              <svg
                className="chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="faq-answer">
              Ditt underlag krypteras och lagras säkert hos en EU-hostad
              leverantör. Ditt personnummer sparas aldrig. Inget delas vidare
              utan att du vet om det.
            </p>
          </details>
          <details className="faq-item">
            <summary>
              Hur lång tid tar det för mig?
              <svg
                className="chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="faq-answer">
              Själva frågeflödet tar normalt under 15 minuter. Analysen sker
              automatiskt däremellan.
            </p>
          </details>
          <details className="faq-item">
            <summary>
              Vilka avdrag kontrollerar ni?
              <svg
                className="chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="faq-answer">
              Resor och dubbel bosättning, krypto, ränta och kapitalförlust,
              RUT/ROT, gåvor till välgörenhet samt grön teknik (solceller,
              batterilagring, laddpunkt) — fler områden är på väg.
            </p>
          </details>
        </div>
      </section>

      <div className="final-cta">
        <h2>Redo att se vad du missar?</h2>
        <p>Det tar under 15 minuter, och du betalar bara om vi hittar något.</p>
        <Link href="/upload" className="btn btn-primary">
          Starta analys
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </main>
  );
}
