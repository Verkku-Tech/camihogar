export const AUTO_RELOAD_MS = 5 * 60 * 1000;

export type PwaUpdateListener = () => void;

const listeners = new Set<PwaUpdateListener>();
let waitingWorker: ServiceWorker | null = null;
let registrationRef: ServiceWorkerRegistration | null = null;
let controllerChangeBound = false;
let updatePollInterval: ReturnType<typeof setInterval> | null = null;

export function subscribePwaUpdate(listener: PwaUpdateListener): () => void {
  listeners.add(listener);
  if (waitingWorker) {
    listener();
  }
  return () => listeners.delete(listener);
}

function notifyUpdateAvailable() {
  for (const listener of listeners) {
    listener();
  }
}

export function getWaitingServiceWorker(): ServiceWorker | null {
  return waitingWorker;
}

export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return registrationRef;
}

export function reloadOnControllerChange(): void {
  if (typeof window === "undefined" || controllerChangeBound) return;
  controllerChangeBound = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

export function applyUpdate(): void {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    return;
  }
  if (registrationRef?.waiting) {
    registrationRef.waiting.postMessage({ type: "SKIP_WAITING" });
  }
}

export async function checkForServiceWorkerUpdate(): Promise<void> {
  if (!registrationRef) return;
  try {
    await registrationRef.update();
  } catch (error) {
    console.warn("Error al buscar actualizaciones del Service Worker:", error);
  }
}

function trackWaitingWorker(worker: ServiceWorker | null) {
  waitingWorker = worker;
  if (worker) {
    notifyUpdateAvailable();
  }
}

export async function registerForUpdates(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  reloadOnControllerChange();

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    registrationRef = registration;

    if (registration.waiting) {
      trackWaitingWorker(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          trackWaitingWorker(registration.waiting ?? newWorker);
        }
      });
    });

    if (!updatePollInterval) {
      updatePollInterval = setInterval(() => {
        void checkForServiceWorkerUpdate();
      }, 60_000);
    }

    return registration;
  } catch (error) {
    console.error("Error registrando Service Worker:", error);
    return null;
  }
}

/** Dispara el flujo de actualización cuando version.json difiere del bundle. */
export function notifyVersionMismatch(): void {
  notifyUpdateAvailable();
}
