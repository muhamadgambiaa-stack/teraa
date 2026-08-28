import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { SupportAutoRefresh } from "@/components/support/SupportAutoRefresh";

import {
  claimSupportThread,
  resolveSupportThread,
  sendAdminSupportMessage,
} from "../actions";

export default async function AdminSupportThreadPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

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

  const { data: thread, error: threadError } = await supabase
    .from("support_threads")
    .select(
      `
      id,
      user_id,
      category,
      subject,
      status,
      order_id,
      assigned_agent_id,
      created_at,
      resolved_at
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (threadError || !thread) {
    notFound();
  }

  const { data: messages, error: messagesError } = await supabase
    .from("support_messages")
    .select(
      `
      id,
      sender_id,
      sender_type,
      message,
      created_at
      `,
    )
    .eq("thread_id", thread.id)
    .order("created_at", {
      ascending: true,
    });

  if (messagesError) {
    console.error("Could not load support messages:", messagesError);
  }

  const { data: profileData } = await supabase.rpc("get_public_profile", {
    p_user_id: thread.user_id,
  });

  const rawProfile = Array.isArray(profileData) ? profileData[0] : profileData;

  const customerName =
    rawProfile?.full_name ?? rawProfile?.business_name ?? "Teraa user";

  return (
    <>
      <SiteHeader />

      <SupportAutoRefresh />

      <main className="max-w-3xl mx-auto px-4 py-5 pb-32 sm:pb-8">
        <Link
          href="/admin/support"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Support queue
        </Link>

        <div className="flex items-start justify-between gap-4 mt-5 mb-5">
          <div>
            <h1
              className="font-display text-xl"
              style={{
                color: "var(--ink)",
              }}
            >
              {thread.subject}
            </h1>

            <Link
              href={`/profile/${thread.user_id}`}
              className="text-sm mt-1 inline-block hover:underline"
              style={{
                color: "var(--indigo)",
              }}
            >
              {customerName}
            </Link>

            <p className="text-xs text-gray-500 mt-1 capitalize">
              {thread.category.replace("_", " ")}
            </p>
          </div>

          <StatusBadge status={thread.status} />
        </div>

        {thread.order_id && (
          <div
            className="rounded-xl border p-3 mb-4 text-sm"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            Related order:{" "}
            <span className="font-medium">#{thread.order_id.slice(0, 8)}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-5">
          {thread.status === "waiting_for_agent" && (
            <form action={claimSupportThread.bind(null, thread.id)}>
              <button
                type="submit"
                className="rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{
                  background: "var(--indigo)",
                }}
              >
                Take conversation
              </button>
            </form>
          )}

          {thread.status !== "resolved" && (
            <form action={resolveSupportThread.bind(null, thread.id)}>
              <button
                type="submit"
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={{
                  borderColor: "var(--leaf)",

                  color: "var(--leaf)",
                }}
              >
                Mark resolved
              </button>
            </form>
          )}
        </div>

        <section className="space-y-3 min-h-[50vh]">
          {(messages ?? []).map((message) => {
            const fromAgent = message.sender_type === "agent";

            return (
              <div
                key={message.id}
                className={`flex ${
                  fromAgent ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className="max-w-[82%] rounded-2xl px-4 py-3"
                  style={{
                    background: fromAgent ? "var(--indigo)" : "#f3f4f6",

                    color: fromAgent ? "white" : "var(--ink)",
                  }}
                >
                  <p className="text-[10px] font-medium mb-1 opacity-70">
                    {fromAgent ? "Support" : customerName}
                  </p>

                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.message}
                  </p>

                  <p className="text-[10px] mt-1.5 opacity-60">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        <form
          action={sendAdminSupportMessage.bind(null, thread.id)}
          className="sticky bottom-0 mt-5 border-t bg-white py-3"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex items-end gap-2">
            <textarea
              name="message"
              required
              rows={1}
              maxLength={4000}
              placeholder="Reply as Teraa Support"
              className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none resize-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <button
              type="submit"
              className="rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{
                background: "var(--indigo)",
              }}
            >
              Send
            </button>
          </div>
        </form>
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
      className="rounded-full px-3 py-1 text-xs font-semibold"
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
