"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

type DeleteAccountResult =
  | { success: true }
  | { success: false; message: string };

function createServiceClient(url: string, serviceRoleKey: string) {
  return createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type ServiceClient = ReturnType<typeof createServiceClient>;

const DELETION_MESSAGES: Record<string, string> = {
  active_orders_exist:
    "You cannot delete your account while an order is still active. Complete or cancel it first.",
  unresolved_delivery_issue_exists:
    "You cannot delete your account while a delivery issue is unresolved.",
  unpaid_commission_exists:
    "You cannot delete your seller account until all commission payments are settled.",
  unresolved_report_exists:
    "You cannot delete your account while a report against you or one of your listings is unresolved.",
  admin_deletion_not_allowed:
    "Administrator accounts cannot be deleted through self-service.",
};

function accountDeletionMessage(message: string) {
  const match = Object.entries(DELETION_MESSAGES).find(([code]) =>
    message.includes(code),
  );

  return (
    match?.[1] ??
    "Couldn't delete your account. Please try again or contact support."
  );
}

async function listStorageFiles(
  admin: ServiceClient,
  bucket: string,
  prefix: string,
) {
  const paths: string[] = [];
  const folders = [prefix];

  while (folders.length > 0) {
    const folder = folders.pop();
    if (!folder) continue;

    let offset = 0;

    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(folder, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) throw error;

      for (const item of data ?? []) {
        const itemPath = `${folder}/${item.name}`;

        if (item.id) {
          paths.push(itemPath);
        } else {
          folders.push(itemPath);
        }
      }

      if (!data || data.length < 100) break;
      offset += data.length;
    }
  }

  return paths;
}

async function removeFiles(
  admin: ServiceClient,
  bucket: string,
  paths: string[],
) {
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw error;
  }
}

export async function deleteAccountPermanently(
  confirmation: string,
): Promise<DeleteAccountResult> {
  if (confirmation !== "delete my account") {
    return {
      success: false,
      message: 'Type exactly "delete my account" to continue.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: "Your session has expired. Please log in again.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      message: "Account deletion is temporarily unavailable. Contact support.",
    };
  }

  const admin = createServiceClient(supabaseUrl, serviceRoleKey);

  let sellerDocumentPaths: string[];
  let productPhotoPaths: string[];

  try {
    [sellerDocumentPaths, productPhotoPaths] = await Promise.all([
      listStorageFiles(admin, "seller-documents", user.id),
      listStorageFiles(admin, "product-photos", user.id),
    ]);
  } catch (error) {
    console.error("Could not prepare account file cleanup:", error);
    return {
      success: false,
      message: "Account deletion is temporarily unavailable. Please try again.",
    };
  }

  const { error: deleteError } = await supabase.rpc("delete_my_account", {
    p_confirmation: confirmation,
  });

  if (deleteError) {
    console.error("Account deletion failed:", deleteError);
    return {
      success: false,
      message: accountDeletionMessage(deleteError.message),
    };
  }

  try {
    await Promise.all([
      removeFiles(admin, "seller-documents", sellerDocumentPaths),
      removeFiles(admin, "product-photos", productPhotoPaths),
    ]);
  } catch (error) {
    console.error("Account deleted, but file cleanup needs attention:", error);
  }

  return { success: true };
}
