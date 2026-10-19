import { problemiDelPacco } from "@htd/condiviso/controllo-pacco.ts";
import { verifica } from "@htd/condiviso/godot/verifica.ts";
import { PaccoLezioneSchema, sha256, type PaccoLezione } from "@htd/condiviso/pacchetto.ts";
import { lezioneDelCorso } from "@htd/condiviso/piano.ts";
import type { Esercizio, StatoProgetto } from "@htd/condiviso/schemi.ts";
import type { Ruolo } from "./ai/catalogo.ts";
import { AINonDisponibile, candidati, chiamaAI, dimenticaRisposta, RispostaAINonValida, stimaToken } from "./ai/router.ts";
import { leggiJson, salva, scriviFile, scriviJson } from "./archivio.ts";
import { catalogo, paccoPubblicato, paroleDelleLezioniPrima, testiDellaTeoria, valoriLezione } from "./corso.ts";
import { promemoriaGenere, richiestaCorrezione } from "./lezione/catena.ts";
import { eAvvisoMinoreDi, paroleDi, preparaEsercizio, problemaInstabili, problemaModificheNascoste, problemaNonSpiegato, problemaVerificheFragili, stessiFallimenti, VERIFICHE_FRAGILI } from "./lezione/esercizio.ts";
import { controllaPezzo, statoDopo } from "./lezione/pratica.ts";
import { aggiornaCatalogo } from "./lezione/pubblica.ts";
import { controllaTempo } from "./tempo.ts";
import { costoLezione, registra, type Pezzo } from "./traccia.ts";

// Gli esercizi delle lezioni già pubblicate, ricontrollati come quelli nuovi (vedi «Valori liberi» e «Modifiche nascoste
// e cose non spiegate» in lezione/esercizio.ts). Le lezioni uscite prima del 17 ottobre non passavano da quei controlli:
// la 1.4 bocciava un sottomarino giusto, la 1.11 la sua stessa soluzione a caso, la 1.9 ogni lavoro fatto come diceva la
// consegna (la soluzione cambiava anche rock.gd senza dirlo) e chiedeva `instantiate()` senza averlo spiegato.
// Qui, una lezione alla volta e prima di scriverne di nuove, un esercizio con problemi torna a un modello che corregge
// verifiche e testi; la soluzione resta identica, perché le lezioni successive partono da lì. Il risultato ripassa
// tutti i controlli in Godot e la lezione esce in una versione nuova. I progressi nell'aula restano: sono legati alla
// lezione, non alla versione. Ogni esercizio ha al massimo tre tentativi (i primi due con il modello del ritocco, il
// terzo con uno scrittore); poi resta com'è, con l'avviso nella lezione se era già uscito con problemi minori.

const FILE = "stato/verifiche.json";
const TENTATIVI = 3;

/** Per ogni lezione: la versione ricontrollata, gli esercizi rimasti con problemi e i tentativi di correzione fatti. */
type Ricontrollo = { versione: number; fragili: string[]; tentativi: Record<string, number> };

const SOLO_VERIFICHE =
  "La lezione è già pubblicata e chi studia ci sta lavorando: correggi SOLO il campo `verifiche`. Consegna, passi, suggerimenti e soluzione restano IDENTICI (le lezioni successive partono da questa soluzione). Le verifiche corrette devono continuare a passare sulla soluzione e a fallire sul progetto com'è prima del lavoro.";
const SOLO_TESTI_E_VERIFICHE =
  "La lezione è già pubblicata e chi studia ci sta lavorando: la SOLUZIONE (file e impostazioni) e il progetto di partenza restano IDENTICI, perché le lezioni successive partono da lì. Correggi solo ciò che serve fra `consegna`, `passiGuida`, `suggerimenti` e `verifiche`. Le verifiche devono continuare a passare sulla soluzione e a fallire sul progetto com'è prima del lavoro.";

/** Il progetto com'è prima dell'esercizio: il gioco della fase o il progetto di partenza a parte. */
function baseDi(e: Esercizio, gioco: StatoProgetto | undefined): StatoProgetto {
  if (e.dove === "gioco" && gioco) return gioco;
  return { nome: e.titolo, cartella: e.cartella ?? "progetto", file: e.partenza?.file ?? [], progetto: e.partenza?.progetto ?? { nome: e.titolo, scenaPrincipale: "", azioni: [], autoload: [], impostazioni: [] } };
}

/** Il ruolo del modello per il tentativo n (da 0): Godot giudica, quindi prima il modello con molte richieste. */
const ruoloDelTentativo = (n: number): Ruolo => (n < 2 ? "ritocco" : "scrittore");

/** Vero se i problemi si correggono solo nelle verifiche (fragili); altrimenti serve anche la consegna. */
const soloNelleVerifiche = (problemi: string[]) => problemi.every((p) => p.startsWith(VERIFICHE_FRAGILI));

type EsitoCorrezione = { esercizio: Esercizio } | { fallito: string } | { attesa: true };

/** Un tentativo di correggere un esercizio pubblicato: verifiche, e se serve consegna, passi e suggerimenti. */
async function correggiPubblicato(slug: string, valori: Record<string, string>, e: Esercizio, base: StatoProgetto, conosciute: Set<string>, problemi: string[], tentativo: number): Promise<EsitoCorrezione> {
  const ruolo = ruoloDelTentativo(tentativo);
  const anzicheTesti = soloNelleVerifiche(problemi);
  const richiesta = { ...richiestaCorrezione(valori, e, [promemoriaGenere(e), anzicheTesti ? SOLO_VERIFICHE : SOLO_TESTI_E_VERIFICHE, ...problemi]), ruolo, slug };
  // Nessun modello libero per questo ruolo: non si bussa, si riprova al giro dopo.
  if (candidati(ruolo, { tokenStimati: stimaToken(richiesta.messaggi) + (richiesta.maxTokens ?? 4000), escludi: [] }).disponibili.length === 0) return { attesa: true };
  const dalle = Date.now();
  const titolo = `${e.id === "test" ? "Test" : `Esercizio ${e.id?.replace("es", "")}`}: correzione della lezione pubblicata, ${tentativo + 1} di ${TENTATIVI}`;
  let risposta;
  try {
    risposta = await chiamaAI(richiesta);
  } catch (errore) {
    if (errore instanceof AINonDisponibile) {
      registra({ slug, pezzo: e.id as Pezzo, azione: "verifiche robuste", esito: "attesa", guasto: "fornitore", dalle, titolo, spiegazione: `${errore.message.slice(0, 400)}\nReazione: si riprova al prossimo giro.` });
      return { attesa: true };
    }
    if (errore instanceof RispostaAINonValida) return { fallito: `risposta non nel formato chiesto: ${errore.message.slice(0, 300)}` };
    throw errore;
  }
  // Usata la risposta, non serve più conservarla: se non va bene, il tentativo dopo deve chiederne una nuova.
  dimenticaRisposta(richiesta);
  let candidato: Esercizio;
  try {
    const nuovo = preparaEsercizio(risposta.dati, e.id ?? "es1", e.tipo);
    // Soluzione, partenza, titolo e genere restano quelli pubblicati; passi e suggerimenti seguono le regole del genere.
    candidato = anzicheTesti
      ? { ...e, verifiche: nuovo.verifiche }
      : { ...e, verifiche: nuovo.verifiche, consegna: nuovo.consegna, passiGuida: e.genere === "guidato" ? nuovo.passiGuida : [], suggerimenti: e.genere === "guidato" ? [] : nuovo.suggerimenti.slice(0, e.tipo === "test" ? 1 : 3) };
  } catch (errore) {
    return { fallito: `esercizio illeggibile: ${(errore as Error).message.slice(0, 300)}` };
  }
  const controllo = await controllaPezzo(candidato, base, { conosciute, pubblicata: true });
  registra({
    slug,
    pezzo: e.id as Pezzo,
    azione: "verifiche robuste",
    esito: controllo.problemi.length ? "fallito" : "ok",
    guasto: controllo.problemi.length ? "contenuto" : undefined,
    modello: risposta.modello,
    dalle,
    titolo,
    spiegazione: controllo.problemi.length
      ? `La correzione di ${risposta.modello} non supera i controlli:\n${controllo.problemi.map((p) => `- ${p.slice(0, 700)}`).join("\n")}\nReazione: ${tentativo + 1 < TENTATIVI ? "si riprova al prossimo giro." : "tentativi finiti, l'esercizio resta com'era."}`
      : `La correzione di ${risposta.modello} supera tutti i controlli: le verifiche passano due volte sulla soluzione e sulla sua variante con i valori liberi dimezzati, falliscono sul lavoro non fatto, e ${anzicheTesti ? "consegna e soluzione non cambiano" : "la consegna dice ciò che serve; la soluzione non cambia"}.`,
    dati: { problemi: controllo.problemi, verifiche: candidato.verifiche, consegna: candidato.consegna },
  });
  return controllo.problemi.length ? { fallito: controllo.problemi[0].slice(0, 300) } : { esercizio: controllo.esercizio };
}

/** Il segno di una soluzione pubblicata che fallisce sempre allo stesso modo: il guasto non è nell'esercizio. */
const GUASTO_ALTROVE = "guasto altrove";

/**
 * I problemi di un esercizio pubblicato (vuoto se non ne ha). La soluzione gira due volte (deve passare entrambe),
 * poi la variante lecita e quella letterale; in più le funzioni non spiegate. Se la soluzione fallisce due volte allo
 * stesso modo il guasto è altrove (Godot, la macchina): si registra, conta come tentativo, e una correzione non si chiede.
 */
async function problemiDelPubblicato(slug: string, e: Esercizio, base: StatoProgetto, conosciute: Set<string>, tentativi: Record<string, number>): Promise<string[] | typeof GUASTO_ALTROVE> {
  if (e.modalita !== "progetto" && e.modalita !== "codice") return [];
  const problemi: string[] = [];
  if (e.verifiche.some((v) => v.tipo === "script_godot" || v.tipo === "testo_in_file")) {
    const sorgente = { tipo: "file" as const, file: e.soluzione.file, daLezione: true };
    const primo = await verifica(sorgente, e.verifiche);
    if (primo.superato) {
      const fragili = await problemaVerificheFragili(e, { soloVerifiche: true });
      if (fragili) problemi.push(fragili);
    } else {
      const secondo = await verifica(sorgente, e.verifiche);
      if (!secondo.superato && stessiFallimenti(primo.controlli, secondo.controlli)) {
        tentativi[e.id!] = (tentativi[e.id!] ?? 0) + 1;
        registra({ slug, pezzo: e.id as Pezzo, azione: "verifiche robuste", esito: "fallito", guasto: "piattaforma", titolo: "La soluzione pubblicata non supera più le sue verifiche", spiegazione: `Ricontrollando l'esercizio, la soluzione di riferimento fallisce le verifiche due volte allo stesso modo:\n${primo.controlli.filter((c) => !c.superato).map((c) => `- ${c.descrizione}${c.dettaglio ? `: ${c.dettaglio.slice(0, 300)}` : ""}`).join("\n")}\nReazione: nessuna richiesta a un modello (il guasto non è nell'esercizio); conta come tentativo, e dopo ${TENTATIVI} l'esercizio non viene più ricontrollato.` });
        return GUASTO_ALTROVE;
      }
      problemi.push(problemaInstabili(primo.controlli));
    }
  }
  const nascoste = await problemaModificheNascoste(e, base.file, true);
  if (nascoste) problemi.push(nascoste);
  const nonSpiegato = problemaNonSpiegato(e, conosciute, base.file, true);
  if (nonSpiegato) problemi.push(nonSpiegato);
  return problemi;
}

/** Scrive la versione nuova di una lezione in cui cambiano solo gli esercizi corretti (e i loro avvisi). */
async function pubblicaCorrezioni(pacco: PaccoLezione, nuovi: Esercizio[], corretti: string[]): Promise<PaccoLezione | null> {
  const titoli = nuovi.filter((e) => corretti.includes(e.id!)).map((e) => e.titolo);
  const avvisi = (pacco.contenuto.avvisi ?? []).filter((a) => !titoli.some((t) => eAvvisoMinoreDi(t, a)));
  const contenuto = { ...pacco.contenuto, esercizi: nuovi.filter((e) => e.id !== "test"), test: nuovi.find((e) => e.id === "test")!, avvisi: avvisi.length ? avvisi : undefined };
  const nuovo = PaccoLezioneSchema.parse({ ...pacco, versione: pacco.versione + 1, contenuto, origine: { ...pacco.origine, richieste: costoLezione(pacco.slug) } });
  const sicurezza = problemiDelPacco(nuovo);
  if (sicurezza.length) {
    registra({ slug: pacco.slug, pezzo: "lezione", azione: "verifiche robuste", esito: "fallito", guasto: "contenuto", titolo: "Correzioni rifiutate dal controllo di sicurezza", spiegazione: `${sicurezza.slice(0, 5).join(" | ")}\nReazione: la lezione resta com'era.` });
    return null;
  }
  const voce = catalogo().lezioni.find((l) => l.slug === pacco.slug)!;
  const testo = JSON.stringify(nuovo);
  scriviFile(voce.file, testo);
  aggiornaCatalogo({ ...voce, versione: nuovo.versione, sha256: sha256(testo), byte: Buffer.byteLength(testo) });
  registra({ slug: pacco.slug, pezzo: "lezione", azione: "verifiche robuste", esito: "ok", titolo: "Esercizi corretti nella lezione pubblicata", spiegazione: `Corretti ${corretti.join(", ")}: verifiche che accettano ogni lavoro giusto, consegne che dicono tutto ciò che serve. Teoria e soluzioni non cambiano. Versione ${nuovo.versione}.` });
  return nuovo;
}

/**
 * Ricontrolla gli esercizi delle lezioni pubblicate non ancora ricontrollate in questa versione e corregge quelli con
 * problemi. Si ferma (e riprende al giro dopo) quando il modello che serve non è libero. Restituisce quante lezioni
 * sono uscite in una versione nuova.
 */
export async function rendiRobusteLeVerifiche(): Promise<number> {
  const registro = leggiJson<Record<string, Ricontrollo>>(FILE, {});
  let pubblicate = 0;
  for (const voce of catalogo().lezioni) {
    const prima = registro[voce.slug];
    if (prima?.versione === voce.versione && prima.fragili.every((id) => (prima.tentativi[id] ?? 0) >= TENTATIVI)) continue;
    const pacco = paccoPubblicato(voce.slug);
    const lezione = lezioneDelCorso(voce.slug);
    if (!pacco || !lezione) continue;
    controllaTempo();
    const valori = valoriLezione(lezione);
    const conosciute = new Set([...paroleDelleLezioniPrima(lezione), ...paroleDi(...testiDellaTeoria(pacco.contenuto.blocchi))]);
    const tentativi = { ...(prima?.tentativi ?? {}) };
    const fragili: string[] = [];
    const corretti: string[] = [];
    const nuovi: Esercizio[] = [];
    let gioco = pacco.contenuto.statoIniziale;
    let fermati = false;
    for (const e of [...pacco.contenuto.esercizi, pacco.contenuto.test]) {
      let finale = e;
      const id = e.id!;
      const base = baseDi(e, gioco);
      // Tentativi finiti, o fermati a metà: non si ricontrolla, e resta con problemi ciò che li aveva.
      const saltato = fermati || (tentativi[id] ?? 0) >= TENTATIVI;
      const problemi = saltato ? [] : await problemiDelPubblicato(voce.slug, e, base, conosciute, tentativi);
      if ((saltato && prima?.fragili.includes(id)) || problemi === GUASTO_ALTROVE) {
        fragili.push(id);
      } else if (problemi.length) {
        const esito = await correggiPubblicato(voce.slug, valori, e, base, conosciute, problemi, tentativi[id] ?? 0);
        if ("attesa" in esito) {
          fermati = true;
          fragili.push(id);
        } else if ("esercizio" in esito) {
          finale = esito.esercizio;
          corretti.push(id);
        } else {
          tentativi[id] = (tentativi[id] ?? 0) + 1;
          fragili.push(id);
        }
      }
      nuovi.push(finale);
      if (gioco) gioco = statoDopo(gioco, finale);
    }
    let versione = voce.versione;
    if (corretti.length) {
      const nuovo = await pubblicaCorrezioni(pacco, nuovi, corretti);
      if (nuovo) {
        versione = nuovo.versione;
        pubblicate++;
      } else {
        fragili.push(...corretti);
      }
    }
    // Fermati a metà (nessun modello libero): la lezione si ricontrolla tutta al giro dopo. Il registro si salva con il
    // resto alla fine del giro; una lezione corretta invece si salva e si spinge subito.
    registro[voce.slug] = { versione: fermati ? -1 : versione, fragili: [...new Set(fragili)], tentativi };
    scriviJson(FILE, registro);
    if (corretti.length) await salva(`${voce.numero} ${voce.slug}: esercizi corretti (versione ${versione})`, { subito: true });
    if (fermati) return pubblicate;
  }
  return pubblicate;
}

