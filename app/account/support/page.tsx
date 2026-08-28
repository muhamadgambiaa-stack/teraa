import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

export default async function SupportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/support");
  }

  const { data: threads, error } = await supabase
    .from("support_threads")
    .select(
      `
      id,
      category,
      subject,
      status,
      created_at,
      last_message_at
      `,
    )
    .neq("status", "resolved")
    .eq("user_id", user.id)
    .order("last_message_at", {
      ascending: false,
    });

  if (error) {
    console.error("Could not load support conversations:", error);
  }

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 sm:pb-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Support
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Get help with your Teraa account, orders, delivery or marketplace
              issues.
            </p>
          </div>

          <Link
            href="/account/support/new"
            className="rounded-full px-4 py-2 text-sm font-medium text-white shrink-0"
            style={{
              background: "var(--indigo)",
            }}
          >
            Contact support
          </Link>
        </div>

        {!threads || threads.length === 0 ? (
          <div
            className="rounded-xl border bg-white p-8 text-center"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <SupportIcon />

            <p className="font-medium mt-3">No support conversations</p>

            <p className="text-sm text-gray-500 mt-1 mb-4">
              Teraa Assistant can help answer common questions, with human
              support available when needed.
            </p>

            <Link
              href="/account/support/new"
              className="inline-block rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              Start a conversation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/account/support/${thread.id}`}
                className="block rounded-xl border bg-white p-4 hover:shadow-sm transition"
                style={{
                  borderColor: "var(--sand)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {thread.subject}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {categoryLabel(thread.category)}
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

  return labels[category] ?? category;
}

function StatusBadge({ status }: { status: string }) {
  let label = "Waiting";
  let background = "#fbf3df";
  let color = "var(--gold)";

  if (status === "bot_handling") {
    label = "Automated support";
    background = "#e6edf3";
    color = "var(--indigo)";
  }

  if (status === "waiting_for_agent") {
    label = "Waiting for support";
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
