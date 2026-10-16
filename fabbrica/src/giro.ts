import fs from "node:fs";
import path from "node:path";
import { impostaGodot } from "@htd/condiviso/godot/esegui.ts";
import { installaGodot } from "@htd/condiviso/godot/installa.ts";
import { impostaCartellaTemporanea } from "@htd/condiviso/godot/verifica.ts";
import { impostaCartellaMotore, infoMotore } from "@htd/condiviso/motore.ts";
import { problemiDelPiano } from "@htd/condiviso/piano.ts";
import { AINonDisponibile } from "./ai/router.ts";
import { salva, spingi } from "./archivio.ts";
import { CONFIG } from "./configurazione.ts";
import { prossimaLezione } from "./corso.ts";
import { indiceCompresso, preparaDocumentazione } from "./documentazione.ts";
import { apriSegnalazione, commenta } from "./github.ts";
import { esisteCantiere, LezioneTrattenuta, riapriCantiere, scriviLezione } from "./lezione/catena.ts";
import { pubblicaIndiceDocumentazione, pubblicaLezione } from "./lezione/pubblica.ts";
import { scriviStatoPubblico } from "./pubblico.ts";
import { importataDa, ricontrollaImportata } from "./ricontrollo.ts";
import { gestisciSegnalazioni } from "./segnalazioni.ts";
import { aggiornaStato, statoFabbrica } from "./stato.ts";
import { cominciaGiro, GiroFinito } from "./tempo.ts";
import { registra } from "./traccia.ts";

// Un giro della fabbrica: lo lancia GitHub Actions ogni 15 minuti (uno alla volta), oppure a mano.
//
//   node giro.mjs                 un giro normale
//   node giro.mjs --riprova       il corso era fermo su una lezione: si riapre il suo cantiere e si riprova
//   node giro.mjs --solo-prepara  prepara Godot e la documentazione, senza scrivere niente (per provare l'ambiente)
//
// Codice di uscita: 0 se il giro è andato come previsto (anche se ha solo aspettato), 1 se si è rotto qualcosa nella
// piattaforma: GitHub lo segna in rosso e manda un'email al proprietario.

const argomenti = new Set(process.argv.slice(2));
const ora = () => new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
const log = (m: string) => console.log(`[${ora()}] ${m}`);

/** Perché la fabbrica aspetta, detto a chi studia (senza i dettagli tecnici, che stanno nelle tracce). */
function attesaInParole(messaggio: string, numero: string): string {
  if (/Nessun modello configurato/.test(messaggio)) return `Non può ancora scrivere la lezione ${numero}: manca la chiave di un fornitore.`;
  if (/richieste gratuite di oggi/.test(messaggio)) return `Le richieste gratuite di oggi sono finite: la lezione ${numero} riprende quando si azzerano.`;
  return `I modelli gratuiti sono sovraccarichi: la lezione ${numero} riprende da sola appena rispondono.`;
}

/** Un errore dell'archivio o della rete verso GitHub: non è colpa della lezione, il giro dopo riprova. */
function eDelleRetrovie(errore: unknown): boolean {
  return /spingere il ramo corso|GitHub|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|Download di Godot|Documentazione/i.test((errore as Error)?.message ?? "");
}

async function fermaIlCorso(slug: string, motivo: "contenuto" | "formato" | "piattaforma", messaggio: string, lezioneTitolo: string): Promise<void> {
  const titolo = `La fabbrica è ferma sulla lezione ${lezioneTitolo}`;
  const testo = [
    `La fabbrica si è fermata sulla lezione **${lezioneTitolo}** (\`${slug}\`) e non scrive le successive finché qualcuno non interviene.`,
    "",
    `**Perché** (${motivo === "piattaforma" ? "errore del programma" : motivo === "formato" ? "nessun modello rispetta il formato" : "un pezzo non supera i controlli"}): ${messaggio}`,
    "",
    `Il racconto completo è in \`tracce/${slug}/registro.jsonl\` sul ramo \`corso\`.`,
    "",
    "Per ripartire, dopo aver sistemato la causa: Actions → Fabbrica → Run workflow, con «riprova» attivo.",
  ].join("\n");
  const numero = await apriSegnalazione(titolo, testo);
  aggiornaStato((s) => {
    s.corsoFermo = { slug, motivo, messaggio: messaggio.slice(0, 2000), dal: new Date().toISOString(), segnalazione: numero ?? undefined };
    s.prossimoTentativo = null;
  });
}

async function giro(): Promise<number> {
  cominciaGiro();
  impostaCartellaMotore(CONFIG.motore);
  fs.mkdirSync(CONFIG.cache, { recursive: true });
  impostaCartellaTemporanea(path.join(CONFIG.cache, "temp"));
  const piano = problemiDelPiano();
  if (piano.length) throw new Error(`Il piano del corso non è coerente: ${piano.join("; ")}`);

  const stato = statoFabbrica();
  if (argomenti.has("--riprova") && stato.corsoFermo) {
    const { slug, segnalazione } = stato.corsoFermo;
    log(`Riprova chiesta: si riapre il cantiere di ${slug}`);
    riapriCantiere(slug);
    aggiornaStato((s) => {
      s.corsoFermo = null;
      s.prossimoTentativo = null;
    });
    registra({ slug, pezzo: "lezione", azione: "riprova", esito: "ok", titolo: "Nuovo tentativo chiesto dal proprietario", spiegazione: "Il lavoro approvato resta nel cantiere; i contatori che avevano fermato la lezione ripartono da zero." });
    if (segnalazione) await commenta(segnalazione, "Riprova avviata: la fabbrica riparte da questa lezione.", true).catch(() => {});
    await salva(`${slug}: riprova chiesta dal proprietario`, { subito: true });
  }
  if (!argomenti.has("--riprova") && stato.prossimoTentativo && Date.now() < stato.prossimoTentativo && !argomenti.has("--solo-prepara")) {
    log(`Niente da fare prima delle ${new Date(stato.prossimoTentativo).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome" })}: nessun modello può rispondere prima.`);
    return 0;
  }

  log("Preparazione di Godot…");
  impostaGodot(await installaGodot(path.join(CONFIG.cache, "strumenti"), log));
  const fileIndice = await preparaDocumentazione(log);
  if (pubblicaIndiceDocumentazione(indiceCompresso(fileIndice), infoMotore().docs.commit)) await salva("indice della documentazione pubblicato", { subito: true });
  if (argomenti.has("--solo-prepara")) {
    log("Ambiente pronto.");
    return 0;
  }

  await gestisciSegnalazioni();

  for (;;) {
    const s = statoFabbrica();
    if (s.corsoFermo) {
      scriviStatoPubblico("ferma", `Si è fermata sulla lezione «${s.corsoFermo.slug}»: serve un intervento${s.corsoFermo.segnalazione ? ` (segnalazione n. ${s.corsoFermo.segnalazione} su GitHub)` : ""}. Le lezioni già pronte restano disponibili.`);
      log(`Corso fermo su ${s.corsoFermo.slug}: ${s.corsoFermo.messaggio}`);
      return 0;
    }
    const lezione = prossimaLezione();
    if (!lezione) {
      scriviStatoPubblico("finito", "Tutte le lezioni del corso sono pronte.");
      log("Tutte le lezioni del corso sono pubblicate.");
      return 0;
    }
    scriviStatoPubblico("lavora", `Sta scrivendo la lezione ${lezione.numero} «${lezione.titolo}».`, lezione);
    log(`Lezione ${lezione.numero} «${lezione.titolo}»`);
    try {
      if (importataDa(lezione.slug)) {
        if (await ricontrollaImportata(lezione)) continue;
      }
      const scritta = await scriviLezione(lezione);
      await pubblicaLezione(lezione, scritta);
      aggiornaStato((x) => void (x.prossimoTentativo = null));
      log(`Lezione ${lezione.numero} pubblicata`);
    } catch (errore) {
      if (errore instanceof GiroFinito) {
        scriviStatoPubblico("lavora", `Sta scrivendo la lezione ${lezione.numero} «${lezione.titolo}»: riprende al prossimo giro.`, lezione);
        log(errore.message);
        return 0;
      }
      if (errore instanceof AINonDisponibile) {
        const riprende = Date.now() + errore.riprovaTraSec * 1000;
        aggiornaStato((x) => void (x.prossimoTentativo = riprende));
        scriviStatoPubblico("aspetta", attesaInParole(errore.message, lezione.numero), lezione, riprende);
        log(`In attesa: ${errore.message}`);
        return 0;
      }
      if (errore instanceof LezioneTrattenuta) {
        if (errore.definitiva) {
          await fermaIlCorso(lezione.slug, /formato/i.test(errore.message) ? "formato" : "contenuto", errore.message, `${lezione.numero} «${lezione.titolo}»`);
          continue;
        }
        const riprende = Date.now() + Math.max(600, errore.riprovaTraSec) * 1000;
        aggiornaStato((x) => void (x.prossimoTentativo = riprende));
        scriviStatoPubblico("aspetta", /tetto/i.test(errore.message) ? `Per oggi la lezione ${lezione.numero} ha usato le richieste che le spettano: riprende domani.` : `La lezione ${lezione.numero} riprende più tardi, da dove era arrivata.`, lezione, riprende);
        log(`Lezione trattenuta: ${errore.message}`);
        return 0;
      }
      if (eDelleRetrovie(errore)) throw errore;
      // Un errore del programma: riprovare consumerebbe richieste per niente. Il corso si ferma qui.
      registra({ slug: lezione.slug, pezzo: "lezione", azione: "errore", esito: "fallito", guasto: "piattaforma", titolo: "Errore del programma", spiegazione: `La scrittura si è interrotta per un errore della piattaforma: ${(errore as Error).message}\nReazione: il lavoro approvato resta nel cantiere. Non si riprova da soli.`, dati: { errore: (errore as Error).stack } });
      await fermaIlCorso(lezione.slug, "piattaforma", (errore as Error).message, `${lezione.numero} «${lezione.titolo}»`);
      await salva(`${lezione.slug}: errore del programma, corso fermo`, { subito: true });
      return 1;
    } finally {
      await salva(`${lezione.numero} ${lezione.slug}: fine del giro`).catch((e) => log(`Salvataggio: ${(e as Error).message}`));
    }
  }
}

giro()
  .then(async (codice) => {
    await salva("fine del giro").catch(() => {});
    await spingi();
    process.exit(codice);
  })
  .catch(async (errore) => {
    console.error(`Giro interrotto: ${(errore as Error).stack ?? errore}`);
    await salva("giro interrotto").catch(() => {});
    await spingi().catch(() => {});
    process.exit(1);
  });

export { esisteCantiere };
