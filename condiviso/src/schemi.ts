import { z } from "zod";

// La forma dei dati scritti dai modelli (teoria, esercizi, revisioni) e delle lezioni pubblicate.
// Ogni risposta di un modello passa da qui prima di essere usata; ogni lezione scaricata dall'aula pure.

const testo = z.string().trim().min(1);
const descrizione = z.string().default("");

// ─────────────────────────── Verifiche ───────────────────────────

export const VerificaSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("progetto_godot"), descrizione }),
  z.object({ tipo: z.literal("file_esiste"), percorso: testo, descrizione }),
  z.object({ tipo: z.literal("nodo"), scena: testo, tipoNodo: testo, nome: z.string().optional(), genitore: z.string().optional(), descrizione }),
  z.object({ tipo: z.literal("script_collegato"), scena: testo, nodo: testo, descrizione }),
  z.object({ tipo: z.literal("azione_input"), nome: testo, descrizione }),
  z.object({ tipo: z.literal("impostazione"), sezione: testo, chiave: testo, contiene: z.string().optional(), descrizione }),
  z.object({ tipo: z.literal("testo_in_file"), percorso: testo, regex: testo, descrizione }),
  /** Script GDScript che estende res://htd/htd_test.gd e implementa _run_tests(). */
  z.object({ tipo: z.literal("script_godot"), codice: testo, descrizione }),
  // Verifiche "di ambiente": leggono lo stato di Godot sul PC di chi studia. Le esegue solo l'aula.
  z.object({ tipo: z.literal("godot_aperto"), finestra: z.enum(["project_manager", "editor"]).nullish(), progetto: z.string().nullish(), descrizione }),
  z.object({ tipo: z.literal("progetto_in_elenco"), presente: z.boolean().default(true), descrizione }),
  z.object({ tipo: z.literal("impostazione_editor"), chiave: testo, contiene: z.string().nullish(), descrizione }),
]);
export type Verifica = z.infer<typeof VerificaSchema>;

const TIPI_AMBIENTE = new Set(["godot_aperto", "progetto_in_elenco", "impostazione_editor"]);

/** Vero per le verifiche che guardano lo stato di Godot sul PC (non i file del progetto). */
export function eVerificaAmbiente(v: Verifica): boolean {
  return TIPI_AMBIENTE.has(v.tipo);
}

// ─────────────────────────── Esercizi e test ───────────────────────────

export const FileSchema = z.object({ percorso: testo, contenuto: z.string() });
export type FileProgetto = z.infer<typeof FileSchema>;

/** Le impostazioni di un progetto, descritte in modo semplice: project.godot lo scrive la piattaforma, non il modello. */
export const ProgettoSchema = z.object({
  nome: z.string().default(""),
  scenaPrincipale: z.string().default(""),
  azioni: z.array(z.object({ nome: testo, tasti: z.array(z.coerce.string()).default([]) })).default([]),
  autoload: z.array(z.object({ nome: testo, percorso: testo })).default([]),
  impostazioni: z.array(z.object({ sezione: testo, chiave: testo, valore: z.coerce.string() })).default([]),
});
export type Progetto = z.infer<typeof ProgettoSchema>;

/**
 * Come si consegna un esercizio:
 * - "progetto": una cartella di progetto Godot, che la piattaforma legge ed esegue;
 * - "codice": un solo script incollato nell'aula, che la piattaforma esegue;
 * - "ambiente": niente da consegnare, l'aula guarda lo stato di Godot sul PC;
 * - "previsioni": si legge del codice e si scrive cosa produrrà; la risposta giusta la calcola Godot.
 */
export const MODALITA = ["progetto", "codice", "ambiente", "previsioni"] as const;

/** I tipi di esercizio del piano (vedi `tipiDiEsercizio` in motori/godot/corso/00-piano.json). */
export const TIPI_DI_ESERCIZIO = ["guidato", "obiettivo", "prevedi", "ripara", "estendi", "riordina", "trova", "collauda", "ottimizza", "dati", "imita", "da-zero"] as const;
export type TipoEsercizio = (typeof TIPI_DI_ESERCIZIO)[number];

export const PrevisioneSchema = z.object({
  id: z.string().optional(),
  /** Uno script GDScript con una funzione `run()` che restituisce il valore su cui si chiede la previsione. */
  codice: testo,
  domanda: testo,
  /** La calcola Godot eseguendo il codice, non il modello. */
  risposta: z.coerce.string().default(""),
  spiegazione: z.string().default(""),
});
export type Previsione = z.infer<typeof PrevisioneSchema>;

export const EsercizioSchema = z.object({
  id: z.string().optional(),
  tipo: z.enum(["guidato", "autonomo", "test"]).default("autonomo"),
  genere: z.enum(TIPI_DI_ESERCIZIO).optional(),
  titolo: testo,
  consegna: testo,
  modalita: z.enum(MODALITA),
  /** "gioco": prosegue il gioco della fase. "a-parte": un progetto separato. */
  dove: z.enum(["gioco", "a-parte"]).default("a-parte"),
  cartella: z.string().optional(),
  fileCodice: z.string().optional(),
  passiGuida: z.array(z.string()).default([]),
  suggerimenti: z.array(z.string()).default([]),
  verifiche: z.array(VerificaSchema).default([]),
  previsioni: z.array(PrevisioneSchema).default([]),
  /** Tipo "trova": i nomi che vanno cercati nella documentazione (e che la consegna non deve dire). */
  daTrovare: z.array(z.string()).default([]),
  /** Il progetto da cui si parte, quando non è il gioco della fase (rotto, disordinato, scritto da altri). */
  partenza: z.object({ file: z.array(FileSchema).default([]), progetto: ProgettoSchema.nullish() }).nullish(),
  soluzione: z
    .object({
      file: z.array(FileSchema).default([]),
      progetto: ProgettoSchema.nullish(),
      spiegazione: z.string().default(""),
      /** I file aggiunti o cambiati rispetto al punto di partenza: sono quelli da mostrare come soluzione. */
      cambiati: z.array(z.string()).default([]),
      rimossi: z.array(z.string()).default([]),
    })
    .default({ file: [], spiegazione: "", cambiati: [], rimossi: [] }),
});
export type Esercizio = z.infer<typeof EsercizioSchema>;

/** I file e le impostazioni di un progetto in un certo momento: il gioco di una fase alla fine di una lezione. */
export const StatoProgettoSchema = z.object({ nome: z.string(), cartella: z.string(), file: z.array(FileSchema), progetto: ProgettoSchema });
export type StatoProgetto = z.infer<typeof StatoProgettoSchema>;

// ─────────────────────────── Video del risultato atteso ───────────────────────────

/** Un tasto simulato nei vecchi video della teoria (vedi il blocco "video" più sotto). */
export const AzioneDemoSchema = z.object({ azione: testo, inizio: z.coerce.number().min(0), fine: z.coerce.number().min(0), tasto: z.string().optional() });

/** Un tasto simulato nel video: l'azione della Input Map, quando, e il tasto da scrivere sullo schermo. */
const AzioneVideoSchema = z.object({ azione: testo, inizio: z.coerce.number().min(0), fine: z.coerce.number().min(0), tasto: z.string().trim().max(20).optional() });

/** Un file del progetto scritto come lo scrive Godot (res://…), senza uscire dalla cartella. */
const risorsa = (estensione: string) => z.string().trim().regex(new RegExp(`^res://(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*\\.${estensione}$`), `un file res://….${estensione} del progetto`);

/** Cosa deve fare un soggetto del video nel suo intervallo (vedi valutaCopione in godot/video.ts). */
export const COSE_DA_FARE = ["esserci", "muoversi", "comparire", "sparire", "cambiare colore", "mostrare testo"] as const;

export const SoggettoVideoSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9_]{0,23}$/, "minuscole, cifre e _ (es. stelle)"),
  /** Quali nodi: almeno un criterio; un nodo deve soddisfarli tutti. `nome` accetta * e ? come nel nome dei file. */
  cerca: z
    .object({ scena: risorsa("tscn").optional(), script: risorsa("gd").optional(), nome: z.string().trim().min(1).max(60).optional(), gruppo: z.string().trim().min(1).max(60).optional(), classe: z.string().trim().regex(/^[A-Za-z_][A-Za-z0-9_]{0,59}$/).optional() })
    .refine((c) => Object.values(c).some(Boolean), "almeno un criterio fra scena, script, nome, gruppo, classe"),
  /** Quanti di quei nodi devono vedersi insieme (almeno). */
  quanti: z.coerce.number().int().min(1).max(20).default(1),
  da: z.coerce.number().min(0),
  a: z.coerce.number().min(0),
  deve: z.enum(COSE_DA_FARE).default("esserci"),
  /** Per "mostrare testo": il testo che i nodi devono mostrare (basta che lo contengano, maiuscole a parte). */
  testo: z.string().trim().max(60).optional(),
  /** Scritta accanto al riquadro intorno ai nodi. */
  etichetta: z.string().trim().min(1).max(24),
});
export type SoggettoVideo = z.infer<typeof SoggettoVideoSchema>;

/**
 * Il copione del video «Il risultato atteso» di un esercizio: la scena che chi studia avvia (F5 la principale, F6 un'altra),
 * i tasti simulati, i soggetti da mostrare (e da misurare) e le scritte, ognuna legata a un soggetto. Lo scrive un modello;
 * prima di pubblicare il video la piattaforma controlla che i soggetti si vedano davvero e che non si vedano allo stesso
 * modo nel progetto com'era prima dell'esercizio.
 */
export const CopioneSchema = z.object({
  scena: risorsa("tscn"),
  durata: z.coerce.number().min(4).max(15),
  azioni: z.array(AzioneVideoSchema).max(8).default([]),
  soggetti: z.array(SoggettoVideoSchema).min(1).max(4),
  scritte: z.array(z.object({ testo: z.string().trim().min(1).max(80), da: z.coerce.number().min(0), a: z.coerce.number().min(0), soggetto: z.string().trim() })).min(1).max(4),
});
export type Copione = z.infer<typeof CopioneSchema>;

// ─────────────────────────── Teoria ───────────────────────────

const idBlocco = z.string().optional();

const BLOCCHI = [
  z.object({ id: idBlocco, tipo: z.literal("testo"), md: testo }),
  z.object({ id: idBlocco, tipo: z.literal("codice"), linguaggio: z.string().default("gdscript"), codice: testo, spiegazione: z.string().default("") }),
  z.object({ id: idBlocco, tipo: z.literal("passi"), titolo: z.string().default(""), passi: z.array(testo).min(1) }),
  /** Un errore tipico da evitare. Al massimo due per lezione. */
  z.object({ id: idBlocco, tipo: z.literal("attenzione"), md: testo }),
  /** I punti chiave della lezione. Uno solo, in fondo. */
  z.object({ id: idBlocco, tipo: z.literal("riepilogo"), md: testo }),
  /** Un'immagine vera dell'editor, scelta dal catalogo del pacchetto motore. */
  z.object({ id: idBlocco, tipo: z.literal("immagine"), immagine: testo, didascalia: z.string().default("") }),
  /**
   * I vecchi video della teoria (fino al 19 ottobre 2026): riprendevano la scena principale così com'era e non si
   * mostrano più. Restano nel formato perché le lezioni pubblicate allora li contengono. I video di oggi sono
   * «Il risultato atteso» di un esercizio (vedi CopioneSchema e `video` nel pacco della lezione).
   */
  z.object({
    id: idBlocco,
    tipo: z.literal("video"),
    titolo: testo,
    /** Id dell'esercizio la cui soluzione viene registrata. */
    esercizio: testo,
    scena: z.string().optional(),
    durata: z.coerce.number().min(2).max(20).default(6),
    azioni: z.array(AzioneDemoSchema).default([]),
  }),
] as const;

export const BloccoSchema = z.discriminatedUnion("tipo", [...BLOCCHI]);
export type Blocco = z.infer<typeof BloccoSchema>;

/** I blocchi come possono arrivare da un modello: oltre a quelli veri, i vecchi riquadri "nota" e i quiz, riportati nel formato. */
const BloccoGrezzoSchema = z.discriminatedUnion("tipo", [
  ...BLOCCHI,
  z.object({ id: idBlocco, tipo: z.literal("nota"), variante: z.string().default("info"), md: testo }),
  z.object({ id: idBlocco, tipo: z.literal("quiz"), domande: z.array(z.unknown()).default([]) }),
]);

function blocchiDaGrezzi(blocchi: z.infer<typeof BloccoGrezzoSchema>[]): Blocco[] {
  return blocchi.flatMap((b): Blocco[] => {
    if (b.tipo === "quiz") return [];
    if (b.tipo === "nota") return [{ id: b.id, tipo: b.variante === "attenzione" ? "attenzione" : "testo", md: b.md }];
    return [b];
  });
}

export const SpiegazioneSchema = z
  .object({
    titolo: testo,
    sommario: testo,
    concetti: z.array(z.string()).default([]),
    obiettivi: z.array(z.string()).default([]),
    durataMinuti: z.coerce.number().int().min(5).max(240).default(45),
    blocchi: z.array(BloccoGrezzoSchema).min(3),
  })
  .transform((s) => ({ ...s, blocchi: blocchiDaGrezzi(s.blocchi) }));
export type Spiegazione = z.infer<typeof SpiegazioneSchema>;

export const PraticaSchema = z.object({ esercizi: z.array(EsercizioSchema).max(4), test: EsercizioSchema });
export type Pratica = z.infer<typeof PraticaSchema>;

/** Il contenuto di una lezione: teoria, esercizi, test, gli avvisi sui ripieghi e il gioco com'era all'inizio. */
export type Lezione = Spiegazione & Pratica & { avvisi?: string[]; statoIniziale?: StatoProgetto };

/** La stessa cosa, ricontrollata quando l'aula scarica una lezione: i blocchi sono già nella forma definitiva. */
export const LezioneSchema = z.object({
  titolo: testo,
  sommario: testo,
  concetti: z.array(z.string()).default([]),
  obiettivi: z.array(z.string()).default([]),
  durataMinuti: z.number().int().min(5).max(240).default(45),
  blocchi: z.array(BloccoSchema).min(1),
  esercizi: z.array(EsercizioSchema).max(4),
  test: EsercizioSchema,
  avvisi: z.array(z.string()).optional(),
  statoIniziale: StatoProgettoSchema.optional(),
});

// ─────────────────────────── Revisione, correttore, ripasso ───────────────────────────

export const RevisioneSchema = z.object({
  approvata: z.boolean(),
  problemi: z
    .array(
      z.object({
        parte: z.enum(["spiegazione", "pratica"]).default("spiegazione"),
        dove: z.string().default(""),
        problema: testo,
        correzione: z.string().default(""),
        /** La frase della documentazione (o dei fatti certi) che dimostra l'errore, copiata parola per parola. */
        fonte: z.string().default(""),
      }),
    )
    .default([]),
});

export const FeedbackCodiceSchema = z.object({
  riepilogo: testo,
  righe: z
    .array(
      z.object({
        file: z.string().optional(),
        riga: z.coerce.number().int().nullable().optional(),
        problema: testo,
        spiegazione: z.string().default(""),
        suggerimento: z.string().default(""),
      }),
    )
    .default([]),
});
export type FeedbackCodice = z.infer<typeof FeedbackCodiceSchema>;

export const DomandaSchema = z.discriminatedUnion("tipo", [
  z.object({
    id: z.string().optional(),
    tipo: z.literal("scelta"),
    testo,
    opzioni: z.array(testo).min(2).max(6),
    corretta: z.coerce.number().int().min(0),
    spiegazione: z.string().default(""),
  }),
  z.object({ id: z.string().optional(), tipo: z.literal("aperta"), testo, criteri: testo }),
]);
export type Domanda = z.infer<typeof DomandaSchema>;

export const RichiamoSchema = z.object({ domande: z.array(DomandaSchema).min(2).max(8) });
