"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GambianPhoneInput from "@/components/GambianPhoneInput";
import { isValidGambianLocalNumber, toGambianPhoneNumber } from "@/lib/gambian-phone";

export default function PhoneAuthForm({ signup = false, captchaRequired, captchaToken, onCaptchaConsumed }: {
  signup?: boolean;
  captchaRequired: boolean;
  captchaToken: string | null;
  onCaptchaConsumed: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const busy = useRef(false);
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const enabled = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === "true";

  async function sendCode() {
    if (!enabled || busy.current) return;
    setMessage(null);
    if (!isValidGambianLocalNumber(phone)) {
      setMessage("Enter a valid Gambian phone number.");
      return;
    }
    if (Date.now() < retryAt) {
      setMessage("Please wait a minute before requesting another code.");
      return;
    }
    if (captchaRequired && !captchaToken) {
      setMessage("Complete the security check first.");
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      const number = toGambianPhoneNumber(phone);
      const { error } = await supabase.auth.signInWithOtp({
        phone: number,
        options: { shouldCreateUser: signup, captchaToken: captchaToken ?? undefined },
      });
      if (error) throw error;
      setSentTo(number);
      setCode("");
      setRetryAt(Date.now() + 60_000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the code. Please try again.");
    } finally {
      onCaptchaConsumed();
      busy.current = false;
      setLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!sentTo || busy.current) return;
    if (!/^\d{6}$/.test(code)) {
      setMessage("Enter the 6-digit code from your SMS.");
      return;
    }
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: "sms" });
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("Could not verify your number. Try again.");
      const { data: profile, error: profileError } = await supabase.from("users").select("id").eq("id", data.user.id).maybeSingle();
      if (profileError) throw profileError;
      router.replace(profile ? "/" : "/onboarding");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify the code. Please try again.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  if (!enabled) return <p className="text-sm text-gray-600" role="status">Phone sign-in is not available yet. Please use email or Google.</p>;

  return (
    <form onSubmit={sentTo ? verifyCode : (event) => { event.preventDefault(); void sendCode(); }} className="space-y-4">
      {sentTo ? (
        <>
          <p className="text-sm text-gray-600">Enter the code sent to {sentTo}.</p>
          <label className="block text-sm font-medium">
            SMS code
            <input autoFocus required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="mt-1 w-full rounded-lg border px-3 py-3 text-sm" />
          </label>
        </>
      ) : (
        <label className="block text-sm font-medium">
          Phone number
          <GambianPhoneInput value={phone} onChange={setPhone} />
          <span className="mt-2 block text-xs font-normal text-gray-500">We will send you a code by SMS. No password needed.</span>
        </label>
      )}
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      <button type="submit" disabled={loading || (!sentTo && captchaRequired && !captchaToken)} className="w-full rounded-lg py-3 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--indigo)" }}>
        {loading ? "Please wait..." : sentTo ? "Verify and continue" : "Send code"}
      </button>
      {sentTo && <div className="flex justify-between gap-4 text-sm">
        <button type="button" disabled={loading} onClick={() => { setSentTo(null); setCode(""); setMessage(null); }} className="underline">Change number</button>
        <button type="button" disabled={loading || (captchaRequired && !captchaToken)} onClick={() => void sendCode()} className="underline disabled:opacity-50">Resend code</button>
      </div>}
    </form>
  );
}
