"use client";

import { useState } from "react";
import { formatKr } from "@/lib/format";

// Illustrative assumption for the simulator below — an average across the
// eight rule categories' typical findings, NOT a real historical figure
// (Klarsyn has no real users yet). Keep this clearly labeled as a
// simulation everywhere it's used — see docs/strategi-risker-och-krav.md
// #5 on not creating promises the product can't back.
const GENOMSNITT_PER_PERSON_ORE = 8_000_00;

export function ImpactSimulator() {
  const [antalPersoner, setAntalPersoner] = useState(250);
  const totalOre = antalPersoner * GENOMSNITT_PER_PERSON_ORE;

  return (
    <div className="impact-card">
      <span className="stat-label">Simulering — inte verkliga siffror än</span>
      <h3 className="impact-title">Potentiell effekt</h3>
      <div className="impact-total">{formatKr(totalOre)}</div>
      <p className="impact-caption">
        skulle Klarsyn kunna hitta åt{" "}
        <strong>{antalPersoner.toLocaleString("sv-SE")}</strong> personer,
        baserat på ett genomsnitt på {formatKr(GENOMSNITT_PER_PERSON_ORE)} per
        person.
      </p>
      <input
        type="range"
        min={10}
        max={2000}
        step={10}
        value={antalPersoner}
        onChange={(event) => setAntalPersoner(Number(event.target.value))}
        className="impact-slider"
        aria-label="Antal personer i simuleringen"
      />
      <div className="impact-slider-labels">
        <span>10 personer</span>
        <span>2 000 personer</span>
      </div>
    </div>
  );
}

export function SavingsRangeGauge() {
  // Illustrative range grounded in the rule engine's typical findings
  // (resor, ränta och RUT/ROT are the most commonly-triggered categories),
  // not real user data.
  const minOre = 2_000_00;
  const typiskOre = 8_000_00;
  const maxOre = 18_000_00;
  const percent = ((typiskOre - minOre) / (maxOre - minOre)) * 100;

  return (
    <div className="impact-card">
      <span className="stat-label">Illustrativt exempel</span>
      <h3 className="impact-title">Vad de flesta hittar</h3>
      <div className="savings-gauge">
        <div className="savings-gauge-track">
          <div
            className="savings-gauge-marker"
            style={{ left: `${percent}%` }}
          >
            <span className="savings-gauge-marker-value">
              {formatKr(typiskOre)}
            </span>
          </div>
        </div>
        <div className="savings-gauge-range-labels">
          <span>{formatKr(minOre)}</span>
          <span>{formatKr(maxOre)}</span>
        </div>
      </div>
      <p className="impact-caption">
        De flesta som rest till jobbet, haft ränteutgifter eller anlitat
        RUT/ROT hittar ett belopp i det här spannet.
      </p>
    </div>
  );
}

export function NoPayDemo() {
  const [found, setFound] = useState(true);
  const exampleOre = 12_000_00;
  const feeOre = found ? Math.round(exampleOre * 0.25) : 0;

  return (
    <div className="impact-card">
      <span className="stat-label">Så funkar no cure no pay</span>
      <h3 className="impact-title">Hittar vi inget betalar du inget</h3>
      <div className="nopay-toggle" role="group" aria-label="Simulera ett resultat">
        <button
          type="button"
          className={`nopay-toggle-btn${!found ? " active" : ""}`}
          aria-pressed={!found}
          onClick={() => setFound(false)}
        >
          Vi hittar 0 kr
        </button>
        <button
          type="button"
          className={`nopay-toggle-btn${found ? " active" : ""}`}
          aria-pressed={found}
          onClick={() => setFound(true)}
        >
          Vi hittar {formatKr(exampleOre)}
        </button>
      </div>
      <div className="nopay-result">
        <span className="nopay-result-label">Du betalar</span>
        <span
          className={`nopay-result-amount${feeOre === 0 ? " zero" : ""}`}
        >
          {formatKr(feeOre)}
        </span>
      </div>
    </div>
  );
}
