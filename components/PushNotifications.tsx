"use client";

import { useEffect, useState } from "react";

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

  async function enableNotifications() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");

      await navigator.serviceWorker.ready;

      const result = await Notification.requestPermission();

      setPermission(result);

      if (result === "granted") {
        await registration.showNotification("Teraa notifications enabled", {
          body: "You'll receive important updates from Teraa here.",
          icon: "/branding/teraa-icon.svg",
          badge: "/branding/teraa-icon.svg",
          data: {
            url: "/notifications",
          },
        });
      }
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
