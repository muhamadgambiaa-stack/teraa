import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { markAllNotificationsRead, markNotificationRead } from "./actions";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

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

  const rows = (notifications ?? []) as NotificationItem[];

  const unreadCount = rows.filter(
    (notification) => !notification.read_at,
  ).length;

  const groups = groupNotifications(rows);

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5 sm:pb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="font-display text-2xl"
                style={{ color: "var(--ink)" }}
              >
                Notifications
              </h1>

              {unreadCount > 0 && (
                <span
                  className="min-w-6 h-6 rounded-full px-1.5 inline-flex items-center justify-center text-xs font-semibold text-white"
                  style={{ background: "var(--clay)" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-1">
              Updates about your orders, account and marketplace activity.
            </p>
          </div>

          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap bg-white"
                style={{
                  color: "var(--indigo)",
                  borderColor: "var(--sand)",
                }}
              >
                Mark all as read
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
            <div
              className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center"
              style={{
                background: "#f3f4f6",
                color: "var(--indigo)",
              }}
            >
              <NotificationIcon type="default" size={22} />
            </div>

            <p className="font-medium">No notifications yet</p>

            <p className="text-sm text-gray-500 mt-1">
              Updates about orders, listings and your account will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="text-xs uppercase tracking-wide font-semibold text-gray-500 mb-2 px-1">
                  {group.label}
                </h2>

                <div
                  className="rounded-xl border bg-white overflow-hidden"
                  style={{ borderColor: "var(--sand)" }}
                >
                  {group.items.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                    />
                  ))}
                </div>
              </section>
            ))}
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

function NotificationRow({
  notification,
}: {
  notification: NotificationItem;
}) {
  const unread = !notification.read_at;

  const content = (
    <div
      className={`flex gap-3 px-3.5 py-3.5 transition-colors hover:bg-gray-50 ${
        unread ? "bg-[#f5f8fb] border-l-[3px]" : "border-l-[3px] border-l-transparent"
      }`}
      style={unread ? { borderLeftColor: "var(--indigo)" } : undefined}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: getNotificationBackground(notification.type),
          color: getNotificationColor(notification.type),
        }}
      >
        <NotificationIcon type={notification.type} size={17} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-sm leading-snug ${
              unread ? "font-semibold" : "font-medium"
            }`}
          >
            {notification.title}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {unread && (
              <span
                className="w-2 h-2 rounded-full mt-1"
                style={{ background: "var(--clay)" }}
                aria-label="Unread"
              />
            )}

            {notification.link && <ChevronIcon />}
          </div>
        </div>

        {notification.message && (
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed line-clamp-2">
            {notification.message}
          </p>
        )}

        <time
          dateTime={notification.created_at}
          className="block text-[11px] text-gray-400 mt-1.5"
        >
          {formatNotificationTime(notification.created_at)}
        </time>
      </div>
    </div>
  );

  return (
    <div
      className="border-b last:border-b-0"
      style={{ borderColor: "var(--sand)" }}
    >
      {notification.link ? (
        <form
          action={async () => {
            "use server";

            await markNotificationRead(notification.id);
            redirect(notification.link!);
          }}
        >
          <button
            type="submit"
            className="w-full text-left"
            aria-label={`Open notification: ${notification.title}`}
          >
            {content}
          </button>
        </form>
      ) : (
        <form action={markNotificationRead.bind(null, notification.id)}>
          <button
            type="submit"
            className="w-full text-left"
            aria-label={`Mark notification as read: ${notification.title}`}
          >
            {content}
          </button>
        </form>
      )}
    </div>
  );
}

function groupNotifications(rows: NotificationItem[]) {
  const groups = new Map<string, NotificationItem[]>([
    ["Today", []],
    ["Yesterday", []],
    ["Earlier", []],
  ]);

  rows.forEach((notification) => {
    groups.get(getNotificationGroup(notification.created_at))?.push(notification);
  });

  return Array.from(groups, ([label, items]) => ({ label, items })).filter(
    (group) => group.items.length > 0,
  );
}

function getNotificationGroup(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const notificationDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const daysAgo = Math.floor((today - notificationDay) / 86_400_000);

  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return "Earlier";
}

function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400 mt-0.5"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function NotificationIcon({
  type,
  size = 18,
}: {
  type: string;
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (type) {
    case "order":
      return (
        <svg {...props}>
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
          <path d="m4 7.5 8 4.5 8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );

    case "payment":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h3" />
        </svg>
      );

    case "message":
      return (
        <svg {...props}>
          <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-4.5A2 2 0 0 1 2 15V7a2 2 0 0 1 2-2Z" />
        </svg>
      );

    case "verification":
      return (
        <svg {...props}>
          <path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "moderation":
      return (
        <svg {...props}>
          <path d="M12 3 2.8 20h18.4L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "appeal":
      return (
        <svg {...props}>
          <path d="M9 7 4 12l5 5" />
          <path d="M4 12h9a7 7 0 0 1 7 7" />
        </svg>
      );

    default:
      return (
        <svg {...props}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
      );
  }
}

function getNotificationBackground(type: string) {
  switch (type) {
    case "order":
      return "#e6edf3";

    case "payment":
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

function getNotificationColor(type: string) {
  switch (type) {
    case "payment":
    case "verification":
      return "var(--leaf)";

    case "moderation":
      return "var(--clay)";

    case "appeal":
      return "var(--gold)";

    default:
      return "var(--indigo)";
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
