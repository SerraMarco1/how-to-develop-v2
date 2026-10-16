import { leggiPiano } from "@htd/condiviso/piano.ts";
import type { FaseScheda, VoceScheda } from "../comune/api.ts";
import { adesso, database } from "./db.ts";

// La scheda «Cosa so fare»: voce per voce le cose che il corso promette di insegnare (le righe «impari» di ogni lezione
// e «alla fine» di ogni fase), con ciò che l'aula ha misurato e con la valutazione che dai di te. Si scarica in Markdown
// e in JSON: è il documento da dare a Claude insieme all'idea di un gioco, per sapere cosa sai già fare e cosa manca.

export const LIVELLI = ["Non la so fare", "Con molto aiuto", "Con la documentazione aperta", "Da solo", "La insegnerei"] as const;

type Misure = { stato: string; iniziata: string | null; completata: string | null; consegneTest: number; testAlPrimo: boolean | null; aiuto: number; soluzioneVista: boolean; domandeTutor: number; voto: number | null; nota: string | null };

function misure(slug: string): Misure {
  const db = database();
  const p = db.prepare("SELECT * FROM progressi WHERE slug = ?").get(slug) as { stato: string; iniziata: string; completata: string | null; aiuto: number; soluzione_vista: number; voto: number | null; nota: string | null } | undefined;
  const test = db.prepare("SELECT superato FROM tentativi WHERE slug = ? AND pezzo = 'test' ORDER BY id").all(slug) as { superato: number }[];
  const domande = (db.prepare("SELECT COUNT(*) AS n FROM tutor WHERE slug = ? AND ruolo = 'utente'").get(slug) as { n: number }).n;
  return {
    stato: p?.stato === "completata" ? "completata" : p ? "in_corso" : "non_iniziata",
    iniziata: p?.iniziata ?? null,
    completata: p?.completata ?? null,
    consegneTest: test.length,
    testAlPrimo: test.length ? test[0].superato === 1 : null,
    aiuto: p?.aiuto ?? 0,
    soluzioneVista: p?.soluzione_vista === 1,
    domandeTutor: domande,
    voto: p?.voto ?? null,
    nota: p?.nota ?? null,
  };
}

const giorno = (d: string | null) => (d ? new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "");

function misureInParole(m: Misure): string {
  if (m.stato === "non_iniziata") return "Non ancora studiata.";
  const parti = [m.stato === "completata" ? `Completata il ${giorno(m.completata)}` : `In corso dal ${giorno(m.iniziata)}`];
  if (m.consegneTest > 0) parti.push(m.testAlPrimo ? "test superato al primo tentativo" : `test consegnato ${m.consegneTest} volte`);
  parti.push(m.soluzioneVista ? "soluzione del test vista" : m.aiuto > 0 ? `aiuto del tutor sul test: livello ${m.aiuto} su 5` : "nessun aiuto del tutor sul test");
  if (m.domandeTutor > 0) parti.push(`${m.domandeTutor} domande al tutor`);
  return `${parti.join(" · ")}.`;
}

export function scheda(): FaseScheda[] {
  const valutazioni = new Map((database().prepare("SELECT chiave, livello, nota FROM autovalutazioni").all() as { chiave: string; livello: number | null; nota: string | null }[]).map((v) => [v.chiave, v]));
  const voce = (chiave: string, testo: string): VoceScheda => ({ chiave, testo, livello: valutazioni.get(chiave)?.livello ?? null, nota: valutazioni.get(chiave)?.nota ?? null });
  return leggiPiano().fasi.map((f, numero) => ({
    slug: f.slug,
    numero,
    titolo: f.titolo,
    voci: f.allaFine.map((t, i) => voce(`fase:${f.slug}:${i}`, t)),
    lezioni: f.lezioni.map((l, posizione) => ({ slug: l.slug, numero: `${numero}.${posizione}`, titolo: l.titolo, tipo: l.tipo, misure: misureInParole(misure(l.slug)), voci: l.impari.map((t, i) => voce(`lezione:${l.slug}:${i}`, t)) })),
  }));
}

export function autovaluta(chiave: string, livello: number | null, nota: string): void {
  database().prepare("INSERT INTO autovalutazioni (chiave, livello, nota, quando) VALUES (?, ?, ?, ?) ON CONFLICT(chiave) DO UPDATE SET livello = excluded.livello, nota = excluded.nota, quando = excluded.quando").run(chiave, livello, nota.slice(0, 2000) || null, adesso());
}

const valutazioneInParole = (v: VoceScheda) => (v.livello === null ? "non valutata" : `${v.livello}/4 — ${LIVELLI[v.livello]}`);

export function schedaMarkdown(soloFase: string | null): string {
  const fasi = scheda().filter((f) => !soloFase || f.slug === soloFase);
  const righe = [`# Cosa so fare — Godot 4.7${fasi.length === 1 ? ` · Fase ${fasi[0].numero}: ${fasi[0].titolo}` : ""}`, "", `Scheda scaricata il ${giorno(adesso())} dall'aula di How to Develop.`, ""];
  righe.push("Per ogni voce: **cosa ha misurato l'aula** e **come mi valuto io**, da 0 a 4:", "", ...LIVELLI.map((n, i) => `- ${i} — ${n}`), "", "A cosa serve: data a Claude insieme all'idea di un gioco, dice cosa so già fare e cosa mi manca.", "");
  const elenco = (voci: VoceScheda[]) => voci.flatMap((v) => [`- ${v.testo} — **${valutazioneInParole(v)}**`, ...(v.nota ? [`  - Nota: ${v.nota}`] : [])]);
  for (const f of fasi) {
    righe.push(`## Fase ${f.numero} · ${f.titolo}`, "", "### Alla fine della fase", "", ...elenco(f.voci), "");
    for (const l of f.lezioni) righe.push(`### ${l.numero} ${l.titolo}`, "", `_${l.misure}_`, "", ...elenco(l.voci), "");
  }
  return righe.join("\n");
}

export function schedaJson(soloFase: string | null): unknown {
  const voce = (v: VoceScheda) => ({ voce: v.testo, valutazione: v.livello, valutazioneInParole: v.livello === null ? null : LIVELLI[v.livello], nota: v.nota });
  return {
    titolo: "Cosa so fare — Godot 4.7",
    scaricataIl: adesso(),
    scalaValutazione: LIVELLI.map((nome, livello) => ({ livello, nome })),
    fasi: scheda()
      .filter((f) => !soloFase || f.slug === soloFase)
      .map((f) => ({ numero: f.numero, slug: f.slug, titolo: f.titolo, allaFine: f.voci.map(voce), lezioni: f.lezioni.map((l) => ({ numero: l.numero, slug: l.slug, titolo: l.titolo, tipo: l.tipo, misurato: l.misure, impari: l.voci.map(voce) })) })),
  };
}
