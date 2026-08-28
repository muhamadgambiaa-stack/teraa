import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SupportAutoRefresh } from "@/components/support/SupportAutoRefresh";

import {
  sendSupportMessage,
  requestHumanSupport,
  resolveOwnSupportThread,
} from "../actions";

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

  const isBotHandling = thread.status === "bot_handling";

  const isWaiting = thread.status === "waiting_for_agent";

  const isHumanHandling = thread.status === "agent_handling";

  const isResolved = thread.status === "resolved";

  return (
    <>
      <SiteHeader />

      <SupportAutoRefresh />

      <main className="max-w-2xl mx-auto px-4 py-5 pb-32 sm:pb-8">
        <Link
          href="/account/support"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
        >
          <ArrowLeftIcon />
          Support
        </Link>

        {/* HEADER */}

        <div className="mt-4 mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
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

        {/* AUTOMATED SUPPORT STATUS */}

        {isBotHandling && (
          <div
            className="rounded-xl border p-4 mb-5"
            style={{
              borderColor: "var(--indigo)",
              background: "#f7f8fb",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "#e6edf3",
                  color: "var(--indigo)",
                }}
              >
                <BotIcon />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: "var(--indigo)",
                  }}
                >
                  Automated support
                </p>

                <p className="text-xs text-gray-600 mt-1 leading-5">
                  Teraa Assistant is helping with this conversation. It can
                  answer common marketplace questions using Teraa&apos;s
                  approved support information.
                </p>

                <p className="text-xs text-gray-500 mt-2">
                  If you still need help, you can ask for a human support agent
                  at any time.
                </p>

                
        {thread.status === "bot_handling" && (
          <div
            className="rounded-xl border bg-white p-4 mb-4"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{
                color: "var(--ink)",
              }}
            >
              Did this solve your problem?
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Let us know whether you still need help.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <form
                action={resolveOwnSupportThread.bind(
                  null,
                  thread.id,
                )}
              >
                <button
                  type="submit"
                  className="w-full rounded-full px-4 py-2.5 text-sm font-semibold"
                  style={{
                    background: "#e3f0e8",
                    color: "var(--leaf)",
                  }}
                >
                  This solved my problem
                </button>
              </form>

              <form
                action={requestHumanSupport.bind(
                  null,
                  thread.id,
                )}
              >
                <button
                  type="submit"
                  className="w-full rounded-full border px-4 py-2.5 text-sm font-semibold"
                  style={{
                    borderColor: "var(--indigo)",
                    color: "var(--indigo)",
                  }}
                >
                  I still need help
                </button>
              </form>
            </div>
          </div>
        )}
<form
                  action={sendSupportMessage.bind(null, thread.id)}
                  className="mt-3"
                >
                  <input
                    type="hidden"
                    name="message"
                    value="I want to talk to a support agent."
                  />

                  <button
                    type="submit"
                    className="rounded-full border px-4 py-2 text-xs font-semibold"
                    style={{
                      borderColor: "var(--indigo)",
                      color: "var(--indigo)",
                    }}
                  >
                    Talk to a person
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* WAITING */}

        {isWaiting && (
          <div
            className="rounded-xl border p-4 mb-5"
            style={{
              borderColor: "var(--gold)",
              background: "#fbf3df",
            }}
          >
            <div className="flex items-start gap-3">
              <WaitingIcon />

              <div>
                <p className="text-sm font-semibold">
                  Waiting for human support
                </p>

                <p className="text-xs text-gray-600 mt-1">
                  Your conversation has been sent to Teraa Support. A support
                  agent can continue with you here.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* HUMAN SUPPORT */}

        {isHumanHandling && (
          <div
            className="rounded-xl border p-4 mb-5"
            style={{
              borderColor: "var(--leaf)",
              background: "#f4faf6",
            }}
          >
            <div className="flex items-start gap-3">
              <HumanIcon />

              <div>
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: "var(--leaf)",
                  }}
                >
                  Human support joined
                </p>

                <p className="text-xs text-gray-600 mt-1">
                  A Teraa support agent is now handling this conversation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* RESOLVED */}

        {isResolved && (
          <div
            className="rounded-xl border p-4 mb-5"
            style={{
              borderColor: "var(--leaf)",
              background: "#e3f0e8",
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{
                color: "var(--leaf)",
              }}
            >
              Support request resolved
            </p>

            <p className="text-xs text-gray-600 mt-1">
              This request was marked as resolved. If you still need help, send
              another message below.
            </p>
          </div>
        )}

        {/* MESSAGES */}

        <section className="space-y-3 min-h-[45vh]">
          {(messages ?? []).map((message) => {
            const fromUser = message.sender_type === "user";

            const fromBot = message.sender_type === "bot";

            const fromAgent = message.sender_type === "agent";

            const label = fromUser
              ? "You"
              : fromBot
                ? "Teraa Assistant"
                : "Teraa Support";

            return (
              <div
                key={message.id}
                className={`flex ${fromUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[84%] rounded-2xl px-4 py-3 ${
                    fromBot ? "border" : ""
                  }`}
                  style={{
                    background: fromUser
                      ? "var(--indigo)"
                      : fromBot
                        ? "#fbfaf7"
                        : "#e6edf3",

                    color: fromUser ? "white" : "var(--ink)",

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
              placeholder={
                isHumanHandling
                  ? "Message Teraa Support"
                  : isWaiting
                    ? "Add another message"
                    : "Ask Teraa Assistant"
              }
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
    label = "Automated support";
    background = "#e6edf3";
    color = "var(--indigo)";
  }

  if (status === "waiting_for_agent") {
    label = "Waiting for agent";
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
    <svg
      width="18"
      height="18"
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

function HumanIcon() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "#e3f0e8",
        color: "var(--leaf)",
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
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    </div>
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

function WaitingIcon() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "#f5e8bd",
        color: "var(--gold)",
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
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </div>
  );
}
