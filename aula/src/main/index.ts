import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, Menu, net, protocol, session, shell } from "electron";
import { impostaCartellaTemporanea, impostaControlliAmbiente } from "@htd/condiviso/godot/verifica.ts";
import { impostaCartellaMotore } from "@htd/condiviso/motore.ts";
import { preparaAggiornamenti } from "./aggiornamenti.ts";
import { controlliAmbiente } from "./ambiente.ts";
import { apriDatabase, database } from "./db.ts";
import { preparaGodot } from "./godot.ts";
import { avvisaFinestra, impostaFinestra, registraCanali } from "./ipc.ts";
import { cartellaDati, PERCORSI, preparaCartelle } from "./percorsi.ts";
import { apriDocumentazioneLocale, sincronizza } from "./sincronizza.ts";

// L'avvio dell'aula. La finestra è chiusa in una gabbia: niente Node, sandbox di Chromium, contenuti solo dal programma
// stesso (protocollo htd://), nessuna navigazione verso l'esterno, nessun permesso (fotocamera, microfono, posizione…).

const SCHEMA = "htd";
// Solo durante lo sviluppo (mai nel programma installato): le prove usano una cartella dati tutta loro.
if (!app.isPackaged && process.env.HTD_DATI_AULA) app.setPath("userData", process.env.HTD_DATI_AULA);
protocol.registerSchemesAsPrivileged([{ scheme: SCHEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
app.enableSandbox();

const POLITICA_CONTENUTI = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' htd: data:",
  "media-src htd:",
  "font-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

const TIPI: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const cartellaFinestra = () => path.join(app.getAppPath(), "out", "renderer");

/** Il protocollo htd://: htd://app/<file> serve la finestra, htd://media/<impronta>.<ext> i file delle lezioni. */
function registraProtocollo(): void {
  protocol.handle(SCHEMA, async (richiesta) => {
    const url = new URL(richiesta.url);
    let file: string | null = null;
    if (url.host === "app") {
      const base = cartellaFinestra();
      const relativo = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const completo = path.resolve(base, `.${relativo}`);
      if (completo.startsWith(base + path.sep)) file = completo;
    } else if (url.host === "media") {
      const nome = url.pathname.slice(1);
      if (/^[0-9a-f]{64}\.[a-z0-9]{2,5}$/.test(nome)) file = path.join(PERCORSI.media, nome);
    }
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Non trovato", { status: 404 });
    const tipo = TIPI[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    const risposta = await net.fetch(pathToFileURL(file).href, { headers: richiesta.headers });
    const intestazioni = new Headers(risposta.headers);
    intestazioni.set("Content-Type", tipo);
    intestazioni.set("X-Content-Type-Options", "nosniff");
    if (tipo.startsWith("text/html")) intestazioni.set("Content-Security-Policy", POLITICA_CONTENUTI);
    return new Response(risposta.body, { status: risposta.status, headers: intestazioni });
  });
}

function blindaContenuti(): void {
  session.defaultSession.setPermissionRequestHandler((_c, _p, rispondi) => rispondi(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  app.on("web-contents-created", (_e, contenuti) => {
    contenuti.on("will-navigate", (evento, url) => {
      if (!url.startsWith(`${SCHEMA}://app/`)) evento.preventDefault();
    });
    contenuti.on("will-redirect", (evento, url) => {
      if (!url.startsWith(`${SCHEMA}://app/`)) evento.preventDefault();
    });
    contenuti.setWindowOpenHandler(() => ({ action: "deny" }));
    contenuti.on("will-attach-webview", (evento) => evento.preventDefault());
  });
}

function creaFinestra(): BrowserWindow {
  const finestra = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "How to Develop",
    backgroundColor: "#f7f6f3",
    show: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), "out", "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  finestra.once("ready-to-show", () => finestra.show());
  void finestra.loadURL(`${SCHEMA}://app/index.html`);
  return finestra;
}

/** Una copia del database al giorno, le ultime 14: un PC che si blocca non può portarsi via i progressi. */
function copiaDiSicurezza(): void {
  const cartella = path.join(cartellaDati(), "copie");
  const oggi = new Date().toISOString().slice(0, 10);
  const file = path.join(cartella, `aula-${oggi}.sqlite`);
  if (fs.existsSync(file)) return;
  try {
    database().exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
    const vecchie = fs.readdirSync(cartella).filter((f) => /^aula-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f)).sort().slice(0, -14);
    for (const f of vecchie) fs.rmSync(path.join(cartella, f), { force: true });
  } catch (errore) {
    console.error(`Copia di sicurezza non riuscita: ${(errore as Error).message}`);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let finestra: BrowserWindow | null = null;
  app.on("second-instance", () => {
    if (!finestra) return;
    if (finestra.isMinimized()) finestra.restore();
    finestra.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    blindaContenuti();
    registraProtocollo();
    preparaCartelle();
    impostaCartellaMotore(PERCORSI.motore);
    impostaCartellaTemporanea(PERCORSI.temporanei);
    impostaControlliAmbiente(controlliAmbiente);
    apriDatabase();
    apriDocumentazioneLocale();
    copiaDiSicurezza();
    registraCanali(app.getVersion());
    finestra = creaFinestra();
    impostaFinestra(finestra);
    preparaAggiornamenti(() => avvisaFinestra("aggiornamento"));
    preparaGodot().catch((e) => console.error(`Godot di servizio non pronto: ${(e as Error).message}`));
    const scarica = () => void sincronizza().then((s) => avvisaFinestra("sincronizzato", s.cambiate));
    scarica();
    setInterval(scarica, 30 * 60_000);
    // Solo durante lo sviluppo: la prova completa dell'aula guida la finestra vera (vedi aula/test/prova-aula.ts).
    if (!app.isPackaged && process.env.HTD_PROVA_AULA) {
      const prova = finestra;
      void import(pathToFileURL(process.env.HTD_PROVA_AULA).href).then((m: { esegui: (f: BrowserWindow) => Promise<number> }) => m.esegui(prova)).then((codice) => app.exit(codice), (e) => (console.error(e), app.exit(1)));
    }
  });
  app.on("window-all-closed", () => app.quit());
}

export { shell };
