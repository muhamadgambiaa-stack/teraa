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

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "current_user_is_admin",
  );

  if (adminError || !isAdmin) {
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

  const waitingCount = (threads ?? []).filter(
    (thread) => thread.status === "waiting_for_agent",
  ).length;

  const handlingCount = (threads ?? []).filter(
    (thread) => thread.status === "agent_handling",
  ).length;

  const automatedCount = (threads ?? []).filter(
    (thread) => thread.status === "bot_handling",
  ).length;

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
            Manage Teraa support conversations.
          </p>
        </div>

        {/* STATS */}

        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard value={waitingCount} label="Waiting" />

          <StatCard value={handlingCount} label="Human support" />

          <StatCard value={automatedCount} label="Automated" />
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
                  borderColor:
                    thread.status === "waiting_for_agent"
                      ? "var(--gold)"
                      : "var(--sand)",
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

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="rounded-xl border bg-white p-3"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <p
        className="text-xl font-bold"
        style={{
          color: "var(--ink)",
        }}
      >
        {value}
      </p>

      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let label = "Waiting";
  let background = "#fbf3df";
  let color = "var(--gold)";

  if (status === "bot_handling") {
    label = "Automated";
    background = "#e6edf3";
    color = "var(--indigo)";
  }

  if (status === "waiting_for_agent") {
    label = "Needs support";
    background = "#fbf3df";
    color = "var(--gold)";
  }

  if (status === "agent_handling") {
    label = "Human support";
    background = "#e3f0e8";
    color = "var(--leaf)";
  }

  if (status === "resolved") {
    label = "Resolved";
    background = "#eeeeee";
    color = "#666";
  }

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold shrink-0"
      style={{
        background,
        color,
      }}
    >
      {label}
    </span>
  );
}
