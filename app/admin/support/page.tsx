import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin } = await supabase.rpc("current_user_is_admin");

  if (!isAdmin) {
    redirect("/");
  }

  const { data: threads, error } = await supabase
    .from("support_threads")
    .select(
      `
      id,
      user_id,
      category,
      subject,
      status,
      assigned_agent_id,
      created_at,
      last_message_at
      `,
    )
    .order("last_message_at", {
      ascending: false,
    })
    .limit(100);

  if (error) {
    console.error("Could not load support queue:", error);
  }

  const userIds = [...new Set((threads ?? []).map((thread) => thread.user_id))];

  const userNames = new Map<string, string>();

  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabase.rpc("get_public_profile", {
        p_user_id: userId,
      });

      const raw = Array.isArray(data) ? data[0] : data;

      if (raw) {
        userNames.set(
          userId,
          raw.full_name ?? raw.business_name ?? "Teraa user",
        );
      }
    }),
  );

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <div className="mb-6">
          <h1
            className="font-display text-2xl"
            style={{
              color: "var(--ink)",
            }}
          >
            Support
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            User support conversations
          </p>
        </div>

        {!threads || threads.length === 0 ? (
          <div
            className="rounded-xl border bg-white p-8 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="font-medium">Support queue is empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/admin/support/${thread.id}`}
                className="block rounded-xl border bg-white p-4 hover:shadow-sm transition"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{thread.subject}</p>

                    <p className="text-xs text-gray-500 mt-1">
                      {userNames.get(thread.user_id) ?? "Teraa user"}
                    </p>

                    <p className="text-[11px] text-gray-400 mt-1 capitalize">
                      {thread.category.replace("_", " ")}
                    </p>
                  </div>

                  <StatusBadge status={thread.status} />
                </div>

                <p className="text-xs text-gray-400 mt-3">
                  Updated {new Date(thread.last_message_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "resolved"
      ? "Resolved"
      : status === "agent_handling"
        ? "Handling"
        : "Waiting";

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
      style={{
        background:
          status === "resolved"
            ? "#e3f0e8"
            : status === "agent_handling"
              ? "#e6edf3"
              : "#fbf3df",

        color:
          status === "resolved"
            ? "var(--leaf)"
            : status === "agent_handling"
              ? "var(--indigo)"
              : "var(--gold)",
      }}
    >
      {label}
    </span>
  );
}
