"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    if ("serviceWorker" in navigator && (window.isSecureContext || local)) {
      navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => undefined);
    }
  }, []);
  return null;
}
