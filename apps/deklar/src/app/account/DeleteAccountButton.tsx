"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAccountButton() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        "Är du säker? Detta raderar permanent ditt konto och all sparad data — går inte att ångra.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    const response = await fetch("/api/account/delete", { method: "POST" });

    if (response.ok) {
      router.push("/");
      return;
    }

    setIsDeleting(false);
    window.alert("Något gick fel vid raderingen. Försök igen.");
  }

  return (
    <button
      className="btn btn-secondary"
      type="button"
      disabled={isDeleting}
      onClick={handleDelete}
    >
      {isDeleting ? "Raderar..." : "Radera all min data"}
    </button>
  );
}
