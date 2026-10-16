import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Strumenti comuni alle prove della fabbrica: un archivio finto (una cartella git come il ramo `corso`), un fornitore
// finto che risponde come Gemini, e l'ambiente impostato PRIMA di caricare i moduli della fabbrica (lo leggono all'avvio).

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CHIAVE_FINTA = "chiave-finta-di-prova-0123456789";

export function preparaAmbiente(nome: string): { dati: string; cache: string } {
  const dati = fs.mkdtempSync(path.join(os.tmpdir(), `htd-prova-${nome}-`));
  execFileSync("git", ["init", "-q", "-b", "corso"], { cwd: dati });
  // La cache di Godot e della documentazione: quella indicata (nei controlli su GitHub, come nella fabbrica) o lavoro/cache.
  const cache = process.env.HTD_CACHE ?? path.join(REPO, "lavoro", "cache");
  fs.mkdirSync(cache, { recursive: true });
  Object.assign(process.env, {
    HTD_REPO: REPO,
    HTD_DATI: dati,
    HTD_CACHE: cache,
    HTD_SENZA_PUSH: "1",
    HTD_MINUTI: "60",
    GEMINI_API_KEY: CHIAVE_FINTA,
  });
  for (const nome of ["OPENROUTER_API_KEY", "NVIDIA_API_KEY", "GROQ_API_KEY", "GITHUB_TOKEN", "GITHUB_REPOSITORY", "GITHUB_REPOSITORY_OWNER", "GITHUB_SHA"]) delete process.env[nome];
  return { dati, cache };
}

export type Gestore = (richiesta: { modello: string; testo: string; messaggi: { role: string; content: string }[] }) => { stato?: number; dati?: unknown; testo?: string; troncata?: boolean };

/** Un fornitore finto: per ogni richiesta chiama `gestore`, e risponde nel formato OpenAI. */
export async function fornitoreFinto(gestore: Gestore): Promise<{ url: string; chiuso: () => void; richieste: { modello: string; testo: string }[] }> {
  const richieste: { modello: string; testo: string }[] = [];
  const server = http.createServer((req, res) => {
    let corpo = "";
    req.on("data", (p) => (corpo += p));
    req.on("end", () => {
      const { messages, model } = JSON.parse(corpo) as { model: string; messages: { role: string; content: string }[] };
      const testo = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
      richieste.push({ modello: model, testo });
      if (req.headers.authorization !== `Bearer ${CHIAVE_FINTA}`) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "chiave sbagliata" } }));
        return;
      }
      const r = gestore({ modello: model, testo, messaggi: messages });
      if (r.stato && r.stato !== 200) {
        res.writeHead(r.stato, { "Content-Type": "application/json" });
        res.end(JSON.stringify([{ error: { code: r.stato, message: r.stato === 503 ? "This model is currently experiencing high demand." : "errore", status: "UNAVAILABLE" } }]));
        return;
      }
      const contenuto = r.testo ?? JSON.stringify(r.dati);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: contenuto }, finish_reason: r.troncata ? "length" : "stop" }], usage: { prompt_tokens: Math.round(testo.length / 3), completion_tokens: 900 } }));
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}`, chiuso: () => server.close(), richieste };
}

/** Tutti i file di una cartella (per cercare cose che non devono esserci). */
export function tuttiIFile(cartella: string): string[] {
  const risultato: string[] = [];
  const visita = (d: string) => {
    for (const v of fs.readdirSync(d, { withFileTypes: true })) {
      if (v.name === ".git") continue;
      const p = path.join(d, v.name);
      if (v.isDirectory()) visita(p);
      else risultato.push(p);
    }
  };
  visita(cartella);
  return risultato;
}
