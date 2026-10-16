import type { Api } from "../comune/api.ts";

// Le richieste al programma (vedi preload). La finestra non può fare altro.

declare global {
  interface Window {
    htd: Api;
  }
}

export const api: Api = window.htd;

export type Rotta = { pagina: "oggi" | "corso" | "lezione" | "ripasso" | "scheda" | "impostazioni"; slug?: string; ancora?: string };

/** L'indirizzo dentro la finestra: #/oggi, #/corso, #/lezione/<slug>, #/ripasso, #/scheda, #/impostazioni. */
export function leggiRotta(): Rotta {
  const [, pagina, slug] = window.location.hash.replace(/^#/, "").split("/");
  if (pagina === "lezione" && slug) return { pagina: "lezione", slug: decodeURIComponent(slug) };
  if (pagina === "corso" || pagina === "ripasso" || pagina === "scheda" || pagina === "impostazioni") return { pagina };
  return { pagina: "oggi" };
}

export function vaiA(rotta: string): void {
  window.location.hash = rotta;
}
