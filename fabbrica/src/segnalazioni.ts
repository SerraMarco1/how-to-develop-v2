import { z } from "zod";
import { lezioneDelCorso, lezioniDelCorso } from "@htd/condiviso/piano.ts";
import { RevisioneSchema, SpiegazioneSchema, type Esercizio, type StatoProgetto } from "@htd/condiviso/schemi.ts";
import { messaggi } from "./ai/prompt.ts";
import { AINonDisponibile, chiamaAI } from "./ai/router.ts";
import { GiroFinito } from "./tempo.ts";
import { leggiJson, salva, scriviJson } from "./archivio.ts";
import { paccoPubblicato, valoriLezione } from "./corso.ts";
import { aggiungiEtichetta, commenta, segnalazioniAperte, type Segnalazione } from "./github.ts";
import { correggiEsercizio, normalizzaLezione } from "./lezione/catena.ts";
import { controllaPezzo, statoDopo } from "./lezione/pratica.ts";
import { pubblicaLezione } from "./lezione/pubblica.ts";
import { controllaTeoria } from "./lezione/qualita.ts";
import { registra } from "./traccia.ts";

// Le segnalazioni scritte dal proprietario nella pagina di GitHub (modulo «Segnala un problema», aperto dall'aula).
// Per ognuna: un revisore legge il punto segnalato; se c'è davvero un errore, il pezzo viene corretto e ricontrollato
// come durante la scrittura, e la lezione esce in una versione nuova. La risposta va nella segnalazione stessa.

const SegnalazioneSchema = z.object({ errore: z.boolean(), risposta: z.string().default(""), problemi: RevisioneSchema.shape.problemi });

/** Il contenuto del modulo: le sezioni «### Lezione», «### Dove», «### Cosa non va». */
export function leggiModulo(corpo: string): { lezione: string; dove: string; problema: string } {
  const sezione = (titolo: string) => corpo.match(new RegExp(`###\\s*${titolo}\\s*\\n+([\\s\\S]*?)(?=\\n###|$)`, "i"))?.[1]?.trim().replace(/^_No response_$/i, "") ?? "";
  return { lezione: sezione("Lezione"), dove: sezione("Dove"), problema: sezione("Cosa non va") };
}

const FILE_GESTITE = "stato/segnalazioni.json";

/** Gestisce le segnalazioni aperte. Un errore su una segnalazione non ferma le altre né la scrittura delle lezioni. */
export async function gestisciSegnalazioni(): Promise<void> {
  let aperte: Segnalazione[];
  try {
    aperte = await segnalazioniAperte();
  } catch (errore) {
    console.error(`Segnalazioni non lette: ${(errore as Error).message}`);
    return;
  }
  const gestite = leggiJson<Record<string, string>>(FILE_GESTITE, {});
  for (const s of aperte) {
    if (gestite[s.numero]) continue;
    try {
      const esito = await gestisci(s);
      gestite[s.numero] = esito;
      scriviJson(FILE_GESTITE, gestite);
      await salva(`segnalazione #${s.numero}: ${esito}`, { subito: true });
    } catch (errore) {
      console.error(`Segnalazione #${s.numero}: ${(errore as Error).message}`);
      // Fornitore che non risponde o tempo finito: la segnalazione resta da gestire al prossimo giro.
      if (errore instanceof GiroFinito || errore instanceof AINonDisponibile) return;
      gestite[s.numero] = "errore";
      scriviJson(FILE_GESTITE, gestite);
      await commenta(s.numero, `La fabbrica non è riuscita a gestire questa segnalazione: ${(errore as Error).message.slice(0, 500)}`).catch(() => {});
    }
  }
}

async function gestisci(s: Segnalazione): Promise<string> {
  const modulo = leggiModulo(s.corpo);
  const voce = lezioniDelCorso().find((l) => l.slug === modulo.lezione || modulo.lezione.startsWith(`${l.numero} `) || modulo.lezione === l.numero);
  const pacco = voce ? paccoPubblicato(voce.slug) : null;
  if (!voce || !pacco) {
    await commenta(s.numero, `Non trovo la lezione «${modulo.lezione}» tra quelle pubblicate. Scrivi nel campo Lezione il numero e il nome (per esempio «1.7 numeri-casuali-e-distanze»).`);
    return "lezione non trovata";
  }
  const valori = valoriLezione(voce);
  const { dati } = await chiamaAI({
    ruolo: "revisore",
    slug: voce.slug,
    messaggi: messaggi("segnalazione", { ...valori, dove: modulo.dove || "lezione in generale", messaggio: modulo.problema || s.titolo, spiegazione: JSON.stringify({ titolo: pacco.contenuto.titolo, blocchi: pacco.contenuto.blocchi, esercizi: [...pacco.contenuto.esercizi, pacco.contenuto.test].map((e) => ({ id: e.id, titolo: e.titolo, consegna: e.consegna, passiGuida: e.passiGuida, suggerimenti: e.suggerimenti })) }).slice(0, 30000) }),
    schema: SegnalazioneSchema,
    maxTokens: 3000,
  });
  if (!dati.errore || dati.problemi.length === 0) {
    await commenta(s.numero, `${dati.risposta || "Il punto segnalato risulta corretto."}\n\n_Risposta della fabbrica dopo una revisione. Se non ti convince, riapri la segnalazione e spiega meglio._`, true);
    registra({ slug: voce.slug, pezzo: "lezione", azione: "segnalazione", esito: "ok", titolo: `Segnalazione #${s.numero}: nessun errore`, spiegazione: dati.risposta });
    return "nessun errore";
  }

  const elenco = (parte: string) => dati.problemi.filter((p) => p.parte === parte).map((p) => `[${p.dove}] ${p.problema} → ${p.correzione}`);
  const { esercizi, test, avvisi, statoIniziale: _si, ...spiegazioneOriginale } = pacco.contenuto;
  let spiegazione = spiegazioneOriginale;
  const fatte: string[] = [];
  if (elenco("spiegazione").length) {
    const r = await chiamaAI({ ruolo: "scrittore", slug: voce.slug, messaggi: messaggi("correzione", { ...valori, problemi: elenco("spiegazione").join("\n"), contenuto: JSON.stringify(spiegazione) }), schema: SpiegazioneSchema, maxTokens: 9000 });
    const dopo = controllaTeoria(r.dati);
    if (dopo.problemi.length <= controllaTeoria(spiegazione).problemi.length) {
      spiegazione = { ...dopo.spiegazione };
      fatte.push("teoria corretta");
    }
  }

  // Gli esercizi: si corregge solo quello indicato, e la correzione vale solo se ripassa i controlli in Godot. Un
  // esercizio che fa crescere il gioco si tocca solo se nessuna lezione successiva è già partita dal suo risultato.
  const successivaPubblicata = lezioniDelCorso().some((l) => l.fase.slug === voce.fase.slug && l.posizione > voce.posizione && (l.tipo === "progetto") === (voce.tipo === "progetto") && paccoPubblicato(l.slug));
  const catena = [...esercizi, test];
  let stato: StatoProgetto | undefined = pacco.contenuto.statoIniziale;
  const nuovi: Esercizio[] = [];
  const nonToccati: string[] = [];
  for (const e of catena) {
    const base = e.dove === "gioco" && stato ? stato : { nome: e.titolo, cartella: e.cartella ?? "progetto", file: e.partenza?.file ?? [], progetto: e.partenza?.progetto ?? { nome: e.titolo, scenaPrincipale: "", azioni: [], autoload: [], impostazioni: [] } };
    const suoi = dati.problemi.filter((p) => p.parte === "pratica" && p.dove.toLowerCase().replace(/\s+/g, "").includes(e.id ?? "?")).map((p) => `${p.problema} → ${p.correzione}`);
    let finale = e;
    if (suoi.length && e.dove === "gioco" && successivaPubblicata) nonToccati.push(e.id!);
    else if (suoi.length) {
      const { esercizio } = await correggiEsercizio(voce.slug, valori, e, suoi);
      const controllo = await controllaPezzo({ ...esercizio, genere: e.genere, dove: e.dove }, base);
      if (controllo.problemi.length === 0) {
        finale = controllo.esercizio;
        fatte.push(`${e.id} corretto`);
      }
    }
    nuovi.push(finale);
    if (stato) stato = statoDopo(stato, finale);
  }
  const contenuto = normalizzaLezione(spiegazione as Parameters<typeof normalizzaLezione>[0], { esercizi: nuovi.filter((e) => e.id !== "test"), test: nuovi.find((e) => e.id === "test")! }, avvisi ?? []);
  if (pacco.contenuto.statoIniziale) contenuto.statoIniziale = pacco.contenuto.statoIniziale;
  const statoFinale = stato ?? pacco.statoFinale;
  if (fatte.length) {
    const nuovo = await pubblicaLezione(voce, { lezione: contenuto, statoFinale: statoFinale!, modelli: pacco.origine.modelli }, { ripasso: pacco.ripasso });
    await commenta(s.numero, `${dati.risposta || "Grazie: l'errore è stato corretto."}\n\nModifiche: ${fatte.join(", ")}. La lezione è ora alla versione ${nuovo.versione}: l'aula la scarica da sola.${nonToccati.length ? `\n\nNon ho toccato ${nonToccati.join(", ")}: ${nonToccati.length === 1 ? "fa" : "fanno"} crescere il gioco e le lezioni successive sono già partite dal suo risultato.` : ""}`, true);
    return `corretta (versione ${nuovo.versione})`;
  }
  await aggiungiEtichetta(s.numero, "da-decidere").catch(() => {});
  await commenta(s.numero, `Il revisore conferma il problema (${dati.problemi.map((p) => p.problema).join("; ").slice(0, 800)}), ma la correzione automatica non ha superato i controlli${nonToccati.length ? ` o riguarda esercizi che fanno crescere il gioco (${nonToccati.join(", ")}), da cui sono già partite le lezioni successive` : ""}. La segnalazione resta aperta per un intervento.`);
  return "da decidere";
}

export { lezioneDelCorso };
