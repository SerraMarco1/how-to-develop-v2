import { percorsoRelativo } from "../percorsi.ts";

export { percorsoRelativo };

// Riparazione e controllo dei file scritti dai modelli AI (script .gd e scene .tscn).
//
// I modelli gratuiti fanno spesso gli stessi piccoli errori di forma: spazi al posto dei tab,
// il codice chiuso tra ```, risorse usate ma mai dichiarate. Quelli che si possono correggere
// senza ambiguità li sistema direttamente la piattaforma; per gli altri prepara un messaggio
// preciso, molto più utile al modello dell'errore generico che darebbe Godot.

/** Toglie i recinti ``` e le intestazioni che i modelli aggiungono intorno al codice. */
export function pulisciContenuto(testo: string): string {
  let t = testo.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const recinto = t.trim().match(/^```[\w-]*\n([\s\S]*?)\n?```$/);
  if (recinto) t = recinto[1];
  return t;
}


// ─────────────────────────── GDScript ───────────────────────────

/** Sistema la forma di uno script: niente recinti, niente riga "GDScript" iniziale, indentazione con tab. */
export function riparaGDScript(codice: string): string {
  let righe = pulisciContenuto(codice).split("\n");
  // I modelli copiano a volte il nome del linguaggio come prima riga.
  while (righe.length && /^\s*(gdscript|godot)?\s*$/i.test(righe[0])) righe.shift();

  const rientri = righe.map((r) => r.match(/^ +(?=\S)/)?.[0].length ?? 0).filter((n) => n > 0);
  if (rientri.length > 0) {
    // L'unità di rientro: di solito 4 spazi, a volte 2; altrimenti il rientro più piccolo usato.
    const unita = rientri.every((n) => n % 4 === 0) ? 4 : rientri.every((n) => n % 2 === 0) ? 2 : Math.max(1, Math.min(...rientri));
    righe = righe.map((r) => {
      const iniziale = r.match(/^[ \t]+/)?.[0];
      if (!iniziale || !iniziale.includes(" ")) return r;
      const larghezza = [...iniziale].reduce((n, c) => n + (c === "\t" ? unita : 1), 0);
      return "\t".repeat(Math.round(larghezza / unita)) + r.slice(iniziale.length);
    });
  }
  return righe.join("\n").replace(/\s+$/, "") + "\n";
}

/** Mette in forma uno script di verifica: deve estendere la base della piattaforma. */
export function riparaScriptVerifica(codice: string): string {
  let c = riparaGDScript(codice);
  const base = 'extends "res://htd/htd_test.gd"';
  if (/^extends\s.*$/m.test(c)) c = c.replace(/^extends\s.*$/m, base);
  else c = `${base}\n\n${c}`;
  // `var x := get_prop(...)` non compila: queste funzioni restituiscono un valore senza tipo, e `:=` non può
  // dedurlo. È l'errore più frequente dei modelli negli script di verifica; con `=` funziona.
  c = c.replace(/^(\s*var\s+\w+)\s*:=\s*(?=(?:await\s+)?(?:get_prop|call_if_exists)\(|\w+\.(?:get|call|callv)\()/gm, "$1 = ");
  // class_name in uno script di verifica crea conflitti tra verifiche diverse.
  return c.replace(/^class_name\s.*\n/m, "");
}

const GODOT_3: [RegExp, string][] = [
  [/\bKinematicBody(2D|3D)?\b/, "KinematicBody non esiste in Godot 4: usa CharacterBody2D/CharacterBody3D"],
  [/^\s*export\s*(\(|var)/m, "`export var` è di Godot 3: in Godot 4 si scrive `@export var`"],
  [/^\s*onready\s+var/m, "`onready var` è di Godot 3: in Godot 4 si scrive `@onready var`"],
  [/\byield\s*\(/, "`yield(...)` è di Godot 3: in Godot 4 si usa `await`"],
  [/\.instance\(\)/, "`instance()` è di Godot 3: in Godot 4 si usa `instantiate()`"],
  [/move_and_slide\s*\(\s*[^)\s]/, "`move_and_slide()` in Godot 4 non ha argomenti: imposta `velocity` e poi chiama `move_and_slide()`"],
  [/\bconnect\s*\(\s*"[^"]+"\s*,\s*self\s*,/, '`connect("segnale", self, "metodo")` è di Godot 3: in Godot 4 si scrive `segnale.connect(metodo)`'],
  [/\bchange_scene\s*\(/, "`change_scene()` è di Godot 3: in Godot 4 si usa `change_scene_to_file()`"],
  [/\b(Position2D|Spatial|YSort)\b/, "Position2D/Spatial/YSort sono di Godot 3: in Godot 4 sono Marker2D/Node3D/un Node2D con y_sort_enabled"],
  [/\brand_range\s*\(/, "`rand_range()` è di Godot 3: in Godot 4 si usa `randf_range()` o `randi_range()`"],
];

/** Errori riconoscibili senza eseguire lo script. */
export function controllaFormaGDScript(percorso: string, codice: string): string[] {
  const problemi: string[] = [];
  for (const [modello, messaggio] of GODOT_3) if (modello.test(codice)) problemi.push(`${percorso}: ${messaggio}`);
  if (!/^\s*(extends|class_name)\b/m.test(codice)) problemi.push(`${percorso}: manca la riga \`extends ...\` all'inizio dello script`);
  return problemi;
}

// ─────────────────────────── Scene .tscn ───────────────────────────

/** Sistema la forma di una scena: intestazione presente, niente uid inventati. */
export function riparaScena(testo: string): string {
  let t = pulisciContenuto(testo).trim();
  // I modelli inventano uid che non esistono: Godot usa comunque il percorso, quindi si possono togliere.
  t = t.replace(/^(\[(?:gd_scene|ext_resource)[^\]\n]*?)\s+uid="[^"]*"/gm, "$1");
  if (!/^\[gd_scene\b/.test(t)) t = `[gd_scene format=3]\n\n${t}`;
  return t + "\n";
}

type Blocco = { tipo: string; attributi: Record<string, string>; righe: string[]; riga: number };

function blocchiScena(testo: string): Blocco[] {
  const blocchi: Blocco[] = [];
  testo.split("\n").forEach((riga, indice) => {
    const intestazione = riga.match(/^\[(\w+)\s*(.*)\]\s*$/);
    if (intestazione) {
      const attributi: Record<string, string> = {};
      for (const m of intestazione[2].matchAll(/(\w+)=("([^"]*)"|[^\s\]]+)/g)) attributi[m[1]] = m[3] ?? m[2];
      blocchi.push({ tipo: intestazione[1], attributi, righe: [], riga: indice + 1 });
    } else if (blocchi.length) {
      blocchi[blocchi.length - 1].righe.push(riga);
    }
  });
  return blocchi;
}

/** Proprietà che in una scena devono puntare a una risorsa dichiarata, non a un percorso scritto come testo. */
const PROPRIETA_RISORSA = /^(script|texture|stream|shape|material|theme|tile_set|mesh|sprite_frames|font|environment|scene)\s*=\s*"res:\/\//;

/**
 * Controlla la struttura di una scena scritta a mano.
 * `percorsiEsistenti`: i file del progetto (relativi, senza res://) a cui la scena può riferirsi.
 */
export function controllaScena(percorso: string, testo: string, percorsiEsistenti: Set<string>): string[] {
  const problemi: string[] = [];
  const dove = (b: Blocco) => `${percorso} riga ${b.riga}`;
  const blocchi = blocchiScena(testo);
  const nodi = blocchi.filter((b) => b.tipo === "node");
  if (nodi.length === 0) return [`${percorso}: la scena non contiene nessun nodo (\`[node name="..." type="..."]\`)`];

  const esterne = new Map<string, Blocco>();
  const interne = new Set<string>();
  const primoNodo = blocchi.indexOf(nodi[0]);
  blocchi.forEach((b, indice) => {
    if (b.tipo !== "ext_resource" && b.tipo !== "sub_resource") return;
    if (indice > primoNodo) problemi.push(`${dove(b)}: [${b.tipo}] deve stare PRIMA dei nodi, in cima al file`);
    if (!b.attributi.id) problemi.push(`${dove(b)}: [${b.tipo}] senza id`);
    else if (b.tipo === "ext_resource") esterne.set(b.attributi.id, b);
    else interne.add(b.attributi.id);
    if (b.tipo === "ext_resource") {
      const relativo = percorsoRelativo(b.attributi.path ?? "");
      if (!b.attributi.path) problemi.push(`${dove(b)}: [ext_resource] senza path`);
      else if (!percorsiEsistenti.has(relativo)) {
        problemi.push(
          `${dove(b)}: la scena usa "${b.attributi.path}", ma quel file non è tra i file della soluzione. Aggiungilo a \`soluzione.file\` oppure, se è un'immagine, usa "res://icon.svg" (sempre disponibile).`,
        );
      }
    }
  });

  // Riferimenti a risorse non dichiarate.
  for (const b of blocchi) {
    const testoBlocco = [Object.values(b.attributi).join(" "), ...b.righe].join("\n");
    for (const m of testoBlocco.matchAll(/ExtResource\(\s*"?([^")\s]+)"?\s*\)/g)) {
      if (!esterne.has(m[1])) problemi.push(`${dove(b)}: usa ExtResource("${m[1]}") ma non esiste un [ext_resource ... id="${m[1]}"] in cima al file`);
    }
    for (const m of testoBlocco.matchAll(/SubResource\(\s*"?([^")\s]+)"?\s*\)/g)) {
      if (!interne.has(m[1])) problemi.push(`${dove(b)}: usa SubResource("${m[1]}") ma non esiste un [sub_resource ... id="${m[1]}"] in cima al file`);
    }
    if (b.tipo === "node") {
      const sbagliata = b.righe.find((r) => PROPRIETA_RISORSA.test(r.trim()));
      if (sbagliata) {
        problemi.push(
          `${dove(b)}: \`${sbagliata.trim().slice(0, 80)}\` non è valido. Una risorsa va dichiarata in cima con [ext_resource type="..." path="res://..." id="1_nome"] e usata con ExtResource("1_nome")`,
        );
      }
    }
  }

  // Albero dei nodi: una sola radice, genitori esistenti.
  const percorsi = new Set<string>();
  const istanze: string[] = [];
  nodi.forEach((n, indice) => {
    const { name, parent, type, instance } = n.attributi;
    if (!name) problemi.push(`${dove(n)}: nodo senza name`);
    if (indice === 0) {
      if (parent !== undefined) problemi.push(`${dove(n)}: il primo nodo è la radice della scena e NON deve avere \`parent\``);
      percorsi.add(".");
    } else if (parent === undefined) {
      problemi.push(`${dove(n)}: il nodo "${name}" non ha \`parent\`. Solo il primo nodo è la radice: i figli diretti hanno parent=".", i nipoti parent="NomeFiglio"`);
    } else {
      const dentroIstanza = istanze.some((i) => parent === i || parent.startsWith(`${i}/`));
      if (!percorsi.has(parent) && !dentroIstanza) {
        problemi.push(`${dove(n)}: il nodo "${name}" ha parent="${parent}", ma nessun nodo precedente ha quel percorso (i percorsi sono relativi alla radice: ".", "Player", "Player/Sprite2D")`);
      }
      const proprio = parent === "." ? name : `${parent}/${name}`;
      percorsi.add(proprio);
      if (instance) istanze.push(proprio);
    }
    if (!type && !instance && indice === 0) problemi.push(`${dove(n)}: la radice "${name}" non ha \`type\``);
    if (!type && !instance && indice > 0 && n.attributi.index === undefined) problemi.push(`${dove(n)}: il nodo "${name}" non ha né \`type\` né \`instance\``);
  });

  return [...new Set(problemi)];
}
