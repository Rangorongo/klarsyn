"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  clearStoredUnderlag,
  writeStoredUnderlag,
} from "@/lib/underlagStorage";
import { clearUploadedFile, storeUploadedFile } from "@/lib/uploadedFileStorage";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Något gick fel vid inläsningen.");
        return;
      }

      // Best-effort: a browser without IndexedDB (or storage quota issues)
      // shouldn't block the user from proceeding — it just means we won't
      // have the original document to back the advice we give later.
      try {
        await storeUploadedFile(file);
      } catch {
        // Ignored — see comment above.
      }

      writeStoredUnderlag(body.underlag);
      router.push("/interview");
    } catch {
      setError(
        "Kunde inte nå servern. Kontrollera din uppkoppling och försök igen.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function handleExampleData() {
    clearStoredUnderlag();
    void clearUploadedFile();
    router.push("/interview");
  }

  return (
    <main id="main-content">
      <div className="view-heading">
        <h2 id="upload-heading" tabIndex={-1}>
          Ladda upp ditt underlag
        </h2>
        <p>Vi stödjer Skatteverkets förifyllda XML-fil eller PDF.</p>
      </div>

      <div className="card">
        <div
          className={`dropzone${isDragOver ? " dragover" : ""}`}
          tabIndex={0}
          role="button"
          aria-label="Ladda upp fil, klicka eller släpp fil här"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
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
              <path d="M12 15V4" />
              <path d="M7 9l5-5 5 5" />
              <path d="M5 16v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
            </svg>
          </span>
          <h3>
            {isUploading
              ? "Läser in filen..."
              : "Släpp filen här, eller klicka för att välja"}
          </h3>
          <p>.xml eller .pdf från Skatteverket</p>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={isUploading}
            onClick={(event) => {
              event.stopPropagation();
              handleExampleData();
            }}
          >
            Använd exempeldata istället
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <p className="file-hint">
            Filen skickas krypterat till vår server för avläsning men sparas
            inte där. En kopia sparas lokalt i din webbläsare så att vi kan
            visa vilket underlag våra råd byggde på.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 text-[color:var(--color-destructive)]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
