"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

import { createClient } from "@/lib/supabase/client";

type GoogleAuthButtonProps = {
  captchaRequired?: boolean;
  captchaToken?: string | null;
  onCaptchaConsumed?: () => void;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => void;
      renderButton: (
        container: HTMLElement,
        options: {
          type: string;
          theme: string;
          size: string;
          text: string;
          shape: string;
        },
      ) => void;
    };
  };
};

export default function GoogleAuthButton({
  captchaRequired = false,
  captchaToken,
  onCaptchaConsumed,
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const captchaTokenRef = useRef(captchaToken);
  const captchaRequiredRef = useRef(captchaRequired);
  const onCaptchaConsumedRef = useRef(onCaptchaConsumed);

  useEffect(() => {
    captchaTokenRef.current = captchaToken;
    captchaRequiredRef.current = captchaRequired;
    onCaptchaConsumedRef.current = onCaptchaConsumed;
  }, [captchaRequired, captchaToken, onCaptchaConsumed]);

  async function finishLogin() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Could not load your account.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }

    if (profile.role === "seller") {
      router.replace("/seller/dashboard");
      router.refresh();
      return;
    }

    router.replace("/");
    router.refresh();
  }

  function initializeGoogle() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      setMessage("Google sign-in is not configured.");
      return;
    }

    const google = (
      window as typeof window & { google?: GoogleIdentityApi }
    ).google;
    const container = document.getElementById("google-signin-button");

    if (!google || !container) {
      return;
    }

    google.accounts.id.initialize({
      client_id: clientId,

      callback: async (response: { credential?: string }) => {
        const currentCaptchaToken = captchaTokenRef.current;

        if (captchaRequiredRef.current && !currentCaptchaToken) {
          setMessage("Complete the security check first.");
          return;
        }

        if (!response.credential) {
          setMessage("Google did not return a credential.");
          return;
        }

        setLoading(true);
        setMessage(null);

        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            options: currentCaptchaToken
              ? { captchaToken: currentCaptchaToken }
              : undefined,
          });

          if (error) {
            throw error;
          }

          await finishLogin();
        } catch (error) {
          console.error("Google sign-in failed:", error);

          setMessage(
            error instanceof Error
              ? error.message
              : "Could not continue with Google.",
          );

          setLoading(false);
          onCaptchaConsumedRef.current?.();
        }
      },
    });

    container.innerHTML = "";

    google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
    });
  }

  return (
    <div>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGoogle}
      />

      <div
        id="google-signin-button"
        className={
          loading || (captchaRequired && !captchaToken)
            ? "pointer-events-none opacity-50"
            : ""
        }
      />

      {captchaRequired && !captchaToken && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Complete the security check to continue with Google.
        </p>
      )}

      {loading && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Connecting to Google...
        </p>
      )}

      {message && (
        <p className="mt-2 text-center text-xs text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
