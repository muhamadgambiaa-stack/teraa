"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function subscribeToPlatform() {
  return () => undefined;
}

function getPlatformSnapshot() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true;

  if (standalone) return "installed";

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ? "ios" : "web";
}

export function InstallTeraa() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const platform = useSyncExternalStore(
    subscribeToPlatform,
    getPlatformSnapshot,
    () => "loading",
  );
  const [installedThisSession, setInstalledThisSession] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstalledThisSession(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstalledThisSession(true);
    }

    setDeferredPrompt(null);
  }

  const showIOS = platform === "ios";

  if (platform === "installed" || installedThisSession || dismissed) {
    return null;
  }

  if (!deferredPrompt && !showIOS) {
    return null;
  }

  return (
    <div
      className="fixed left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:hidden"
      style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-2 text-xl text-slate-400"
        aria-label="Close install prompt"
      >
        ×
      </button>

      <div className="pr-6">
        <p className="font-semibold text-slate-900">Install Teraa</p>

        {showIOS ? (
          <p className="mt-1 text-sm text-slate-600">
            Tap the Share button in Safari, then choose{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Add Teraa to your phone for faster access.
          </p>
        )}
      </div>

      {!showIOS && deferredPrompt && (
        <button
          type="button"
          onClick={handleInstall}
          className="mt-3 w-full rounded-xl bg-[#173563] px-4 py-3 font-semibold text-white"
        >
          Install Teraa
        </button>
      )}
    </div>
  );
}
