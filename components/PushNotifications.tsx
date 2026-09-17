"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { usesSimpleLayout } from "@/lib/app-routes";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function saveSubscription(subscription: PushSubscription) {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log("Push subscription waiting for login.");
    return;
  }

  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    console.error("Invalid push subscription.");
    return;
  }

  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
  });

  if (error) {
    console.error("Could not save push subscription:", error);
    return;
  }

  console.log("Push subscription saved.");
}

async function createAndSaveSubscription(
  registration: ServiceWorkerRegistration,
) {
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
}

export function PushNotifications() {
  const pathname = usePathname();
  const simpleLayout = usesSimpleLayout(pathname);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (simpleLayout) return;

    let active = true;

    async function setupPush() {
      const canUseNotifications =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!canUseNotifications) {
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) {
        return;
      }

      setSupported(true);

      const currentPermission = Notification.permission;

      setPermission(currentPermission);

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        await navigator.serviceWorker.ready;

        // Important:
        // If permission was already granted before this update,
        // create and save the subscription automatically.
        if (currentPermission === "granted") {
          await createAndSaveSubscription(registration);
        }
      } catch (error) {
        console.error("Push notification setup failed:", error);
      }
    }

    setupPush();

    return () => {
      active = false;
    };
  }, [pathname, simpleLayout]);

  async function enableNotifications() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      await navigator.serviceWorker.ready;

      const result = await Notification.requestPermission();

      setPermission(result);

      if (result !== "granted") {
        return;
      }

      await createAndSaveSubscription(registration);

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

  if (
    simpleLayout ||
    dismissed ||
    !supported ||
    permission === "granted" ||
    permission === "denied"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:bottom-5 sm:left-auto sm:right-5 sm:w-[360px]">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="Dismiss notification prompt"
      >
        ×
      </button>

      <p className="pr-8 font-semibold text-slate-900">
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
