import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";

type PushWebhookBody = {
  record?: {
    user_id?: string;
    title?: string;
    message?: string | null;
    link?: string | null;
  };
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return null;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.PUSH_WEBHOOK_SECRET;
  const suppliedSecret = request.headers.get("x-push-webhook-secret");

  if (
    !expectedSecret ||
    !suppliedSecret ||
    suppliedSecret !== expectedSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as PushWebhookBody;
  const notification = payload.record ?? {};

  if (!notification.user_id || !notification.title) {
    return NextResponse.json(
      { error: "Invalid notification payload" },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !vapidPublicKey ||
    !vapidPrivateKey ||
    !vapidSubject
  ) {
    return NextResponse.json(
      { error: "Push service is not configured" },
      { status: 500 },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);

  if (error) {
    return NextResponse.json(
      { error: "Could not load push subscriptions" },
      { status: 500 },
    );
  }

  const message = JSON.stringify({
    title: notification.title,
    body: notification.message || "You have a new Teraa notification.",
    url: notification.link || "/notifications",
  });

  const results = await Promise.allSettled(
    ((subscriptions || []) as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          message,
        );

        return "sent";
      } catch (error) {
        const statusCode = getStatusCode(error);

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
        }

        throw error;
      }
    }),
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;

  return NextResponse.json({ sent });
}