import type { MouseEvent } from "react";
import { api } from "../api.ts";

/**
 * Mostra l'HTML preparato dal programma (markdown senza HTML, codice colorato: niente script possibili). I link non si
 * aprono nella finestra: un clic li passa al programma, che li apre nel browser solo verso siti conosciuti.
 */
export function Html({ html, classe = "md", come = "div" }: { html: string; classe?: string; come?: "div" | "span" | "li" }) {
  const clic = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest("a");
    if (!link) return;
    e.preventDefault();
    const url = link.getAttribute("href");
    if (url && /^https:\/\//.test(url)) void api.apriLink(url);
  };
  const Tag = come;
  return <Tag className={classe} onClick={clic} dangerouslySetInnerHTML={{ __html: html }} />;
}
