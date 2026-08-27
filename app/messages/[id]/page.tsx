import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { sendMessage } from "./actions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/messages/${id}`);
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      buyer_id,
      seller_id,
      product_id,
      products(
        id,
        title,
        price,
        status,
        product_photos(
          photo_url,
          is_cover,
          sort_order
        )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !conversation) {
    notFound();
  }

  if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) {
    notFound();
  }

  const otherUserId =
    conversation.buyer_id === user.id
      ? conversation.seller_id
      : conversation.buyer_id;

  const { data: otherUser, error: otherUserError } = await supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      city,
      profile_photo_url
    `,
    )
    .eq("id", otherUserId)
    .maybeSingle();

  if (otherUserError) {
    console.error("Could not load conversation participant:", otherUserError);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select(
      `
      id,
      sender_id,
      content,
      created_at,
      read_at
    `,
    )
    .eq("conversation_id", conversation.id)
    .order("created_at", {
      ascending: true,
    });

  if (messagesError) {
    console.error("Could not load conversation messages:", messagesError);
  }

  const { error: readError } = await supabase
    .from("messages")
    .update({
      read_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversation.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  if (readError) {
    console.error("Could not mark conversation as read:", readError);
  }

  const productRaw = (
    conversation as {
      products?:
        | {
            id: string;
            title: string;
            price: number;
            status: string;
            product_photos?: {
              photo_url: string;
              is_cover: boolean;
              sort_order: number;
            }[];
          }
        | {
            id: string;
            title: string;
            price: number;
            status: string;
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

  const displayName = otherUser?.full_name ?? "Teraa user";
  const initial = displayName.charAt(0).toUpperCase() || "T";

  const currentUserIsBuyer = conversation.buyer_id === user.id;

  return (
    <>
      <SiteHeader />

      <main className="max-w-2xl mx-auto px-0 sm:px-4 sm:py-5">
        {/* CONVERSATION HEADER */}

        <div
          className="bg-white border-b"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          {/* PERSON */}

          <div className="flex items-center gap-3 px-4 py-3">
            <Link
              href="/messages"
              aria-label="Back to messages"
              className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 text-2xl"
              style={{
                color: "var(--ink)",
              }}
            >
              ‹
            </Link>

            <Link href={`/profile/${otherUserId}`} className="shrink-0">
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
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  {initial}
                </div>
              )}
            </Link>

            <Link href={`/profile/${otherUserId}`} className="flex-1 min-w-0">
              <p
                className="font-semibold text-[15px] truncate"
                style={{
                  color: "var(--ink)",
                }}
              >
                {displayName}
              </p>

              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {currentUserIsBuyer ? "Seller" : "Buyer"}
                {otherUser?.city ? ` · ${otherUser.city}` : ""}
              </p>
            </Link>

            <Link
              href={`/profile/${otherUserId}`}
              className="text-xs font-medium shrink-0"
              style={{
                color: "var(--indigo)",
              }}
            >
              View profile
            </Link>
          </div>

          {/* PRODUCT */}

          {product && (
            <Link
              href={`/products/${product.id}`}
              className="flex items-center gap-3 mx-4 mb-3 rounded-xl border p-2.5"
              style={{
                borderColor: "var(--sand)",
                background: "var(--cream, #fffdf8)",
              }}
            >
              {productPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productPhoto}
                  alt={product.title}
                  className="w-11 h-11 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-[9px] text-gray-400 shrink-0"
                  style={{
                    background: "var(--sand)",
                  }}
                >
                  No photo
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{product.title}</p>

                <div className="flex items-center gap-2 mt-0.5">
                  <p
                    className="text-xs font-semibold"
                    style={{
                      color: "var(--clay)",
                    }}
                  >
                    GMD {Number(product.price).toLocaleString()}
                  </p>

                  <span className="text-gray-300">·</span>

                  <p className="text-[11px] text-gray-500 capitalize">
                    {product.status.replaceAll("_", " ")}
                  </p>
                </div>
              </div>

              <span className="text-gray-400 text-lg">›</span>
            </Link>
          )}
        </div>

        {/* MESSAGES */}

        <section className="px-4 py-5 space-y-3 min-h-[52vh]">
          {(messages ?? []).length === 0 && (
            <div className="text-center py-14">
              <div className="text-3xl mb-3">💬</div>

              <p
                className="font-medium text-sm"
                style={{
                  color: "var(--ink)",
                }}
              >
                Start the conversation
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Ask about the item, condition or delivery.
              </p>
            </div>
          )}

          {(messages ?? []).map((message, index) => {
            const mine = message.sender_id === user.id;

            const previous = index > 0 ? messages?.[index - 1] : null;

            const showDate =
              !previous || !sameDay(previous.created_at, message.created_at);

            return (
              <div key={message.id}>
                {showDate && (
                  <div className="text-center my-4">
                    <span className="inline-block rounded-full px-3 py-1 text-[10px] text-gray-500 bg-gray-100">
                      {formatDateDivider(message.created_at)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      mine ? "rounded-br-md" : "rounded-bl-md"
                    }`}
                    style={{
                      background: mine ? "var(--indigo)" : "#f3f4f6",

                      color: mine ? "white" : "var(--ink)",
                    }}
                  >
                    <p className="text-sm whitespace-pre-wrap wrap-break-word">
                      {message.content}
                    </p>

                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span
                        className="text-[9px]"
                        style={{
                          color: mine ? "#dbe4ee" : "#9ca3af",
                        }}
                      >
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {mine && message.read_at && (
                        <span
                          className="text-[9px]"
                          style={{
                            color: "#dbe4ee",
                          }}
                        >
                          ✓✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* MESSAGE COMPOSER */}

        <section
          className="sticky bottom-16.25 sm:bottom-0 bg-white border-t px-3 py-2 z-30"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <form action={sendMessage.bind(null, conversation.id)}>
            <div
              className="flex items-end gap-2 rounded-2xl border p-2 bg-white"
              style={{
                borderColor: "var(--sand)",
              }}
            >
              <textarea
                name="content"
                required
                maxLength={2000}
                rows={1}
                placeholder="Write a message..."
                className="flex-1 resize-none outline-none text-sm px-2 py-2 max-h-32 bg-transparent"
              />

              <button
                type="submit"
                className="rounded-full px-5 py-2 text-sm text-white font-medium shrink-0"
                style={{
                  background: "var(--indigo)",
                }}
              >
                Send
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}

function sameDay(first: string, second: string) {
  const a = new Date(first);
  const b = new Date(second);

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateDivider(value: string) {
  const date = new Date(value);
  const today = new Date();

  const yesterday = new Date();

  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date.toISOString(), today.toISOString())) {
    return "Today";
  }

  if (sameDay(date.toISOString(), yesterday.toISOString())) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",

    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}
