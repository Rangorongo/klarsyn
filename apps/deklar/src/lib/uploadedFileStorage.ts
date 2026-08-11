// PROTOTYPE STORAGE — same caveat as underlagStorage.ts and answerTrail.ts:
// this is a client-only, browser-local record, not yet the real encrypted
// server-side blob storage designed in prisma/schema.prisma's
// UploadedDocument model (Phase 7). It exists so Klarsyn can point back at
// exactly which original Skatteverket file backed the advice given in a
// session — the evidentiary link answerTrail.ts alone can't provide, since
// a hand-typed answer trail says nothing about the source document itself.
//
// IndexedDB (not sessionStorage) because the stored value is a binary
// PDF/XML Blob that can be several MB — well past sessionStorage's
// string-only, ~5MB-per-origin budget shared with everything else we keep
// there (underlag, answer trail).
const DB_NAME = "deklar-uploaded-file";
const DB_VERSION = 1;
const STORE_NAME = "files";
const RECORD_KEY = "current";

export interface StoredUploadedFile {
  name: string;
  type: string;
  sizeBytes: number;
  hash: string;
  storedAt: string;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Stores the file the customer uploaded, replacing whatever was stored
// before (one declaration document per session). Returns the record
// (including its content hash) so callers can immediately reference it,
// e.g. in the answer trail, without a second read round-trip.
export async function storeUploadedFile(
  file: File,
): Promise<StoredUploadedFile> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("storeUploadedFile requires a browser with IndexedDB.");
  }

  const record: StoredUploadedFile = {
    name: file.name,
    type: file.type,
    sizeBytes: file.size,
    hash: await sha256Hex(file),
    storedAt: new Date().toISOString(),
    blob: file,
  };

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }

  return record;
}

export async function readUploadedFile(): Promise<StoredUploadedFile | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;

  const db = await openDb();
  try {
    const record = await new Promise<StoredUploadedFile | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      },
    );
    return record ?? null;
  } finally {
    db.close();
  }
}

export async function clearUploadedFile(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
