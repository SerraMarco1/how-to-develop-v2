import MarkdownIt from "markdown-it";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import gdscript from "@shikijs/langs/gdscript";
import ini from "@shikijs/langs/ini";
import json from "@shikijs/langs/json";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";

// Il testo delle lezioni (markdown scritto dai modelli) diventa HTML qui, nel programma, non nella finestra.
// Il markdown NON può contenere HTML: ogni < viene mostrato come testo. I link possono essere solo http(s); la finestra
// non li apre da sola ma li passa al programma, che li apre nel browser solo verso siti conosciuti.

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
md.validateLink = (url) => /^https?:\/\//i.test(url.trim());

let evidenziatore: HighlighterCore | null = null;

async function preparaEvidenziatore(): Promise<HighlighterCore> {
  evidenziatore ??= await createHighlighterCore({ themes: [githubLight, githubDark], langs: [gdscript, ini, json], engine: createJavaScriptRegexEngine() });
  return evidenziatore;
}

/** Codice colorato (GDScript di solito). Il contenuto viene sempre trattato come testo, mai come HTML. */
export async function codiceHtml(codice: string, linguaggio = "gdscript"): Promise<string> {
  const h = await preparaEvidenziatore();
  const lingua = ["gdscript", "ini", "json"].includes(linguaggio) ? linguaggio : linguaggio === "godot" || linguaggio === "tscn" ? "ini" : "gdscript";
  try {
    return h.codeToHtml(codice, { lang: lingua, themes: { light: "github-light", dark: "github-dark" } });
  } catch {
    return `<pre class="codice"><code>${md.utils.escapeHtml(codice)}</code></pre>`;
  }
}

export async function markdownHtml(testo: string): Promise<string> {
  // I blocchi di codice nel markdown vengono colorati come gli altri.
  const pezzi: string[] = [];
  const conSegnaposto = testo.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (_, lingua: string, codice: string) => {
    pezzi.push(`${lingua}\u0000${codice}`);
    return `\n\nHTDCODICE${pezzi.length - 1}HTDFINE\n\n`;
  });
  let html = md.render(conSegnaposto);
  for (const [i, pezzo] of pezzi.entries()) {
    const [lingua, codice] = pezzo.split("\u0000");
    html = html.replace(`<p>HTDCODICE${i}HTDFINE</p>`, await codiceHtml(codice.replace(/\n$/, ""), lingua || "gdscript"));
  }
  return html;
}

/** Una riga di testo senza markdown, sicura da mettere in HTML. */
export function testoSemplice(testo: string): string {
  return md.utils.escapeHtml(testo);
}
