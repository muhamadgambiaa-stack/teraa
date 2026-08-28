import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { SupportAutoRefresh } from "@/components/support/SupportAutoRefresh";

import { sendSupportMessage } from "../actions";

export default async function SupportThreadPage({
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
    redirect(`/login?redirect=/account/support/${id}`);
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
      created_at,
      resolved_at
      `,
    )
    .eq("id", id)
    .eq("user_id", user.id)
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

  return (
    <>
      <SiteHeader />

      <SupportAutoRefresh />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-32 sm:pb-8">
        <Link
          href="/account/support"
          className="text-xs text-gray-500 hover:underline"
        >
          ← Support
        </Link>

        <div className="mt-4 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1
                className="font-display text-xl"
                style={{
                  color: "var(--ink)",
                }}
              >
                {thread.subject}
              </h1>

              <p className="text-xs text-gray-500 mt-1">Teraa Support</p>
            </div>

            <StatusBadge status={thread.status} />
          </div>
        </div>

        <section className="space-y-3 min-h-[50vh]">
          {(messages ?? []).map((message) => {
            const mine = message.sender_type === "user";

            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[82%] rounded-2xl px-4 py-3"
                  style={{
                    background: mine ? "var(--indigo)" : "#f3f4f6",

                    color: mine ? "white" : "var(--ink)",
                  }}
                >
                  <p className="text-[10px] font-medium mb-1 opacity-70">
                    {mine ? "You" : "Teraa Support"}
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

        {thread.status === "waiting_for_agent" && (
          <div
            className="rounded-xl border p-3 mt-5 text-xs"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            Your message is waiting for a support agent.
          </div>
        )}

        {thread.status === "resolved" && (
          <div
            className="rounded-xl border p-3 mt-5 text-xs"
            style={{
              borderColor: "var(--leaf)",
              background: "#e3f0e8",
            }}
          >
            This support request was resolved. You can send another message
            below if you still need help. The conversation will reopen
            automatically.
          </div>
        )}

        <form
          action={sendSupportMessage.bind(null, thread.id)}
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
              placeholder="Message Teraa Support"
              className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none resize-none"
              style={{
                borderColor: "var(--sand)",
              }}
            />

            <button
              type="submit"
              className="rounded-full px-5 py-3 text-sm font-semibold text-white shrink-0"
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
        ? "Support joined"
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
