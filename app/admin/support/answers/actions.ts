"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin, error } = await supabase.rpc("current_user_is_admin");

  if (error || !isAdmin) {
    redirect("/");
  }

  return {
    supabase,
    user,
  };
}

function parseKeywords(value: string) {
  return [
    ...new Set(
      value
        .split("\n")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export async function createSupportAnswer(formData: FormData) {
  const { supabase } = await requireAdmin();

  const slug = String(formData.get("slug") ?? "").trim();

  const category = String(formData.get("category") ?? "").trim();

  const question = String(formData.get("question") ?? "").trim();

  const keywords = parseKeywords(String(formData.get("keywords") ?? ""));

  const answer = String(formData.get("answer") ?? "").trim();

  const requiresHuman = formData.get("requiresHuman") === "on";

  const showInMenu = formData.get("showInMenu") === "on";

  const priority = Number(formData.get("priority") ?? 100);

  const menuOrder = Number(formData.get("menuOrder") ?? 100);

  const { data: id, error } = await supabase.rpc(
    "admin_create_support_answer",
    {
      p_slug: slug,
      p_category: category,
      p_keywords: keywords,
      p_answer: answer,
      p_requires_human: requiresHuman,
      p_priority: priority,
      p_question: question || null,
      p_show_in_menu: showInMenu,
      p_menu_order: menuOrder,
    },
  );

  if (error) {
    console.error("Could not create support answer:", error);

    throw new Error(error.message || "Could not create support answer.");
  }

  revalidatePath("/admin/support/answers");

  revalidatePath("/account/support/new");

  redirect(`/admin/support/answers/${id}`);
}

export async function updateSupportAnswer(id: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const slug = String(formData.get("slug") ?? "").trim();

  const category = String(formData.get("category") ?? "").trim();

  const question = String(formData.get("question") ?? "").trim();

  const keywords = parseKeywords(String(formData.get("keywords") ?? ""));

  const answer = String(formData.get("answer") ?? "").trim();

  const requiresHuman = formData.get("requiresHuman") === "on";

  const showInMenu = formData.get("showInMenu") === "on";

  const priority = Number(formData.get("priority") ?? 100);

  const menuOrder = Number(formData.get("menuOrder") ?? 100);

  const { error } = await supabase.rpc("admin_update_support_answer", {
    p_id: id,
    p_slug: slug,
    p_category: category,
    p_keywords: keywords,
    p_answer: answer,
    p_requires_human: requiresHuman,
    p_priority: priority,
    p_question: question || null,
    p_show_in_menu: showInMenu,
    p_menu_order: menuOrder,
  });

  if (error) {
    console.error("Could not update support answer:", error);

    throw new Error(error.message || "Could not update support answer.");
  }

  revalidatePath("/admin/support/answers");

  revalidatePath(`/admin/support/answers/${id}`);

  revalidatePath("/account/support/new");
}

export async function setSupportAnswerActive(id: string, active: boolean) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("admin_set_support_answer_active", {
    p_id: id,
    p_active: active,
  });

  if (error) {
    throw new Error(error.message || "Could not update support answer.");
  }

  revalidatePath("/admin/support/answers");

  revalidatePath(`/admin/support/answers/${id}`);

  revalidatePath("/account/support/new");
}
