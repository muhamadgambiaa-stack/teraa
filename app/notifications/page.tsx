import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { markAllNotificationsRead, markNotificationRead } from "./actions";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/notifications");
  }

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select(
      `
      id,
      type,
      title,
      message,
      link,
      read_at,
      created_at
      `,
    )
    .eq("user_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (error) {
    console.error("Notification lookup failed:", error);
  }

  const rows = notifications ?? [];

  const unreadCount = rows.filter(
    (notification) => !notification.read_at,
  ).length;

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1
              className="font-display text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              Notifications
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Updates about your orders, account and marketplace activity.
            </p>
          </div>

          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-xs underline whitespace-nowrap"
                style={{
                  color: "var(--indigo)",
                }}
              >
                Mark all read
              </button>
            </form>
          )}
        </div>

        {rows.length === 0 ? (
          <div
            className="rounded-xl border p-10 text-center bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div className="text-3xl mb-3">🔔</div>

            <p className="font-medium">No notifications yet</p>

            <p className="text-sm text-gray-500 mt-1">
              Updates about orders, listings and your account will appear here.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl border bg-white overflow-hidden"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            {rows.map((notification) => {
              const unread = !notification.read_at;

              const content = (
                <div
                  className={`flex gap-3 px-4 py-4 ${
                    unread ? "bg-[#fffdf8]" : ""
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                    style={{
                      background: getNotificationBackground(notification.type),
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-3">
                      <p
                        className={`text-sm ${
                          unread ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {notification.title}
                      </p>

                      {unread && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                          style={{
                            background: "var(--clay)",
                          }}
                        />
                      )}
                    </div>

                    {notification.message && (
                      <p className="text-sm text-gray-500 mt-1">
                        {notification.message}
                      </p>
                    )}

                    <p className="text-[10px] text-gray-400 mt-2">
                      {formatNotificationTime(notification.created_at)}
                    </p>
                  </div>
                </div>
              );

              return (
                <div
                  key={notification.id}
                  className="border-b last:border-b-0"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                >
                  {notification.link ? (
                    <form
                      action={async () => {
                        "use server";

                        await markNotificationRead(notification.id);

                        redirect(notification.link!);
                      }}
                    >
                      <button type="submit" className="w-full text-left">
                        {content}
                      </button>
                    </form>
                  ) : (
                    <form
                      action={markNotificationRead.bind(null, notification.id)}
                    >
                      <button type="submit" className="w-full text-left">
                        {content}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/account" className="text-sm underline text-gray-500">
            Back to account
          </Link>
        </div>
      </main>
    </>
  );
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "order":
      return "📦";

    case "payment":
      return "💳";

    case "message":
      return "💬";

    case "verification":
      return "✓";

    case "moderation":
      return "⚠️";

    case "appeal":
      return "↩️";

    default:
      return "🔔";
  }
}

function getNotificationBackground(type: string) {
  switch (type) {
    case "order":
      return "#e6edf3";

    case "payment":
      return "#e3f0e8";

    case "verification":
      return "#e3f0e8";

    case "moderation":
      return "#fdf0f0";

    case "appeal":
      return "#fbf3df";

    default:
      return "#f3f4f6";
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  const now = new Date();

  const difference = now.getTime() - date.getTime();

  const minutes = Math.floor(difference / (1000 * 60));

  const hours = Math.floor(minutes / 60);

  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}
