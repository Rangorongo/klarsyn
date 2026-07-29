import { signIn } from "@/lib/auth/authOptions";

export default function SignInPage() {
  return (
    <main id="main-content">
      <div className="view-heading">
        <h2 tabIndex={-1}>Logga in</h2>
        <p>
          Vi skickar en inloggningslänk till din e-post — inget lösenord behövs.
        </p>
      </div>

      <div className="card">
        <form
          action={async (formData) => {
            "use server";
            await signIn("resend", formData);
          }}
        >
          <div className="field-group">
            <label htmlFor="email">E-postadress</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit">
            Skicka inloggningslänk
          </button>
        </form>
      </div>
    </main>
  );
}
