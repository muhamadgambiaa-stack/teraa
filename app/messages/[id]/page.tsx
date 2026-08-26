import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";

import { markConversationRead, sendMessage } from "./actions";

export default async function ConversationPage({
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

  const { data: otherUser } = await supabase
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

  await markConversationRead(conversation.id);

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

      <main className="max-w-2xl mx-auto px-0 sm:px-4 py-0 sm:py-5">
        {/* CHAT HEADER */}

        <section
          className="sticky top-[113px] sm:top-[73px] z-30 bg-white border-b px-4 py-3"
          style={{
            borderColor: "var(--sand)",
          }}
        >
          <div className="flex items-center gap-3">
            <Link href="/messages" className="text-xl shrink-0">
              ←
            </Link>

            <Link href={`/profile/${otherUserId}`} className="shrink-0">
              {otherUser?.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={otherUser.profile_photo_url}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover border"
                  style={{
                    borderColor: "var(--sand)",
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{
                    background: "var(--indigo)",
                  }}
                >
                  {initial}
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${otherUserId}`}
                className="font-semibold text-sm hover:underline block truncate"
              >
                {displayName}
              </Link>

              <p className="text-xs text-gray-500 truncate">
                {currentUserIsBuyer ? "Seller" : "Buyer"}

                {otherUser?.city ? ` · ${otherUser.city}` : ""}
              </p>
            </div>

            <Link
              href={`/profile/${otherUserId}`}
              className="text-xs underline text-gray-500 shrink-0"
            >
              Profile
            </Link>
          </div>
        </section>

        {/* PRODUCT CONTEXT */}

        {product && (
          <Link
            href={`/products/${product.id}`}
            className="flex items-center gap-3 px-4 py-3 border-b bg-[#fffdf8] hover:bg-gray-50"
            style={{
              borderColor: "var(--sand)",
            }}
          >
            {productPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productPhoto}
                alt={product.title}
                className="w-14 h-14 rounded-lg object-cover border shrink-0"
                style={{
                  borderColor: "var(--sand)",
                }}
              />
            ) : (
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-[10px] text-gray-400 shrink-0"
                style={{
                  background: "var(--sand)",
                }}
              >
                No photo
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{product.title}</p>

              <p
                className="text-sm font-semibold mt-1"
                style={{
                  color: "var(--clay)",
                }}
              >
                GMD {Number(product.price).toLocaleString()}
              </p>

              <p className="text-xs text-gray-500 mt-0.5 capitalize">
                {product.status}
              </p>
            </div>

            <span className="text-gray-400">›</span>
          </Link>
        )}

        {/* MESSAGES */}

        <section className="px-4 py-5 space-y-3 min-h-[45vh]">
          {(messages ?? []).length === 0 && (
            <div className="text-center py-10">
              <div className="text-3xl mb-3">💬</div>

              <p className="font-medium text-sm">Start the conversation</p>

              <p className="text-xs text-gray-500 mt-1">
                Ask about the product, condition, delivery or payment.
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
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[10px] text-gray-500"
                      style={{
                        background: "#f3f4f6",
                      }}
                    >
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
                    <p className="text-sm whitespace-pre-wrap break-words">
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

        {/* SEND MESSAGE */}

        <section
          className="sticky bottom-[65px] sm:bottom-0 bg-white border-t px-3 sm:px-0 py-2 z-30"
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
                className="flex-1 resize-none outline-none text-sm px-2 py-2 max-h-32"
              />

              <button
                type="submit"
                className="rounded-full px-4 py-2 text-sm text-white font-medium shrink-0"
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
