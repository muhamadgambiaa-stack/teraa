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

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "current_user_is_admin",
  );

  if (adminError || !isAdmin) {
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

  const { data: profileData, error: profileError } = await supabase.rpc(
    "get_public_profile",
    {
      p_user_id: thread.user_id,
    },
  );

  if (profileError) {
    console.error("Could not load support customer:", profileError);
  }

  const rawProfile = Array.isArray(profileData) ? profileData[0] : profileData;

  const customerName =
    rawProfile?.full_name ?? rawProfile?.business_name ?? "Teraa user";

  const canTakeConversation =
    thread.status === "waiting_for_agent" || thread.status === "bot_handling";

  return (
    <>
      <SiteHeader />

      <SupportAutoRefresh />

      <main className="max-w-3xl mx-auto px-4 py-5 pb-32 sm:pb-8">
        <Link
          href="/admin/support"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
        >
          <ArrowLeftIcon />
          Support queue
        </Link>

        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 mt-5 mb-5">
          <div className="min-w-0">
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

        {/* BOT HANDLING */}

        {thread.status === "bot_handling" && (
          <div
            className="rounded-xl border p-4 mb-4"
            style={{
              borderColor: "var(--indigo)",
              background: "#f7f8fb",
            }}
          >
            <div className="flex items-start gap-3">
              <BotIcon />

              <div>
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: "var(--indigo)",
                  }}
                >
                  Teraa Assistant is handling this
                </p>

                <p className="text-xs text-gray-600 mt-1 leading-5">
                  The automated support system has found answers for this
                  conversation. No human action is currently required.
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  You can still take over the conversation if necessary.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* WAITING */}

        {thread.status === "waiting_for_agent" && (
          <div
            className="rounded-xl border p-4 mb-4"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <p className="text-sm font-semibold">Human support required</p>

            <p className="text-xs text-gray-600 mt-1">
              The Teraa Assistant could not resolve this request or the user
              asked to speak with a person.
            </p>
          </div>
        )}

        {/* ORDER */}

        {thread.order_id && (
          <div
            className="rounded-xl border p-3 mb-4 text-sm"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p className="text-xs text-gray-500">Related order</p>

            <p className="font-medium mt-0.5">#{thread.order_id.slice(0, 8)}</p>
          </div>
        )}

        {/* ADMIN ACTIONS */}

        <div className="flex flex-wrap gap-2 mb-5">
          {canTakeConversation && (
            <form action={claimSupportThread.bind(null, thread.id)}>
              <button
                type="submit"
                className="rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{
                  background: "var(--indigo)",
                }}
              >
                {thread.status === "bot_handling"
                  ? "Take over conversation"
                  : "Take conversation"}
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

        {/* MESSAGES */}

        <section className="space-y-3 min-h-[45vh]">
          {(messages ?? []).map((message) => {
            const fromAgent = message.sender_type === "agent";

            const fromBot = message.sender_type === "bot";

            const fromCustomer = message.sender_type === "user";

            const label = fromAgent
              ? "Human support"
              : fromBot
                ? "Teraa Assistant"
                : customerName;

            return (
              <div
                key={message.id}
                className={`flex ${
                  fromAgent ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[84%] rounded-2xl px-4 py-3 ${
                    fromBot ? "border" : ""
                  }`}
                  style={{
                    background: fromAgent
                      ? "var(--indigo)"
                      : fromBot
                        ? "#fbfaf7"
                        : "#f3f4f6",

                    color: fromAgent ? "white" : "var(--ink)",

                    borderColor: fromBot ? "var(--sand)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {fromBot && <BotSmallIcon />}

                    {fromAgent && <HumanSmallIcon />}

                    <p className="text-[10px] font-semibold opacity-70">
                      {label}
                    </p>
                  </div>

                  <p className="text-sm whitespace-pre-wrap break-words leading-5">
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

        {/* COMPOSER */}

        <form
          action={sendAdminSupportMessage.bind(null, thread.id)}
          className="sticky bottom-0 mt-5 border-t bg-white py-3"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          {thread.status === "bot_handling" && (
            <p className="text-[11px] text-gray-500 mb-2">
              Sending a reply will move this conversation from automated support
              to human support.
            </p>
          )}

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
      className="rounded-full px-3 py-1 text-xs font-semibold shrink-0"
      style={{
        background,
        color,
      }}
    >
      {label}
    </span>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function BotIcon() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "#e6edf3",
        color: "var(--indigo)",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M12 3v4" />
        <path d="M8 12h.01" />
        <path d="M16 12h.01" />
        <path d="M9 16h6" />
      </svg>
    </div>
  );
}

function BotSmallIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4" />
      <path d="M8 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  );
}

function HumanSmallIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
