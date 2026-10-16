import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lezioniDelCorso } from "@htd/condiviso/piano.ts";
import { MODELLI, nomeModello } from "../ai/catalogo.ts";
import { AINonDisponibile } from "../ai/router.ts";
import { salva, scriviJson } from "../archivio.ts";
import { chiaveFornitore, CONFIG } from "../configurazione.ts";
import { catalogo } from "../corso.ts";
import { LezioneTrattenuta, scriviLezione } from "./catena.ts";
import { aggiornaStato, dimenticaStato, statoFabbrica, type StatoFabbrica } from "../stato.ts";
import { GiroFinito } from "../tempo.ts";
import { registroDiLezione } from "../traccia.ts";

// La prova di scrittura di un modello nuovo (OpenRouter, NVIDIA…): prima di scrivere lezioni vere, deve riscrivere due
// lezioni già pubblicate, in una COPIA dell'archivio, da solo come scrittore, con gli stessi controlli di sempre.
//
//   node prova-scrittore.mjs <fornitore/modello>
//
// Supera la prova se scrive entrambe le lezioni fino in fondo senza ripieghi (nessun esercizio tolto, test non
// sostituito, teoria approvata dai controlli). Solo allora entra tra gli scrittori approvati (stato/fabbrica.json).
// Il risultato, superato o no, resta in prove/scrittori/ con i numeri: correzioni, richieste, problemi trovati.
// La prova consuma le richieste del modello in prova e poche di Gemini (la revisione), contate come sempre.

type EsitoLezione = { slug: string; numero: string; esito: "superata" | "con-ripieghi" | "fermata" | "non-conclusa"; dettaglio: string; correzioni: number; richieste: number };

export async function provaScrittore(candidato: string): Promise<{ risultato: "approvato" | "non approvato" | "prova non conclusa"; esiti: EsitoLezione[] }> {
  const log = (m: string) => console.log(`[prova ${candidato}] ${m}`);
  const modello = MODELLI.find((m) => nomeModello(m) === candidato);
  if (!modello || !modello.ruoli.includes("scrittore")) throw new Error(`«${candidato}» non è un modello scrittore del catalogo`);
  if (!chiaveFornitore(modello.fornitore)) throw new Error(`Manca la chiave di ${modello.fornitore} nei segreti del repository: la prova non può partire`);

  // Le due lezioni di prova: le ultime due pubblicate che non sono tappe di progetto e partono da un gioco già scritto.
  const pubblicate = new Set(catalogo().lezioni.map((l) => l.slug));
  const scelte = lezioniDelCorso().filter((l) => pubblicate.has(l.slug) && l.tipo !== "progetto" && l.posizione > 0).slice(-2);
  if (scelte.length < 2) throw new Error("Servono almeno due lezioni pubblicate per fare la prova");

  // La copia dell'archivio: la prova non tocca il corso vero.
  const vero = CONFIG.dati;
  const copia = fs.mkdtempSync(path.join(os.tmpdir(), "htd-prova-scrittore-"));
  fs.cpSync(vero, copia, { recursive: true, filter: (p) => !p.split(path.sep).includes(".git") });
  execFileSync("git", ["init", "-q", "-b", "prova"], { cwd: copia });
  CONFIG.dati = copia;
  CONFIG.senzaPush = true;
  dimenticaStato();
  for (const l of scelte) {
    fs.rmSync(path.join(copia, "cantieri", `${l.slug}.json`), { force: true });
    fs.rmSync(path.join(copia, "risposte", l.slug), { recursive: true, force: true });
    fs.rmSync(path.join(copia, "tracce", l.slug), { recursive: true, force: true });
  }
  process.env.HTD_SOLO_SCRITTORE = candidato;

  const esiti: EsitoLezione[] = [];
  // Un errore imprevisto (un difetto del codice, non del modello) ferma la prova, ma solo dopo aver riportato
  // nell'archivio vero le richieste già spese: sono state consumate davvero.
  let imprevisto: unknown;
  for (const l of scelte) {
    log(`Lezione ${l.numero} «${l.titolo}»`);
    let esito: EsitoLezione["esito"];
    let dettaglio = "";
    try {
      const scritta = await scriviLezione(l);
      const avvisi = scritta.lezione.avvisi ?? [];
      esito = avvisi.length ? "con-ripieghi" : "superata";
      dettaglio = avvisi.join(" | ") || `${scritta.lezione.esercizi.length} esercizi e il test approvati in Godot, teoria approvata`;
    } catch (errore) {
      if (errore instanceof LezioneTrattenuta) esito = "fermata";
      else {
        esito = "non-conclusa";
        if (!(errore instanceof AINonDisponibile || errore instanceof GiroFinito)) imprevisto = errore;
      }
      dettaglio = String((errore as Error)?.message ?? errore).slice(0, 600);
    }
    const registro = registroDiLezione(l.slug);
    esiti.push({ slug: l.slug, numero: l.numero, esito, dettaglio, correzioni: registro.filter((r) => r.azione === "correzione").length, richieste: registro.reduce((s, r) => s + r.richieste, 0) });
    log(`${l.numero}: ${esito} — ${dettaglio}`);
    if (esito === "non-conclusa") break;
  }
  delete process.env.HTD_SOLO_SCRITTORE;

  // Lo stato vero dei fornitori (richieste contate, fermi) torna nell'archivio vero; il resto della copia si butta.
  const statoCopia: StatoFabbrica = structuredClone(statoFabbrica());
  const chiamate = path.join(copia, "stato", "chiamate");
  const tracce = Object.fromEntries(esiti.map((e) => [e.slug, registroDiLezione(e.slug)]));
  CONFIG.dati = vero;
  CONFIG.senzaPush = process.env.HTD_SENZA_PUSH === "1";
  dimenticaStato();
  if (fs.existsSync(chiamate)) fs.cpSync(chiamate, path.join(vero, "stato", "chiamate"), { recursive: true });
  const superata = esiti.length === 2 && esiti.every((e) => e.esito === "superata");
  const conclusa = esiti.length === 2 && esiti.every((e) => e.esito !== "non-conclusa");
  aggiornaStato((s) => {
    Object.assign(s, { fermi: statoCopia.fermi, sovraccarico: statoCopia.sovraccarico, rpd: statoCopia.rpd, stessoLimite: statoCopia.stessoLimite, maxToken: statoCopia.maxToken, troncate: statoCopia.troncate });
    if (superata && !s.scrittoriApprovati.includes(candidato)) s.scrittoriApprovati.push(candidato);
  });
  const quando = new Date().toISOString();
  scriviJson(`prove/scrittori/${candidato.replace(/[^\w.-]+/g, "_")}-${quando.slice(0, 16).replace(/[:T]/g, "-")}.json`, { candidato, quando, risultato: superata ? "approvato" : conclusa ? "non approvato" : "prova non conclusa", esiti, tracce });
  await salva(`prova di scrittura di ${candidato}: ${superata ? "approvato" : conclusa ? "non approvato" : "non conclusa"}`, { subito: true });
  fs.rmSync(copia, { recursive: true, force: true });
  if (imprevisto) throw imprevisto;
  log(superata ? "APPROVATO: da ora scrive lezioni insieme agli altri scrittori." : conclusa ? "Non approvato: non scrive lezioni." : "Prova non conclusa (modello non disponibile o tempo finito): riprovare più tardi.");
  return { risultato: superata ? "approvato" : conclusa ? "non approvato" : "prova non conclusa", esiti };
}
