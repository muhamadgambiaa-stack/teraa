import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ConfirmDeleteForm } from "@/components/ConfirmDeleteForm";
import { SiteHeader } from "@/components/SiteHeader";

import { removeConversation } from "./actions";

type UserSummary = {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
};

type MessageSummary = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export default async function MessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/messages");
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      product_id,
      created_at,
      buyer_deleted_at,
      seller_deleted_at,
      products(
        id,
        title,
        product_photos(
          photo_url,
          is_cover,
          sort_order
        )
      )
      `,
    )
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

  if (error) {
    console.error("Conversation lookup failed:", error);
  }

  const rows = (conversations ?? []).filter((conversation) =>
    conversation.buyer_id === user.id
      ? conversation.buyer_deleted_at === null
      : conversation.seller_deleted_at === null,
  );

  const participantIds = [
    ...new Set(
      rows.map((conversation) =>
        conversation.buyer_id === user.id
          ? conversation.seller_id
          : conversation.buyer_id,
      ),
    ),
  ];

  let users: UserSummary[] = [];

  if (participantIds.length > 0) {
    const { data, error: usersError } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        profile_photo_url
        `,
      )
      .in("id", participantIds);

    if (usersError) {
      console.error("Message participant lookup failed:", usersError);
    } else {
      users = (data ?? []) as UserSummary[];
    }
  }

  const conversationIds = rows.map((conversation) => conversation.id);

  let allMessages: MessageSummary[] = [];

  if (conversationIds.length > 0) {
    const { data, error: messagesError } = await supabase
      .from("messages")
      .select(
        `
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        read_at
        `,
      )
      .in("conversation_id", conversationIds)
      .order("created_at", {
        ascending: false,
      });

    if (messagesError) {
      console.error("Message lookup failed:", messagesError);
    } else {
      allMessages = (data ?? []) as MessageSummary[];
    }
  }

  /*
   * Prepare conversation information once,
   * then sort by the newest message.
   */
  const prepared = rows
    .map((conversation) => {
      const otherUserId =
        conversation.buyer_id === user.id
          ? conversation.seller_id
          : conversation.buyer_id;

      const otherUser = users.find((entry) => entry.id === otherUserId) ?? null;

      const conversationMessages = allMessages.filter(
        (message) => message.conversation_id === conversation.id,
      );

      const latestMessage = conversationMessages[0] ?? null;

      const unreadCount = conversationMessages.filter(
        (message) => message.sender_id !== user.id && message.read_at === null,
      ).length;

      const productRaw = (
        conversation as {
          products?:
            | {
                id: string;
                title: string;
                product_photos?: {
                  photo_url: string;
                  is_cover: boolean;
                  sort_order: number;
                }[];
              }
            | {
                id: string;
                title: string;
                product_photos?: {
                  photo_url: string;
                  is_cover: boolean;
                  sort_order: number;
                }[];
              }[];
        }
      ).products;

      const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;

      const photos = product?.product_photos ?? [];

      const productPhoto =
        photos.find((photo) => photo.is_cover)?.photo_url ??
        [...photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.photo_url ??
        null;

      return {
        conversation,
        otherUser,
        otherUserId,
        latestMessage,
        unreadCount,
        product,
        productPhoto,
        sortDate: latestMessage?.created_at ?? conversation.created_at,
      };
    })
    .sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
    );

  const totalUnread = prepared.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h1
              className="font-display text-2xl"
              style={{ color: "var(--ink)" }}
            >
              Messages
            </h1>

            {totalUnread > 0 && (
              <span
                className="min-w-6 h-6 rounded-full px-1.5 inline-flex items-center justify-center text-xs font-semibold text-white"
                style={{ background: "var(--clay)" }}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-1">
            Chat with buyers and sellers about marketplace listings.
          </p>
        </div>

        {prepared.length === 0 ? (
          <div
            className="rounded-xl border p-10 text-center bg-white"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            <div className="text-3xl mb-3">💬</div>

            <p className="font-medium">No messages yet</p>

            <p className="text-sm text-gray-500 mt-1">
              When you message a seller or a buyer contacts you, the
              conversation will appear here.
            </p>

            <Link
              href="/"
              className="inline-block rounded-full px-5 py-2.5 text-white text-sm font-medium mt-5"
              style={{
                background: "var(--indigo)",
              }}
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div
            className="rounded-xl border bg-white overflow-hidden"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            {prepared.map(
              ({
                conversation,
                otherUser,
                otherUserId,
                latestMessage,
                unreadCount,
                product,
                productPhoto,
              }) => {
                const displayName = otherUser?.full_name ?? "Teraa user";

                const initial = displayName.charAt(0).toUpperCase() || "T";

                return (
                  <div
                    key={conversation.id}
                    className="border-b last:border-b-0"
                    style={{
                      borderColor: "var(--sand)",
                    }}
                  >
                    <Link
                      href={`/messages/${conversation.id}`}
                      className={`flex items-center gap-3 px-3 py-3.5 hover:bg-gray-50 transition border-l-[3px] ${
                        unreadCount > 0
                          ? "bg-[#f5f8fb]"
                          : "border-l-transparent"
                      }`}
                      style={
                        unreadCount > 0
                          ? { borderLeftColor: "var(--indigo)" }
                          : undefined
                      }
                    >
                      {/* USER AVATAR */}

                      <div className="relative shrink-0">
                        {otherUser?.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={otherUser.profile_photo_url}
                            alt={displayName}
                            className="w-11 h-11 rounded-full object-cover border"
                            style={{
                              borderColor: "var(--sand)",
                            }}
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-white"
                            style={{
                              background: "var(--indigo)",
                            }}
                          >
                            {initial}
                          </div>
                        )}

                        {unreadCount > 0 && (
                          <span
                            className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center text-[10px] text-white font-semibold border-2 border-white"
                            style={{
                              background: "var(--clay)",
                            }}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>

                      {/* CONTENT */}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p
                            className={`text-sm truncate ${
                              unreadCount > 0 ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {displayName}
                          </p>

                          {latestMessage && (
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {formatMessageTime(latestMessage.created_at)}
                            </span>
                          )}
                        </div>

                        {product && (
                          <div className="flex items-center gap-2 mt-1">
                            {productPhoto && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={productPhoto}
                                alt=""
                                className="w-6 h-6 rounded object-cover border shrink-0"
                                style={{
                                  borderColor: "var(--sand)",
                                }}
                              />
                            )}

                            <p className="text-xs text-gray-500 truncate">
                              {product.title}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 mt-1">
                          <p
                            className={`text-xs truncate ${
                              unreadCount > 0
                                ? "text-gray-700 font-medium"
                                : "text-gray-400"
                            }`}
                          >
                            {latestMessage
                              ? latestMessage.sender_id === user.id
                                ? `You: ${latestMessage.content}`
                                : latestMessage.content
                              : "Start conversation"}
                          </p>

                          {unreadCount > 0 && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                background: "var(--clay)",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* PROFILE SHORTCUT */}

                    <div className="px-4 pb-2 -mt-0.5 flex items-center justify-end gap-4">
                      <Link
                        href={`/profile/${otherUserId}`}
                        className="text-[11px] text-gray-400 hover:underline"
                      >
                        View profile
                      </Link>

                      <ConfirmDeleteForm
                        action={removeConversation.bind(null, conversation.id)}
                        confirmMessage={`Remove your conversation with ${displayName}? It will return if a new message is sent.`}
                        label="Delete conversation"
                        className="text-[11px] text-red-600 hover:underline"
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </main>
    </>
  );
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const sameYear = date.getFullYear() === now.getFullYear();

  if (sameYear) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
