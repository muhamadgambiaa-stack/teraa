"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppleAuthButton from "@/components/AppleAuthButton";
import PhoneAuthForm from "@/components/PhoneAuthForm";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import AuthTurnstile, {
  isTurnstileConfigured,
} from "@/components/AuthTurnstile";
import { AuthPageShell } from "@/components/AuthPageShell";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(() => {
    const error = searchParams.get("error");

    if (error === "phone_in_use") {
      return "That phone number already belongs to a Teraa account. Log in to the existing account or contact support.";
    }

    if (error === "profile_creation_failed") {
      return "Your account could not be completed. Contact Teraa support.";
    }

    return null;
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const captchaRequired = isTurnstileConfigured();

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaResetKey((current) => current + 1);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (captchaRequired && !captchaToken) {
      setMessage("Complete the security check first.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      resetCaptcha();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage("Could not load your account. Please try again.");
      return;
    }
    const { data: profile, error: profileError } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
    if (profileError) {
      setMessage("Could not load your profile. Please try again.");
      return;
    }
    const destination = searchParams.get("redirect");
    const safeDestination = destination?.startsWith("/") && !destination.startsWith("//") && !destination.includes("\\") ? destination : "/";
    router.push(profile ? safeDestination : "/onboarding");
    router.refresh();
  }

  return (
    <AuthPageShell>
        <h1
          className="font-display mb-2 text-center text-3xl"
          style={{ color: "var(--ink)" }}
        >
          Log in
        </h1>

        <p className="mb-6 text-center text-sm text-gray-500">
          Welcome back to Teraa.
        </p>

        <AuthTurnstile
          resetKey={captchaResetKey}
          onTokenChange={setCaptchaToken}
        />

        <div className="mt-4">
          <GoogleAuthButton
            captchaRequired={captchaRequired}
            captchaToken={captchaToken}
            onCaptchaConsumed={resetCaptcha}
          />
        </div>

        <AppleAuthButton />

        <div className="flex items-center gap-3 my-5">
          <div
            className="h-px flex-1"
            style={{ background: "var(--sand)" }}
          />
          <span className="text-xs text-gray-400">or continue with</span>
          <div
            className="h-px flex-1"
            style={{ background: "var(--sand)" }}
          />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2" role="group" aria-label="Sign-in method">
          {(["email", "phone"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={method === option} onClick={() => setMethod(option)} className="rounded-lg border py-3 text-sm font-medium" style={{ borderColor: "var(--sand)", background: method === option ? "var(--indigo)" : "white", color: method === option ? "white" : "var(--ink)" }}>
              {option === "email" ? "Email" : "Phone"}
            </button>
          ))}
        </div>

        {method === "phone" ? (
          <PhoneAuthForm  captchaRequired={captchaRequired} captchaToken={captchaToken} onCaptchaConsumed={resetCaptcha} />
        ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs underline text-gray-500"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ borderColor: "var(--sand)" }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || (captchaRequired && !captchaToken)}
            className="w-full rounded-lg py-2 text-white text-sm font-medium disabled:opacity-50"
            style={{ background: "var(--indigo)" }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
        )}

        {message && (
          <p className="text-sm text-center mt-4 text-gray-600">{message}</p>
        )}

        <p className="text-sm text-center mt-6 text-gray-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="underline"
            style={{ color: "var(--indigo)" }}
          >
            Sign up
          </Link>
        </p>

        <p className="text-xs text-center mt-4 text-gray-500">
          Need help? Email{" "}
          <a
            href="mailto:support@getteraa.com"
            className="underline"
            style={{ color: "var(--indigo)" }}
          >
            support@getteraa.com
          </a>
        </p>
    </AuthPageShell>
  );
}
