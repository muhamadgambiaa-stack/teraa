import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";


export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const next = requestUrl.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_callback_code`,
    );
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Supabase callback exchange failed:", exchangeError);

    return NextResponse.redirect(
      `${origin}/login?error=verification_failed`,
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Could not read user after callback:", userError);

    return NextResponse.redirect(`${origin}/login?error=session_failed`);
  }

  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  /*
   * Existing Teraa users do not need onboarding again.
   */
  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    console.error("Profile lookup failed:", profileLookupError);

    return NextResponse.redirect(
      `${origin}/login?error=profile_lookup_failed`,
    );
  }

  if (existingProfile) {
    if (existingProfile.role === "seller") {
      return NextResponse.redirect(`${origin}/seller/dashboard`);
    }

    return NextResponse.redirect(`${origin}/`);
  }

  /*
   * Google gives us authentication information, but Teraa still
   * requires a phone number and legal consent.
   *
   * New Google users therefore finish their profile on onboarding.
   */
  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "";

  const isGoogleUser =
    provider === "google" ||
    user.identities?.some((identity) => identity.provider === "google");

  if (isGoogleUser) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  /*
   * Email/password signup keeps using the information saved in
   * Auth metadata by the normal signup form.
   */
  const metadata = user.user_metadata ?? {};

  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";

  const phoneNumber =
    typeof metadata.phone_number === "string"
      ? metadata.phone_number.trim()
      : "";

  if (!fullName || !phoneNumber) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  const { error: profileInsertError } = await supabase.from("users").insert({
    id: user.id,
    full_name: fullName,
    phone_number: phoneNumber,
    role: "buyer",
  });

  if (profileInsertError) {
    console.error("Profile creation failed:", profileInsertError);

    return NextResponse.redirect(
      `${origin}/login?error=profile_creation_failed`,
    );
  }

  return NextResponse.redirect(`${origin}/`);
}
