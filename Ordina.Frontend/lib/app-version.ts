/** Versión embebida en el bundle del cliente (inyectada en build). */
export const APP_UI_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export const APP_UI_VERSION_KEY = "app-ui-version";
