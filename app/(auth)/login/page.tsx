"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import AuthTurnstile, {
  isTurnstileConfigured,
} from "@/components/AuthTurnstile";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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

    const redirect = searchParams.get("redirect");
    router.push(redirect || "/");
    router.refresh();
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--paper)" }}
    >
      <div className="w-full max-w-sm">
        <h1
          className="font-display text-2xl mb-6 text-center"
          style={{ color: "var(--indigo)" }}
        >
          Log in
        </h1>

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

        <div className="flex items-center gap-3 my-5">
          <div
            className="h-px flex-1"
            style={{ background: "var(--sand)" }}
          />
          <span className="text-xs text-gray-400">or continue with email</span>
          <div
            className="h-px flex-1"
            style={{ background: "var(--sand)" }}
          />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">
              Email address
            </label>
            <input
              type="email"
              required
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
      </div>
    </main>
  );
}
