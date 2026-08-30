"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CommissionActionResult = {
  error?: string;
  success?: string;
};

async function requireSeller() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: seller } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!seller) {
    redirect("/account");
  }

  return { supabase, user };
}

export async function requestPaymentDetails(
  commissionId: string,
): Promise<CommissionActionResult> {
  try {
    const { supabase } = await requireSeller();

    const { error } = await supabase.rpc(
      "request_commission_payment_details",
      {
        p_commission_id: commissionId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/seller/dashboard/commissions");
    revalidatePath("/notifications");

    return {
      success:
        "Payment details requested. Your deadline is paused while Teraa responds.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Couldn't request payment details.",
    };
  }
}

export async function submitCommissionProof(
  formData: FormData,
): Promise<CommissionActionResult> {
  try {
    const commissionId = String(
      formData.get("commissionId") ?? "",
    ).trim();

    const file = formData.get("proof");

    if (!commissionId || !(file instanceof File) || file.size === 0) {
      return { error: "Choose a payment-proof file." };
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        error: "Upload a JPG, PNG, WebP or PDF file.",
      };
    }

    if (file.size > 8 * 1024 * 1024) {
      return {
        error: "The payment proof must be smaller than 8 MB.",
      };
    }

    const { supabase, user } = await requireSeller();

    const safeName =
      file.name
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .slice(-100) || "proof";

    const proofPath =
      `${user.id}/${commissionId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("commission-proofs")
      .upload(proofPath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: submitError } = await supabase.rpc(
      "submit_commission_payment_proof",
      {
        p_commission_id: commissionId,
        p_proof_path: proofPath,
      },
    );

    if (submitError) {
      throw new Error(submitError.message);
    }

    revalidatePath("/seller/dashboard/commissions");
    revalidatePath("/admin/commissions");
    revalidatePath("/notifications");

    return {
      success: "Payment proof submitted for review.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Couldn't submit payment proof.",
    };
  }
}