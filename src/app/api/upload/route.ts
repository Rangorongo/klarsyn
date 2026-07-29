import { NextResponse } from "next/server";
import { SkatteverketParseError } from "@/lib/ingestion/skatteverket/errors";
import {
  extractPdfText,
  parseSkatteverketPdfText,
} from "@/lib/ingestion/skatteverket/pdfParser";
import { parseSkatteverketXml } from "@/lib/ingestion/skatteverket/xmlParser";

// Skatteverket's prefilled declarations are a few hundred KB at most — this
// comfortably covers any real file while bounding the work an upload can
// force (XML/PDF parsing cost scales with size).
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isXml(file: File): boolean {
  return file.type.includes("xml") || file.name.toLowerCase().endsWith(".xml");
}

function isPdf(file: File): boolean {
  return file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Ingen fil bifogades." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Filen är för stor. Max 10 MB." },
      { status: 413 },
    );
  }

  try {
    if (isXml(file)) {
      const xml = await file.text();
      return NextResponse.json({ underlag: parseSkatteverketXml(xml) });
    }

    if (isPdf(file)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = await extractPdfText(bytes);
      return NextResponse.json({ underlag: parseSkatteverketPdfText(text) });
    }

    return NextResponse.json(
      { error: "Filtypen stöds inte. Ladda upp en .xml- eller .pdf-fil." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof SkatteverketParseError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
