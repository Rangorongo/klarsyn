import { auth, signOut } from "@/lib/auth/authOptions";
import { DeleteAccountButton } from "./DeleteAccountButton";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main id="main-content">
        <div className="view-heading">
          <h2 tabIndex={-1}>Mitt konto</h2>
          <p>Du är inte inloggad.</p>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content">
      <div className="view-heading">
        <h2 tabIndex={-1}>Mitt konto</h2>
        <p>Inloggad som {session.user.email}</p>
      </div>

      <div className="card">
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button className="btn btn-secondary" type="submit">
            Logga ut
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Radera all min data</h3>
        <p>
          Detta raderar permanent ditt konto och all sparad data — inklusive
          uppladdade underlag och rapporter. Går inte att ångra.
        </p>
        <DeleteAccountButton />
      </div>
    </main>
  );
}
