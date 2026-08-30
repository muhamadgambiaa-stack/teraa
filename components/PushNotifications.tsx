"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    const canUseNotifications =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(canUseNotifications);

    if (canUseNotifications) {
      setPermission(Notification.permission);

      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }
  }, []);

  async function saveSubscription(subscription: PushSubscription) {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("User not logged in.");
      return;
    }

    const json = subscription.toJSON();

    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      console.error("Invalid push subscription.");
      return;
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "endpoint",
      },
    );

    if (error) {
      console.error("Could not save push subscription:", error);
      return;
    }

    console.log("Push subscription saved.");
  }

  async function enableNotifications() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      await navigator.serviceWorker.ready;

      const result = await Notification.requestPermission();

      setPermission(result);

      if (result !== "granted") {
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        console.error("Missing VAPID public key.");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      await saveSubscription(subscription);

      await registration.showNotification("Teraa notifications enabled", {
        body: "You'll receive messages, orders and important Teraa updates here.",
        icon: "/branding/teraa-icon.svg",
        badge: "/branding/teraa-icon.svg",
        data: {
          url: "/notifications",
        },
      });
    } catch (error) {
      console.error("Could not enable notifications:", error);
    }
  }

  if (!supported || permission === "granted") {
    return null;
  }

  if (permission === "denied") {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      <p className="font-semibold text-slate-900">
        Turn on Teraa notifications
      </p>

      <p className="mt-1 text-sm text-slate-600">
        Get notified about messages, orders and important account updates.
      </p>

      <button
        type="button"
        onClick={enableNotifications}
        className="mt-3 w-full rounded-xl bg-[#173563] px-4 py-3 font-semibold text-white"
      >
        Enable notifications
      </button>
    </div>
  );
}
