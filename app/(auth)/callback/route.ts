import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type PublicRole = "buyer" | "seller";

function getSafeRole(value: unknown): PublicRole {
  return value === "seller" ? "seller" : "buyer";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

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
   * requires phone, city, role and legal consent.
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

  const city =
    typeof metadata.city === "string" ? metadata.city.trim() : "";

  const role = getSafeRole(metadata.role);

  if (!fullName || !phoneNumber) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  const { error: profileInsertError } = await supabase.from("users").insert({
    id: user.id,
    full_name: fullName,
    phone_number: phoneNumber,
    city,
    role,
  });

  if (profileInsertError) {
    console.error("Profile creation failed:", profileInsertError);

    return NextResponse.redirect(
      `${origin}/login?error=profile_creation_failed`,
    );
  }

  if (role === "seller") {
    const { data: existingSeller, error: sellerLookupError } = await supabase
      .from("sellers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (sellerLookupError) {
      console.error("Seller lookup failed:", sellerLookupError);

      return NextResponse.redirect(
        `${origin}/login?error=seller_lookup_failed`,
      );
    }

    if (!existingSeller) {
      const { error: sellerInsertError } = await supabase
        .from("sellers")
        .insert({
          id: user.id,
          business_name: fullName || "Teraa Seller",
        });

      if (sellerInsertError) {
        console.error("Seller profile creation failed:", sellerInsertError);

        return NextResponse.redirect(
          `${origin}/login?error=seller_creation_failed`,
        );
      }
    }

    return NextResponse.redirect(`${origin}/seller/dashboard`);
  }

  return NextResponse.redirect(`${origin}/`);
}
