import path from "node:path";
import { impostaGodot } from "@htd/condiviso/godot/esegui.ts";
import { installaGodot } from "@htd/condiviso/godot/installa.ts";
import { impostaCartellaTemporanea } from "@htd/condiviso/godot/verifica.ts";
import { impostaCartellaMotore } from "@htd/condiviso/motore.ts";
import { spingi } from "./archivio.ts";
import { CONFIG } from "./configurazione.ts";
import { preparaDocumentazione } from "./documentazione.ts";
import { provaScrittore } from "./lezione/prova-scrittura.ts";
import { cominciaGiro } from "./tempo.ts";

// La prova di scrittura di un modello nuovo, lanciata a mano (workflow «Prova di uno scrittore»):
//   node prova-scrittore.mjs <fornitore/modello>
// Vedi lezione/prova-scrittura.ts.

const candidato = process.argv[2] ?? "";
const log = (m: string) => console.log(`[prova ${candidato}] ${m}`);

async function avvia(): Promise<void> {
  cominciaGiro(CONFIG.minutiGiro);
  impostaCartellaMotore(CONFIG.motore);
  impostaCartellaTemporanea(path.join(CONFIG.cache, "temp"));
  impostaGodot(await installaGodot(path.join(CONFIG.cache, "strumenti"), log));
  await preparaDocumentazione(log);
  await provaScrittore(candidato);
  await spingi();
}

avvia().then(
  () => process.exit(0),
  (errore) => {
    console.error(`Prova interrotta: ${(errore as Error).stack ?? errore}`);
    process.exit(1);
  },
);
