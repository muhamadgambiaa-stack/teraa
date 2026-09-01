"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function MobileBottomNav() {
  const pathname = usePathname();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadBadges() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) {
          setUnreadMessages(0);
          setUnreadNotifications(0);
        }

        return;
      }

      /*
       * ----------------------------
       * UNREAD MESSAGES
       * ----------------------------
       */

      const { data: conversations, error: conversationError } = await supabase
        .from("conversations")
        .select("id, buyer_id, buyer_deleted_at, seller_deleted_at")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (conversationError) {
        console.error("Could not load conversations:", conversationError);
      }

      const visibleConversations = (conversations ?? []).filter(
        (conversation) =>
          conversation.buyer_id === user.id
            ? conversation.buyer_deleted_at === null
            : conversation.seller_deleted_at === null,
      );

      if (!conversationError && visibleConversations.length > 0) {
        const conversationIds = visibleConversations.map(
          (conversation) => conversation.id,
        );

        const { count, error: messageError } = await supabase
          .from("messages")
          .select("id", {
            count: "exact",
            head: true,
          })
          .in("conversation_id", conversationIds)
          .neq("sender_id", user.id)
          .is("read_at", null);

        if (messageError) {
          console.error("Could not load unread messages:", messageError);
        } else if (active) {
          setUnreadMessages(count ?? 0);
        }
      } else if (active) {
        setUnreadMessages(0);
      }

      /*
       * ----------------------------
       * UNREAD NOTIFICATIONS
       * ----------------------------
       */

      const { count: notificationCount, error: notificationError } =
        await supabase
          .from("notifications")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("user_id", user.id)
          .is("read_at", null);

      if (notificationError) {
        console.error(
          "Could not load unread notifications:",
          notificationError,
        );
      } else if (active) {
        setUnreadNotifications(notificationCount ?? 0);
      }
    }

    loadBadges();

    /*
     * Refresh whenever the route changes
     * or the user returns to the browser/app.
     */
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        loadBadges();
      }
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;

      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname]);

  const items = [
    {
      label: "Home",
      href: "/",
      icon: HomeIcon,
      badge: 0,
    },

    {
      label: "Messages",
      href: "/messages",
      icon: MessageIcon,
      badge: unreadMessages,
    },

    {
      label: "Notifications",
      href: "/notifications",
      icon: NotificationIcon,
      badge: unreadNotifications,
    },

    {
      label: "Me",
      href: "/account",
      icon: UserIcon,
      badge: 0,
    },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-white"
      style={{
        borderColor: "var(--sand)",
      }}
    >
      <div
        className="grid grid-cols-4"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {items.map((item) => {
          const activeItem =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 text-xs"
              style={{
                color: activeItem ? "var(--indigo)" : "#6b7280",
              }}
            >
              <div className="relative">
                <Icon active={activeItem} />

                {item.badge > 0 && (
                  <span
                    className="absolute -top-2 -right-3 min-w-[18px] h-[18px] rounded-full px-1 flex items-center justify-center text-[10px] text-white font-semibold"
                    style={{
                      background: "var(--clay)",
                    }}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>

              <span className={activeItem ? "font-semibold" : ""}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z"
      />
    </svg>
  );
}

function MessageIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-4.5A2 2 0 0 1 2 15V7a2 2 0 0 1 2-2Z"
      />
    </svg>
  );
}

function NotificationIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
      />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />

      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 21a8 8 0 0 1 16 0"
      />
    </svg>
  );
}
