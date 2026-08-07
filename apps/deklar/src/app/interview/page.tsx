"use client";

import { useMemo, useState } from "react";
import { formatKr } from "@/lib/format";
import { generateGuide } from "@/lib/guide/generate";
import type { Underlag } from "@/lib/ingestion/skatteverket/models";
import { getNextQuestion } from "@/lib/questionnaire/engine";
import { dubbelBosattningRule } from "@/lib/rules/dubbelBosattning";
import { kryptoRule } from "@/lib/rules/krypto";
import { RuleRegistry } from "@/lib/rules/registry";
import { resorRule } from "@/lib/rules/resor";
import type { AnswerMap, RuleResult } from "@/lib/rules/types";
import { readStoredUnderlag } from "@/lib/underlagStorage";

// Used when the user chose "Använd exempeldata istället" on /upload, or
// navigated here directly without going through it.
const EXAMPLE_UNDERLAG: Underlag = {
  inkomstar: 2025,
  arbetsinkomstSummaOre: 35_000_000,
};

const RULE_CATEGORY_LABEL: Record<string, string> = {
  resor: "Resor till jobbet",
  dubbelBosattning: "Dubbel bosättning",
  krypto: "Krypto",
};

const OPTION_LABEL: Record<string, string> = {
  bil: "Bil",
  kollektivt: "Kollektivtrafik",
};

function buildRegistry(): RuleRegistry {
  const registry = new RuleRegistry();
  registry.register(resorRule);
  registry.register(dubbelBosattningRule);
  registry.register(kryptoRule);
  return registry;
}

export default function InterviewPage() {
  const registry = useMemo(() => buildRegistry(), []);
  const [underlag] = useState<Underlag>(
    () => readStoredUnderlag() ?? EXAMPLE_UNDERLAG,
  );
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [history, setHistory] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | boolean | undefined>(undefined);
  const [lastQuestionId, setLastQuestionId] = useState<string | undefined>(
    undefined,
  );
  const [isPaid, setIsPaid] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const next = useMemo(
    () => getNextQuestion(registry, underlag, answers),
    [registry, underlag, answers],
  );
  const questionId = next.question?.id;

  // Reset the draft when the displayed question changes. Adjusting state
  // during render (rather than useEffect) avoids an extra commit — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (questionId !== lastQuestionId) {
    setLastQuestionId(questionId);
    setDraft(undefined);
  }

  if (!next.question) {
    const results: { ruleId: string; result: RuleResult }[] = registry
      .getApplicable(underlag)
      .map((rule) => ({
        ruleId: rule.id,
        result: rule.compute(underlag, answers),
      }));
    const totalOre = results.reduce(
      (sum, { result }) => sum + (result.amountOre ?? 0),
      0,
    );
    // No cure, no pay — nothing found means nothing to unlock.
    const isLocked = totalOre > 0 && !isPaid;
    const feeOre = Math.round(totalOre * 0.25);

    function restart() {
      setAnswers({});
      setHistory([]);
      setIsPaid(false);
      setPaymentError(null);
    }

    async function handleUnlock() {
      setIsPaying(true);
      setPaymentError(null);
      try {
        const response = await fetch("/api/payments/mock/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reportId: "local-session",
            amountOre: feeOre,
          }),
        });
        const body = await response.json();
        if (!response.ok || body.status !== "PAID") {
          setPaymentError("Betalningen kunde inte genomföras. Försök igen.");
          return;
        }
        setIsPaid(true);
      } catch {
        setPaymentError("Kunde inte nå betaltjänsten. Försök igen.");
      } finally {
        setIsPaying(false);
      }
    }

    return (
      <main id="main-content">
        <h2 className="sr-only">Din rapport</h2>

        <div className="summary-banner">
          <div className="label">Möjlig besparing hittad</div>
          <div className="amount">{formatKr(totalOre)}</div>
          <div className="sub">Baserat på dina svar</div>
        </div>

        <div className="result-list">
          {results.length === 0 ? (
            <div className="empty-note">
              Inga uppenbara avdrag hittades utifrån dina svar den här gången.
            </div>
          ) : (
            results.map(({ ruleId, result }, index) => {
              const guide = generateGuide(ruleId, result);
              return (
                <div className="result-item" key={index}>
                  <div className="result-item-head">
                    <div>
                      <span className="badge">{result.badge}</span>
                      <h3>{result.title}</h3>
                    </div>
                    <span className="amount">
                      {isLocked
                        ? "🔒"
                        : result.needsReview || result.amountOre === null
                          ? "Kräver koll"
                          : formatKr(result.amountOre)}
                    </span>
                  </div>

                  {isLocked ? null : (
                    <>
                      <p className="motivation">{result.motivation}</p>
                      <p className="source">Källa: {result.source}</p>

                      {guide ? (
                        <div className="guide-block">
                          <h4>Så här deklarerar du</h4>
                          <p className="guide-ruta">{guide.ruta}</p>
                          <ol>
                            {guide.steg.map((step, stepIndex) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ol>
                          {guide.dokumentationskrav.length > 0 ? (
                            <p className="guide-docs">
                              Ha redo: {guide.dokumentationskrav.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {isLocked ? (
          <div className="pricing-card mt-[var(--space-6)]">
            <div className="pricing-headline">{formatKr(feeOre)}</div>
            <p className="pricing-sub">
              Lås upp fullständiga resultat och deklarationsguide — 25 % av det
              vi hittat åt dig. Hittar vi inget betalar du inget.
            </p>
            {paymentError ? (
              <p
                role="alert"
                className="mt-4 text-[color:var(--color-destructive)]"
              >
                {paymentError}
              </p>
            ) : null}
            <button
              className="btn btn-primary btn-block mt-[var(--space-5)]"
              type="button"
              disabled={isPaying}
              onClick={handleUnlock}
            >
              {isPaying ? "Bearbetar..." : `Lås upp för ${formatKr(feeOre)}`}
            </button>
          </div>
        ) : null}

        <div className="report-actions">
          <button
            className="btn btn-secondary btn-block"
            type="button"
            onClick={restart}
          >
            Börja om
          </button>
        </div>
      </main>
    );
  }

  const question = next.question;
  const ruleId = next.ruleId ?? "";
  const progress =
    next.totalCount > 0
      ? ((next.answeredCount + 1) / next.totalCount) * 100
      : 100;
  const canAdvance =
    question.type === "number"
      ? typeof draft === "string" &&
        draft.trim() !== "" &&
        Number.isFinite(Number(draft))
      : draft !== undefined && draft !== "";

  function handleBack() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setAnswers((prev) => {
      const rest = { ...prev };
      delete rest[last];
      return rest;
    });
  }

  function handleNext() {
    if (draft === undefined) return;
    const value = question.type === "number" ? Number(draft) : draft;
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    setHistory((prev) => [...prev, question.id]);
  }

  return (
    <main id="main-content">
      <h2 className="sr-only">Uppföljningsfrågor</h2>
      <div className="card">
        <div className="stepper">
          <div className="stepper-track">
            <div className="stepper-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="stepper-label" aria-live="polite">
            Fråga {next.answeredCount + 1} av {next.totalCount}
          </span>
        </div>

        <div className="question-category">
          {RULE_CATEGORY_LABEL[ruleId] ?? ruleId}
        </div>
        <div className="question-text" id={`question-${question.id}-label`}>
          {question.prompt}
        </div>

        {question.options ? (
          <div className="choice-row" role="group" aria-label="Svarsalternativ">
            {question.options.map((option) => (
              <button
                key={option}
                type="button"
                className="choice-btn"
                aria-pressed={draft === option}
                onClick={() => setDraft(option)}
              >
                {OPTION_LABEL[option] ?? option}
              </button>
            ))}
          </div>
        ) : question.type === "boolean" ? (
          <div className="choice-row" role="group" aria-label="Svarsalternativ">
            <button
              type="button"
              className="choice-btn"
              aria-pressed={draft === true}
              onClick={() => setDraft(true)}
            >
              Ja
            </button>
            <button
              type="button"
              className="choice-btn"
              aria-pressed={draft === false}
              onClick={() => setDraft(false)}
            >
              Nej
            </button>
          </div>
        ) : (
          <div className="field-group">
            <input
              aria-labelledby={`question-${question.id}-label`}
              type={question.type === "number" ? "number" : "text"}
              value={typeof draft === "string" ? draft : ""}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
        )}

        <div className="nav-row">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleBack}
            disabled={history.length === 0}
          >
            Tillbaka
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!canAdvance}
            onClick={handleNext}
          >
            Nästa
          </button>
        </div>
      </div>
    </main>
  );
}
