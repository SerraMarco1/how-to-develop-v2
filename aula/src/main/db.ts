import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PERCORSI } from "./percorsi.ts";

// Il database dell'aula (SQLite, sul PC): i tuoi progressi e le lezioni scaricate. Le chiavi del tutor ci stanno
// cifrate da Windows con il tuo account (vedi impostazioni.ts): copiare il file su un altro PC non le rende leggibili.

let db: DatabaseSync | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS impostazioni (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS lezioni (
    slug TEXT PRIMARY KEY, numero TEXT NOT NULL, fase TEXT NOT NULL, titolo TEXT NOT NULL,
    versione INTEGER NOT NULL, sha256 TEXT NOT NULL, pacco TEXT NOT NULL, scaricata TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progressi (
    slug TEXT PRIMARY KEY, stato TEXT NOT NULL, aiuto INTEGER NOT NULL DEFAULT 0, soluzione_vista INTEGER NOT NULL DEFAULT 0,
    iniziata TEXT NOT NULL, completata TEXT, voto INTEGER, nota TEXT
  );
  CREATE TABLE IF NOT EXISTS tentativi (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, pezzo TEXT NOT NULL, consegna TEXT NOT NULL,
    esito TEXT NOT NULL, superato INTEGER NOT NULL, quando TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tentativi_slug ON tentativi(slug, pezzo);
  CREATE TABLE IF NOT EXISTS tutor (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, ruolo TEXT NOT NULL, testo TEXT NOT NULL,
    livello INTEGER NOT NULL DEFAULT 0, modello TEXT, quando TEXT NOT NULL, pezzo TEXT
  );
  CREATE INDEX IF NOT EXISTS tutor_slug ON tutor(slug);
  CREATE TABLE IF NOT EXISTS spiegazioni (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, blocco TEXT NOT NULL, testo TEXT NOT NULL, quando TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS ripassi (
    slug TEXT PRIMARY KEY, scadenza TEXT NOT NULL, intervallo REAL NOT NULL, facilita REAL NOT NULL,
    ripetizioni INTEGER NOT NULL DEFAULT 0, errori INTEGER NOT NULL DEFAULT 0, ultimo TEXT
  );
  CREATE TABLE IF NOT EXISTS autovalutazioni (chiave TEXT PRIMARY KEY, livello INTEGER, nota TEXT, quando TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, titolo TEXT NOT NULL, cartella TEXT, aiuto INTEGER NOT NULL DEFAULT 0, quando TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chiamate_ai (
    id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, fornitore TEXT NOT NULL, modello TEXT NOT NULL,
    ruolo TEXT NOT NULL, ok INTEGER NOT NULL, errore TEXT
  );
`;

export function apriDatabase(file = PERCORSI.database): DatabaseSync {
  if (db) return db;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  // Aula 2.0.3: la chat del tutor è divisa per esercizio (il 17 ottobre, con un'unica chat per lezione, il tutor
  // rispose sul sottomarino a una domanda sul rover). I messaggi di prima restano nella «lezione in generale».
  if (!(db.prepare("PRAGMA table_info(tutor)").all() as { name: string }[]).some((c) => c.name === "pezzo")) db.exec("ALTER TABLE tutor ADD COLUMN pezzo TEXT");
  return db;
}

export function database(): DatabaseSync {
  if (!db) throw new Error("Database non aperto");
  return db;
}

/** Solo per le prove: chiude il database aperto. */
export function chiudiDatabase(): void {
  db?.close();
  db = null;
}

export function leggiImpostazione<T>(chiave: string, predefinito: T): T {
  const riga = database().prepare("SELECT valore FROM impostazioni WHERE chiave = ?").get(chiave) as { valore: string } | undefined;
  if (!riga) return predefinito;
  try {
    return JSON.parse(riga.valore) as T;
  } catch {
    return predefinito;
  }
}

export function scriviImpostazione(chiave: string, valore: unknown): void {
  database().prepare("INSERT INTO impostazioni (chiave, valore) VALUES (?, ?) ON CONFLICT(chiave) DO UPDATE SET valore = excluded.valore").run(chiave, JSON.stringify(valore));
}

export const adesso = () => new Date().toISOString();
