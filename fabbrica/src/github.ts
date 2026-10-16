import { CONFIG, nascondiSegreti } from "./configurazione.ts";

// Le segnalazioni del repository (issues), usate in due modi:
// - leggere le segnalazioni sulle lezioni scritte DAL PROPRIETARIO (quelle di altri non si leggono mai: nessuno può
//   dettare istruzioni alla fabbrica aprendo una segnalazione);
// - aprirne una quando il corso si ferma e serve un intervento: GitHub la manda per email al proprietario.

export type Segnalazione = { numero: number; titolo: string; corpo: string; etichette: string[]; autore: string; url: string };

async function api(percorso: string, opzioni: { metodo?: string; corpo?: unknown } = {}): Promise<unknown> {
  const { token, repository } = CONFIG.github;
  if (!token || !repository) throw new Error("GITHUB_TOKEN o GITHUB_REPOSITORY mancanti");
  const risposta = await fetch(`https://api.github.com/repos/${repository}${percorso}`, {
    method: opzioni.metodo ?? "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "how-to-develop-fabbrica" },
    body: opzioni.corpo ? JSON.stringify(opzioni.corpo) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!risposta.ok) throw new Error(`GitHub ${percorso}: HTTP ${risposta.status} ${nascondiSegreti((await risposta.text()).slice(0, 200))}`);
  return risposta.status === 204 ? null : risposta.json();
}

export function githubDisponibile(): boolean {
  return Boolean(CONFIG.github.token && CONFIG.github.repository && CONFIG.github.proprietario);
}

/** Le segnalazioni aperte con l'etichetta «segnalazione», scritte dal proprietario del repository. */
export async function segnalazioniAperte(): Promise<Segnalazione[]> {
  if (!githubDisponibile()) return [];
  const voci = (await api("/issues?state=open&labels=segnalazione&per_page=20")) as {
    number: number;
    title: string;
    body: string | null;
    labels: { name: string }[];
    user: { login: string };
    author_association: string;
    html_url: string;
    pull_request?: unknown;
  }[];
  return voci
    .filter((v) => !v.pull_request && v.author_association === "OWNER" && v.user.login.toLowerCase() === CONFIG.github.proprietario!.toLowerCase())
    .map((v) => ({ numero: v.number, titolo: v.title.slice(0, 300), corpo: (v.body ?? "").slice(0, 6000), etichette: v.labels.map((l) => l.name), autore: v.user.login, url: v.html_url }));
}

export async function commenta(numero: number, testo: string, chiudi = false): Promise<void> {
  if (!githubDisponibile()) return;
  await api(`/issues/${numero}/comments`, { metodo: "POST", corpo: { body: nascondiSegreti(testo).slice(0, 60000) } });
  if (chiudi) await api(`/issues/${numero}`, { metodo: "PATCH", corpo: { state: "closed", state_reason: "completed" } });
}

export async function aggiungiEtichetta(numero: number, etichetta: string): Promise<void> {
  if (!githubDisponibile()) return;
  await api(`/issues/${numero}/labels`, { metodo: "POST", corpo: { labels: [etichetta] } });
}

/** Apre una segnalazione per avvisare il proprietario. Restituisce il numero, o null se GitHub non è raggiungibile. */
export async function apriSegnalazione(titolo: string, testo: string, etichetta = "fabbrica-ferma"): Promise<number | null> {
  if (!githubDisponibile()) return null;
  try {
    const r = (await api("/issues", { metodo: "POST", corpo: { title: nascondiSegreti(titolo).slice(0, 250), body: nascondiSegreti(testo).slice(0, 60000), labels: [etichetta] } })) as { number: number };
    return r.number;
  } catch (errore) {
    console.error(`Segnalazione non aperta: ${(errore as Error).message}`);
    return null;
  }
}
