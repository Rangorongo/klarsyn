"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content">
      <div className="card text-center">
        <h2>Något gick fel</h2>
        <p className="mt-2 text-[color:var(--color-muted-fg)]">
          Ett oväntat fel inträffade. Försök igen, eller kom tillbaka senare.
        </p>
        <button
          className="btn btn-primary mt-[var(--space-5)]"
          type="button"
          onClick={() => unstable_retry()}
        >
          Försök igen
        </button>
      </div>
    </main>
  );
}
