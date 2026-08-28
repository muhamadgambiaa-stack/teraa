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
      const { data, error: profileError } = await supabase.rpc(
        "get_public_profile",
        {
          p_user_id: userId,
        },
      );

      if (profileError) {
        console.error("Could not load support user:", profileError);

        return;
      }

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

  const resolvedCount = (threads ?? []).filter(
    (thread) => thread.status === "resolved",
  ).length;

  return (
    <>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
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

          <Link
            href="/admin/support/answers"
            className="rounded-full px-4 py-2.5 text-sm font-medium text-white shrink-0"
            style={{
              background: "var(--indigo)",
            }}
          >
            Manage answers
          </Link>
        </div>

        {/* STATS */}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard value={waitingCount} label="Needs support" />

          <StatCard value={handlingCount} label="Human support" />

          <StatCard value={automatedCount} label="Automated" />

          <StatCard value={resolvedCount} label="Resolved" />
        </div>

        {/* SUPPORT QUEUE */}

        {!threads || threads.length === 0 ? (
          <div
            className="rounded-xl border bg-white p-8 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <SupportIcon />

            <p className="font-medium mt-3">Support queue is empty</p>

            <p className="text-sm text-gray-500 mt-1">
              New support requests will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => {
              const needsAttention = thread.status === "waiting_for_agent";

              return (
                <Link
                  key={thread.id}
                  href={`/admin/support/${thread.id}`}
                  className="block rounded-xl border bg-white p-4 hover:shadow-sm transition"
                  style={{
                    borderColor: needsAttention ? "var(--gold)" : "var(--sand)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{thread.subject}</p>

                      <p className="text-xs text-gray-500 mt-1">
                        {userNames.get(thread.user_id) ?? "Teraa user"}
                      </p>

                      <p className="text-[11px] text-gray-400 mt-1">
                        {categoryLabel(thread.category)}
                      </p>
                    </div>

                    <StatusBadge status={thread.status} />
                  </div>

                  {needsAttention && (
                    <div
                      className="rounded-lg px-3 py-2 mt-3 text-xs"
                      style={{
                        background: "#fbf3df",
                        color: "var(--gold)",
                      }}
                    >
                      Human support is required for this conversation.
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-3">
                    Updated {new Date(thread.last_message_at).toLocaleString()}
                  </p>
                </Link>
              );
            })}
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

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    order: "Order",
    delivery: "Delivery",
    seller_account: "Seller account",
    account: "Account",
    payment: "Payment",
    report: "Report",
    other: "Other",
  };

  return labels[category] ?? category.replaceAll("_", " ");
}

function SupportIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mx-auto"
      style={{
        color: "var(--indigo)",
      }}
      aria-hidden="true"
    >
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v4a2 2 0 0 0 2 2h2v-6H4Z" />
      <path d="M20 13v4a2 2 0 0 1-2 2h-2v-6h4Z" />
      <path d="M16 19c0 2-2 3-4 3" />
    </svg>
  );
}
