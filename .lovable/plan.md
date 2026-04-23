

## Plan: Make password reset actually work

### Problem
1. Supabase Site URL is `http://localhost:3000` → recovery emails point to localhost. (Fix in Supabase dashboard, not code.)
2. The app has no page that consumes the recovery token, so even with the right redirect, users can't set a new password.
3. The admin "Reset password" button in `AdminUsers.tsx` and any future user-facing "Forgot password?" link both need to send users to a real reset page on the deployed app.

### Code changes

**1. New page: `src/pages/ResetPassword.tsx` (route `/auth/reset`)**
- On mount, listen for the `PASSWORD_RECOVERY` event from `supabase.auth.onAuthStateChange`. When Supabase processes the recovery token in the URL, it fires this event and establishes a temporary recovery session.
- Show a simple form: new password + confirm password, with the same min-length rules as signup.
- On submit, call `supabase.auth.updateUser({ password })`.
- On success: toast, sign the user out, redirect to `/auth` so they can sign in with the new password.
- Handle the error case where the link is expired or invalid (show a clear message + a "Request a new reset link" button that goes to a forgot-password flow).

**2. New page: `src/pages/ForgotPassword.tsx` (route `/auth/forgot`)**
- Email input → calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/auth/reset\` })`.
- Always shows a generic "If that email exists, we've sent a reset link" message (don't reveal whether the email is registered — that's an account-enumeration leak).

**3. `src/pages/Auth.tsx` — add "Forgot password?" link**
- Small text link under the password field on the sign-in form, pointing to `/auth/forgot`.

**4. `src/components/admin/AdminUsers.tsx` — fix the admin reset button's redirect**
- Currently uses `\`${window.location.origin}/auth\``. Change to `\`${window.location.origin}/auth/reset\`` so the recovery link lands on the new reset page instead of the sign-in page (which currently ignores the token).

**5. `src/App.tsx` — register the two new routes**
- `/auth/reset` → `ResetPassword`
- `/auth/forgot` → `ForgotPassword`

### What you (the user) must do — outside of code
After I ship the code, you need to update Supabase Auth → URL Configuration:
- **Site URL** → your live preview / published URL (not localhost).
- **Redirect URLs** allow-list → add `<your-app-origin>/auth/reset` for every environment you use (preview, published, custom domain, optionally localhost:8080).

I'll include a button below the implementation to jump straight to that settings page.

### Out of scope (ask if you want them)
- Enabling Supabase's "leaked password protection" (also flagged in your security panel) — I can turn that on in the same pass.
- Customizing the recovery email template with your branding (separate workflow).
- Rate-limiting the forgot-password endpoint at the app level — Supabase already throttles this server-side.

