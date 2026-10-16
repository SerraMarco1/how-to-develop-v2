import { problemaPercorso } from "./percorsi.ts";

// Controllo di sicurezza del codice che arriva con una lezione: soluzioni di riferimento, progetti di partenza,
// script di verifica, codice delle previsioni. Lo fa la fabbrica prima di pubblicare (un pezzo che non passa torna al
// modello come ogni altro problema) e lo rifà l'aula prima di eseguire qualcosa in Godot sul tuo PC.
//
// Cosa protegge: il codice di una lezione è scritto da un modello AI. Un modello può sbagliare in modi strani, e la
// documentazione che legge è un testo che non controlliamo noi. Il corso non ha bisogno di comandi di sistema, di rete,
// di file fuori dal progetto o di codice costruito al volo: tutto questo viene rifiutato.
//
// Cosa NON è: un recinto a prova di attaccante. Un controllo che legge il codice si può aggirare da chi lo vuole fare
// apposta (costruendo i nomi pezzo per pezzo). Contro chi volesse alterare le lezioni le difese sono altre: solo il
// proprietario scrive nel repository, e ogni file scaricato deve avere l'impronta scritta nel catalogo.

export type Violazione = { file: string; riga: number; regola: string; spiegazione: string };

/** Estensioni dei file che una lezione può contenere: solo testo che Godot legge come dati o come GDScript. */
const ESTENSIONI_AMMESSE = new Set(["gd", "tscn", "tres", "godot", "cfg", "json", "txt", "md", "csv", "gdshader", "gdshaderinc", "svg", "uid"]);
const MAX_BYTE_FILE = 300 * 1024;
const MAX_BYTE_TOTALI = 3 * 1024 * 1024;
const MAX_FILE = 300;

// ─────────────────────────── Lettura del GDScript ───────────────────────────

export type Letterale = { valore: string; riga: number; /** Dove inizia il segnaposto nel codice ripulito. */ indice: number; prefisso: string };

const ESCAPE_SEMPLICI: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'", "0": "\0", a: "\x07", b: "\b", f: "\f", v: "\v" };

/**
 * Il codice senza commenti, con ogni testo tra virgolette sostituito da un segnaposto `"§n§"`, e i testi decodificati
 * (le sequenze A diventano lettere: un nome non si nasconde così). Le righe restano le stesse dell'originale.
 */
export function analizzaGDScript(codice: string): { pulito: string; letterali: Letterale[] } {
  let pulito = "";
  const letterali: Letterale[] = [];
  let riga = 1;
  let i = 0;
  while (i < codice.length) {
    const c = codice[i];
    if (c === "#") {
      while (i < codice.length && codice[i] !== "\n") i++;
      continue;
    }
    // r"..." (testo senza sequenze di escape), &"..." (StringName), ^"..." (NodePath)
    let prefisso = "";
    let inizio = i;
    if ((c === "r" || c === "&" || c === "^") && (codice[i + 1] === '"' || codice[i + 1] === "'") && !/\w/.test(codice[i - 1] ?? "")) {
      prefisso = c;
      inizio = i + 1;
    }
    const q = codice[inizio];
    if (q === '"' || q === "'") {
      const triplo = codice.startsWith(q.repeat(3), inizio);
      const chiusura = triplo ? q.repeat(3) : q;
      let j = inizio + chiusura.length;
      let valore = "";
      let chiuso = false;
      let accapo = 0;
      const rigaInizio = riga;
      while (j < codice.length) {
        if (codice.startsWith(chiusura, j)) {
          chiuso = true;
          break;
        }
        const x = codice[j];
        if (x === "\n") {
          if (!triplo) break;
          accapo++;
        }
        if (x === "\\" && prefisso !== "r") {
          const dopo = codice[j + 1] ?? "";
          if (dopo === "\n") accapo++;
          if (dopo === "u" && /^[0-9a-fA-F]{4}/.test(codice.slice(j + 2, j + 6))) {
            valore += String.fromCodePoint(parseInt(codice.slice(j + 2, j + 6), 16));
            j += 6;
            continue;
          }
          if (dopo === "U" && /^[0-9a-fA-F]{6}/.test(codice.slice(j + 2, j + 8))) {
            valore += String.fromCodePoint(Math.min(0x10ffff, parseInt(codice.slice(j + 2, j + 8), 16)));
            j += 8;
            continue;
          }
          valore += ESCAPE_SEMPLICI[dopo] ?? dopo;
          j += 2;
          continue;
        }
        valore += x;
        j++;
      }
      letterali.push({ valore, riga: rigaInizio, indice: pulito.length + prefisso.length, prefisso });
      pulito += `${prefisso}"§${letterali.length - 1}§"${"\n".repeat(accapo)}`;
      riga += accapo;
      i = chiuso ? j + chiusura.length : j;
      continue;
    }
    if (c === "\n") riga++;
    pulito += c;
    i++;
  }
  return { pulito, letterali };
}

/** Il numero di riga di ogni posizione del testo (calcolato una volta sola). */
function righe(testo: string): (indice: number) => number {
  const inizi: number[] = [0];
  for (let k = 0; k < testo.length; k++) if (testo[k] === "\n") inizi.push(k + 1);
  return (indice) => {
    let basso = 0;
    let alto = inizi.length - 1;
    while (basso < alto) {
      const medio = (basso + alto + 1) >> 1;
      if (inizi[medio] <= indice) basso = medio;
      else alto = medio - 1;
    }
    return basso + 1;
  };
}

// ─────────────────────────── Regole sul GDScript ───────────────────────────

/** Classi che servono solo per la rete, per eseguire codice scritto in un testo o per caricare estensioni native. */
const CLASSI_VIETATE: Record<string, string> = {
  Expression: "esegue codice scritto in un testo",
  JavaScriptBridge: "esegue codice nel browser",
  JavaScriptObject: "esegue codice nel browser",
  HTTPRequest: "usa la rete",
  HTTPClient: "usa la rete",
  StreamPeerTCP: "usa la rete",
  StreamPeerTLS: "usa la rete",
  TCPServer: "usa la rete",
  UDPServer: "usa la rete",
  PacketPeerUDP: "usa la rete",
  PacketPeerDTLS: "usa la rete",
  DTLSServer: "usa la rete",
  WebSocketPeer: "usa la rete",
  WebSocketMultiplayerPeer: "usa la rete",
  WebRTCPeerConnection: "usa la rete",
  WebRTCDataChannel: "usa la rete",
  WebRTCMultiplayerPeer: "usa la rete",
  ENetConnection: "usa la rete",
  ENetMultiplayerPeer: "usa la rete",
  ENetPacketPeer: "usa la rete",
  IP: "usa la rete",
  GDExtension: "carica librerie native",
  GDExtensionManager: "carica librerie native",
};

/** Le funzioni di `OS` che il corso può usare: informazioni innocue. Tutte le altre (comandi, ambiente, cartelle del PC) sono vietate. */
const OS_AMMESSE = new Set([
  "get_name", "has_feature", "is_debug_build", "get_locale", "get_locale_language", "get_processor_count", "get_processor_name",
  "get_ticks_msec", "get_ticks_usec", "delay_msec", "delay_usec", "is_stdout_verbose", "get_static_memory_usage",
  "get_static_memory_peak_usage", "get_model_name", "get_distribution_name", "get_version", "get_keycode_string",
  "find_keycode_from_string", "is_keycode_unicode", "get_main_thread_id", "get_thread_caller_id", "low_processor_usage_mode",
  "low_processor_usage_mode_sleep_usec", "is_userfs_persistent", "get_unique_id_hash",
]);

/** Nomi che non servono mai a un gioco del corso e danno accesso al sistema, a file del PC o a codice costruito al volo. */
const NOMI_VIETATI = new Set([
  "execute_with_pipe", "create_process", "create_instance", "shell_open", "shell_show_in_file_manager", "move_to_trash",
  "set_environment", "unset_environment", "get_environment", "has_environment", "get_singleton", "globalize_path",
  "get_path_absolute", "get_executable_path", "get_user_data_dir", "get_data_dir", "get_config_dir", "get_cache_dir",
  "get_system_dir", "get_temp_dir", "class_call_static", "str_to_var", "bytes_to_var_with_objects", "set_script", "source_code",
]);

/**
 * Nomi vietati quando sono scritti in un testo, cioè quando una funzione viene chiamata dandone il nome
 * (`obj.call("execute")`). Come nomi di funzioni proprie (`func execute():`) vanno benissimo.
 */
const NOMI_VIETATI_IN_TESTO = new Set([...NOMI_VIETATI, "execute", "kill", "reload", "open_dynamic_library"]);

/** Funzioni che ricevono un NodePath: lì "../Fratello" è normale. */
const FUNZIONI_NODEPATH = /(?:get_node|get_node_or_null|has_node|find_child|NodePath|get_path_to|get_node_and_resource|has_node_and_resource)\s*\(\s*$/;

const PERCORSO_ASSOLUTO = /^(?:[a-z]:[\\/]|\\\\|~[\\/]|\/(?:home|etc|usr|var|tmp|bin|sbin|proc|dev|sys|mnt|opt|boot|lib|Users|Volumes|Applications|System|private|windows)(?:\/|$))/i;
const RISALITA = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const VARIABILE_DI_AMBIENTE = /%[A-Za-z_]+%|\$(?:HOME|USER|APPDATA|LOCALAPPDATA|USERPROFILE|TEMP|TMP)\b/;

/** Il primo carattere non vuoto prima di una posizione. */
function precedente(testo: string, indice: number): string {
  for (let k = indice - 1; k >= 0; k--) if (!/\s/.test(testo[k])) return testo[k];
  return "";
}

/** Controlla uno script GDScript. */
export function controllaGDScript(file: string, codice: string): Violazione[] {
  const violazioni: Violazione[] = [];
  const { pulito, letterali } = analizzaGDScript(codice);
  const rigaDi = righe(pulito);
  const aggiungi = (indice: number, regola: string, spiegazione: string) => violazioni.push({ file, riga: rigaDi(indice), regola, spiegazione });

  for (const m of pulito.matchAll(/\b([A-Za-z_]\w*)\b/g)) {
    const nome = m[1];
    const indice = m.index;
    // Un nome scritto dopo un punto è un membro di qualcos'altro (es. `rete.IP`): le classi vietate contano solo da sole.
    const membro = precedente(pulito, indice) === ".";
    const dopo = pulito.slice(indice + nome.length, indice + nome.length + 120);
    if (!membro && CLASSI_VIETATE[nome]) aggiungi(indice, `classe:${nome}`, `${nome} non si può usare nel corso: ${CLASSI_VIETATE[nome]}`);
    if (!membro && nome === "OS") {
      const funzione = dopo.match(/^\s*\.\s*([A-Za-z_]\w*)/)?.[1];
      if (!funzione) aggiungi(indice, "os:indiretto", "OS si può usare solo chiamando direttamente una delle sue funzioni innocue (es. OS.get_name())");
      else if (!OS_AMMESSE.has(funzione)) aggiungi(indice, `os:${funzione}`, `OS.${funzione} non si può usare nel corso: dà accesso al sistema o alle cartelle del PC`);
    }
    if (NOMI_VIETATI.has(nome)) aggiungi(indice, `nome:${nome}`, `${nome} non si può usare nel corso: dà accesso al sistema, a file fuori dal progetto o a codice costruito al volo`);
    if (!membro && nome === "ClassDB" && /^\s*\.\s*instantiate\b/.test(dopo)) aggiungi(indice, "classdb:instantiate", "ClassDB.instantiate crea oggetti scelti per nome: nel corso un oggetto si crea con Classe.new()");
    if (!membro && nome === "GDScript" && /^\s*\.\s*new\b/.test(dopo)) aggiungi(indice, "gdscript:new", "GDScript.new() serve a creare codice al volo: non si usa nel corso");
  }

  for (const l of letterali) {
    const valore = l.valore.trim();
    if (NOMI_VIETATI_IN_TESTO.has(valore)) violazioni.push({ file, riga: l.riga, regola: `testo:${valore}`, spiegazione: `"${valore}" è il nome di una funzione vietata nel corso: non va chiamata nemmeno per nome` });
    if (PERCORSO_ASSOLUTO.test(valore)) violazioni.push({ file, riga: l.riga, regola: "percorso-assoluto", spiegazione: `il percorso "${valore.slice(0, 60)}" punta fuori dal progetto: si usano solo percorsi res:// e user://` });
    if (VARIABILE_DI_AMBIENTE.test(l.valore)) violazioni.push({ file, riga: l.riga, regola: "variabile-ambiente", spiegazione: `il testo "${l.valore.slice(0, 60)}" usa una variabile di sistema: non serve nel corso` });
    if (RISALITA.test(l.valore)) {
      const contesto = pulito.slice(Math.max(0, l.indice - 60), l.indice - l.prefisso.length);
      const nodePath = l.prefisso === "^" || /[$%]\s*$/.test(contesto) || FUNZIONI_NODEPATH.test(contesto);
      if (!nodePath || /^(?:res|user):\/\//.test(valore)) {
        violazioni.push({ file, riga: l.riga, regola: "risalita", spiegazione: `il percorso "${valore.slice(0, 60)}" risale con "..": un file si indica con un percorso res:// o user:// che resta dentro il progetto` });
      }
    }
  }
  return unici(violazioni);
}

function unici(v: Violazione[]): Violazione[] {
  const visti = new Set<string>();
  return v.filter((x) => {
    const chiave = `${x.file}:${x.riga}:${x.regola}`;
    if (visti.has(chiave)) return false;
    visti.add(chiave);
    return true;
  });
}

// ─────────────────────────── Scene, risorse, project.godot ───────────────────────────

/** Controlla una scena o una risorsa (.tscn, .tres): niente codice nascosto dentro, solo file del progetto. */
export function controllaRisorsa(file: string, testo: string): Violazione[] {
  const violazioni: Violazione[] = [];
  testo.split(/\r?\n/).forEach((riga, k) => {
    const n = k + 1;
    if (/^\[sub_resource\b[^\]]*type="(?:GDScript|CSharpScript)"/.test(riga)) violazioni.push({ file, riga: n, regola: "script-incorporato", spiegazione: "uno script scritto dentro la scena: nel corso gli script stanno nei loro file .gd" });
    if (/^\s*script\/source\s*=/.test(riga)) violazioni.push({ file, riga: n, regola: "script-incorporato", spiegazione: "codice scritto dentro una risorsa: nel corso gli script stanno nei loro file .gd" });
    if (/^\[ext_resource\b[^\]]*type="(?:GDExtension|NativeScript)"/.test(riga)) violazioni.push({ file, riga: n, regola: "estensione-nativa", spiegazione: "le estensioni native non fanno parte del corso" });
    for (const m of riga.matchAll(/\bpath="([^"]*)"/g)) {
      const p = m[1];
      if (p.startsWith("uid://")) continue;
      const problema = p.startsWith("res://") ? problemaPercorso(p) : "non è un file del progetto (deve iniziare con res://)";
      if (problema) violazioni.push({ file, riga: n, regola: "risorsa-esterna", spiegazione: `la risorsa "${p.slice(0, 80)}": ${problema}` });
    }
  });
  return violazioni;
}

/** Sezioni di project.godot che una lezione non può impostare: estensioni native e plugin dell'editor. */
const SEZIONI_PROGETTO_VIETATE = /^(editor_plugins|gdextension|native_extensions)$/;

/** Controlla un project.godot: niente sezioni vietate, percorsi solo dentro il progetto. */
export function controllaProjectGodot(file: string, testo: string): Violazione[] {
  const violazioni: Violazione[] = [];
  testo.split(/\r?\n/).forEach((riga, k) => {
    const sezione = riga.match(/^\[([^\]]+)\]\s*$/)?.[1];
    if (sezione && SEZIONI_PROGETTO_VIETATE.test(sezione)) violazioni.push({ file, riga: k + 1, regola: `sezione:${sezione}`, spiegazione: `la sezione [${sezione}] di project.godot non fa parte del corso` });
    for (const m of riga.matchAll(/"\*?(res:\/\/[^"]*)"/g)) {
      const problema = problemaPercorso(m[1]);
      if (problema) violazioni.push({ file, riga: k + 1, regola: "percorso", spiegazione: `${m[1]}: ${problema}` });
    }
    if (/"\*?(?:[a-z]:[\\/]|\\\\|\/(?:home|Users|etc|tmp|usr|var)\/)/i.test(riga)) violazioni.push({ file, riga: k + 1, regola: "percorso-assoluto", spiegazione: "project.godot punta a un file fuori dal progetto" });
  });
  return violazioni;
}

/** Sezione di project.godot che un esercizio può impostare con le sue «impostazioni». */
export function sezioneProgettoAmmessa(sezione: string): boolean {
  return !SEZIONI_PROGETTO_VIETATE.test(sezione.trim()) && /^[a-z_][a-z0-9_]*$/i.test(sezione.trim());
}

// ─────────────────────────── Insiemi di file ───────────────────────────

/** Controlla un insieme di file di una lezione (soluzione, progetto di partenza, stato del gioco). */
export function controllaFileLezione(file: { percorso: string; contenuto: string }[]): Violazione[] {
  const violazioni: Violazione[] = [];
  if (file.length > MAX_FILE) violazioni.push({ file: "(progetto)", riga: 0, regola: "troppi-file", spiegazione: `il progetto ha ${file.length} file: al massimo ${MAX_FILE}` });
  let totale = 0;
  const visti = new Set<string>();
  for (const f of file) {
    const problema = problemaPercorso(f.percorso);
    if (problema) {
      violazioni.push({ file: f.percorso.slice(0, 120), riga: 0, regola: "percorso", spiegazione: problema });
      continue;
    }
    const chiave = f.percorso.toLowerCase();
    if (visti.has(chiave)) violazioni.push({ file: f.percorso, riga: 0, regola: "doppione", spiegazione: "lo stesso file compare due volte" });
    visti.add(chiave);
    const estensione = f.percorso.includes(".") ? (f.percorso.split(".").pop() ?? "").toLowerCase() : "";
    if (!ESTENSIONI_AMMESSE.has(estensione)) {
      violazioni.push({ file: f.percorso, riga: 0, regola: "tipo-di-file", spiegazione: `i file ${estensione ? `.${estensione}` : "senza estensione"} non possono far parte di una lezione` });
      continue;
    }
    const byte = Buffer.byteLength(f.contenuto, "utf8");
    totale += byte;
    if (byte > MAX_BYTE_FILE) violazioni.push({ file: f.percorso, riga: 0, regola: "file-grande", spiegazione: `${Math.round(byte / 1024)} KB: troppo grande per un file scritto a mano` });
    if (estensione === "gd") violazioni.push(...controllaGDScript(f.percorso, f.contenuto));
    if (estensione === "tscn" || estensione === "tres") violazioni.push(...controllaRisorsa(f.percorso, f.contenuto));
    if (estensione === "godot") violazioni.push(...controllaProjectGodot(f.percorso, f.contenuto));
  }
  if (totale > MAX_BYTE_TOTALI) violazioni.push({ file: "(progetto)", riga: 0, regola: "progetto-grande", spiegazione: `${Math.round(totale / 1024)} KB di file: troppo per un progetto scritto a mano` });
  return violazioni;
}

/** Le violazioni come righe di testo, per un modello (fabbrica) o per un messaggio a chi studia (aula). */
export function descriviViolazioni(v: Violazione[]): string[] {
  return v.map((x) => `${x.file}${x.riga ? ` riga ${x.riga}` : ""}: ${x.spiegazione}`);
}
