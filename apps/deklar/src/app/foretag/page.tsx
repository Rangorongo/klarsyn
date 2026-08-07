import type { Metadata } from "next";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Klarsyn för företag — Era tullfakturor döljer pengar",
  description:
    "Klarsyn granskar tullfakturor mot EU:s TARIC-data och hittar felklassificeringar, outnyttjade frihandelsavtal och fraktfel — med ett komplett revisionsprotokoll som underlag.",
};

export default function ForetagPage() {
  return (
    <main id="main-content">
      <div className="hero-band">
        <div className="hero-card">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="hero-eyebrow">För företag</span>
              <h1 id="foretag-heading" tabIndex={-1}>
                Era tullfakturor <span className="accent">döljer pengar</span>.
                Vi hittar dem.
              </h1>
              <p className="lead">
                Vi granskar era tull- och fraktfakturor mot EU:s officiella
                TARIC-data och avtalslösa kontroller — felklassificeringar,
                outnyttjade frihandelsavtal, dubbeldebitering, momskonsekvens.
                Ni får ett formellt revisionsprotokoll som underlag för
                ändringsansökan hos Tullverket eller krav mot transportören.
              </p>
              <div className="hero-actions">
                <a
                  href="mailto:hej@klarsyn.se?subject=Boka%20ett%20samtal%20om%20Klarsyn%20f%C3%B6r%20f%C3%B6retag"
                  className="btn btn-primary"
                >
                  Boka ett samtal
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
                </a>
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
                    <path d="M4 11l8-6 8 6" />
                    <path d="M6 10v9h12v-9" />
                  </svg>
                  Vi sköter granskningen åt er
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
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M8 4v16" />
                  </svg>
                  Baserat på EU:s officiella TARIC-data
                </span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="stat-panel">
                <span className="stat-label">Illustrativt exempel</span>
                <div className="stat-number">+84 000 kr</div>
                <p className="stat-caption">
                  Vad en granskning skulle kunna hitta i en fakturaportfölj
                </p>
                <div className="mini-chart" aria-hidden="true">
                  <span style={{ "--h": "70%" } as CSSProperties} />
                  <span style={{ "--h": "45%" } as CSSProperties} />
                  <span style={{ "--h": "90%" } as CSSProperties} />
                </div>
                <div className="mini-chart-labels">
                  <span>Klass.</span>
                  <span>Avtal</span>
                  <span>Frakt</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="section" aria-labelledby="foretag-problem-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Problemet</span>
          <h2 id="foretag-problem-heading">
            Tullfakturor granskas sällan i detalj
          </h2>
          <p>
            De flesta importföretag godkänner speditörens fakturor som de är —
            få har tid eller verktyg att kontrollera varje klassificering och
            avgift.
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
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M8 9h8M8 13h5" />
              </svg>
            </span>
            <div>
              <h3>Felklassificerade varor</h3>
              <p>
                Fel HS-kod ger fel tullsats — ofta i flera år i följd om det
                aldrig upptäcks.
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
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </span>
            <div>
              <h3>Outnyttjade frihandelsavtal</h3>
              <p>
                Ursprungsregler som skulle sänkt tullsatsen till noll, men som
                aldrig åberopats.
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
                <path d="M4 11l8-6 8 6" />
                <path d="M6 10v9h12v-9" />
              </svg>
            </span>
            <div>
              <h3>Dubbeldebiterad frakt</h3>
              <p>
                Volymvikt, summafel och orimliga tillägg som glider igenom utan
                avtalskontroll.
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
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5" />
                <path d="M12 16.5h.01" />
              </svg>
            </span>
            <div>
              <h3>Momskonsekvenser</h3>
              <p>
                Fel i tulldeklarationen fortplantar sig ofta rakt in i
                momsredovisningen.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="foretag-how-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Så fungerar det</span>
          <h2 id="foretag-how-heading">Från faktura till underlag för krav</h2>
        </div>
        <div className="steps-list">
          <div className="step-item">
            <span className="step-number">1</span>
            <div>
              <h3>Ni skickar era fakturor</h3>
              <p>Tull- och/eller fraktfakturor, en åt gången eller i mapp.</p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">2</span>
            <div>
              <h3>Vi granskar mot TARIC och avtal</h3>
              <p>
                Klassificering, frihandelsavtal, antidumpningsrisk och
                fraktvillkor kontrolleras systematiskt.
              </p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">3</span>
            <div>
              <h3>Ni får ett revisionsprotokoll</h3>
              <p>
                Numrerade fynd med belopp, beräkning och referens — komplett
                underlag för ändringsansökan eller krav.
              </p>
            </div>
          </div>
          <div className="step-item">
            <span className="step-number">4</span>
            <div>
              <h3>Ni driver ärendet, med vårt underlag</h3>
              <p>
                Ändringsansökan hos Tullverket eller krav mot transportören —
                vi förbereder allt ni behöver.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="foretag-model-heading">
        <div className="section-heading">
          <span className="section-eyebrow">Modellen</span>
          <h2 id="foretag-model-heading">Ett upplägg anpassat efter volym</h2>
          <p>
            Priset beror på antal fakturor och komplexitet — hör av er så
            sätter vi ett upplägg tillsammans.
          </p>
        </div>
        <div className="card about-card">
          <p>
            Till skillnad från Klarsyns privatpersontjänst, som är
            självbetjäning, arbetar vi direkt med er som företag eftersom
            tullgranskning kräver mer kontext — avtal, varuflöden, historik.
            Boka ett samtal så går vi igenom er situation och föreslår ett
            upplägg.
          </p>
        </div>
      </section>

      <div className="final-cta">
        <h2>Vill ni veta vad ni missar?</h2>
        <p>Boka ett samtal — inget åtagande, bara en genomgång.</p>
        <a
          href="mailto:hej@klarsyn.se?subject=Boka%20ett%20samtal%20om%20Klarsyn%20f%C3%B6r%20f%C3%B6retag"
          className="btn btn-primary"
        >
          Boka ett samtal
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
        </a>
      </div>
    </main>
  );
}
