import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Inte inloggad." }, { status: 401 });
  }

  // A real cascading hard delete, never a soft flag — every related row
  // (Account, Session, UploadedDocument, Report, ...) cascades via the
  // onDelete: Cascade relations already defined in prisma/schema.prisma.
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
