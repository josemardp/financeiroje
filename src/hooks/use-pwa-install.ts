import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const DISMISS_KEY = "financeai:pwa-install-dismissed-until";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

function readDismissedUntil() {
  if (typeof window === "undefined") return 0;

  const value = window.localStorage.getItem(DISMISS_KEY);
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function isIosSafari() {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent;
  const vendor = window.navigator.vendor || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) && /Apple/.test(vendor);

  return isIOS && isSafari;
}

function isAndroidChrome() {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent;
  return /Android/i.test(ua) && /Chrome\//i.test(ua) && !/EdgA|OPR|SamsungBrowser/i.test(ua);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function usePwaInstall() {
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(true);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const syncEnvironment = () => {
      const installed = isStandaloneMode();
      const dismissedUntil = readDismissedUntil();

      setIsInstalled(installed);
      setIsIOS(isIosSafari());
      setIsAndroid(isAndroidChrome());
      setIsDismissed(dismissedUntil > Date.now());
      setIsReady(true);
    };

    syncEnvironment();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => syncEnvironment();

    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      syncEnvironment();

      if (isStandaloneMode()) return;
      if (readDismissedUntil() > Date.now()) {
        setDeferredPrompt(null);
        return;
      }

      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      window.localStorage.removeItem(DISMISS_KEY);
      setDeferredPrompt(null);
      setIsDismissed(false);
      setIsInstalled(true);
    };

    mediaQuery.addEventListener("change", handleDisplayModeChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = React.useCallback((ttlMs = DISMISS_TTL_MS) => {
    if (typeof window === "undefined") return;

    const dismissedUntil = Date.now() + ttlMs;
    window.localStorage.setItem(DISMISS_KEY, String(dismissedUntil));
    setIsDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    setDeferredPrompt(null);

    if (outcome === "accepted") {
      window.localStorage.removeItem(DISMISS_KEY);
      setIsDismissed(false);
      return true;
    }

    dismiss();
    return false;
  }, [deferredPrompt, dismiss]);

  const canPromptInstall = isMobile && !isInstalled && !isDismissed && !!deferredPrompt;
  const showIOSFallback = isMobile && !isInstalled && !isDismissed && !deferredPrompt && isIOS;
  const showAndroidFallback = isMobile && !isInstalled && !isDismissed && !deferredPrompt && isAndroid;
  const shouldShow = isReady && (canPromptInstall || showIOSFallback || showAndroidFallback);

  return {
    canPromptInstall,
    dismiss,
    isInstalled,
    isIOSFallback: showIOSFallback,
    isAndroidFallback: showAndroidFallback,
    promptInstall,
    shouldShow,
  };
}
