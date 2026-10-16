import { useState } from "react";
import type { EsercizioVista, EsitoConsegna } from "../../comune/api.ts";
import { api } from "../api.ts";
import { Html } from "./Html.tsx";

const RUOLI = { guidato: "Esercizio guidato", autonomo: "Esercizio", test: "Test finale" };

/** Un esercizio (o il test): consegna, dove sta il progetto, verifica, aiuti, soluzione. */
export function Esercizio({ slug, e, onCompletata, onTutor }: { slug: string; e: EsercizioVista; onCompletata: () => void; onTutor: (pezzo: string, codice: string | null) => void }) {
  const [cartella, setCartella] = useState(e.cartellaPredefinita ?? "");
  const [codice, setCodice] = useState("");
  const [risposte, setRisposte] = useState<Record<string, string>>({});
  const [inVerifica, setInVerifica] = useState(false);
  const [esito, setEsito] = useState<EsitoConsegna | null>(null);
  const [analisi, setAnalisi] = useState<{ stato: "no" | "in_corso" | "fatta"; html?: string; righe?: { file?: string; riga?: number | null; problema: string; suggerimento: string }[]; errore?: string }>({ stato: "no" });
  const [suggerimenti, setSuggerimenti] = useState(0);
  const [soluzione, setSoluzione] = useState<string | null>(null);
  const [partenza, setPartenza] = useState<{ stato: "no" | "in_corso" | "fatta"; cartella?: string; spostata?: string; errore?: string }>({ stato: "no" });

  const consegna = { cartella, codice, risposte };

  async function verifica() {
    setInVerifica(true);
    setEsito(null);
    setAnalisi({ stato: "no" });
    const r = await api.consegna(slug, e.id, consegna);
    setEsito(r);
    setInVerifica(false);
    if (r.cartellaUsata) setCartella(r.cartellaUsata);
    if (r.completata) onCompletata();
    if (!r.errore && !r.superato && (e.modalita === "progetto" || e.modalita === "codice")) {
      setAnalisi({ stato: "in_corso" });
      const a = await api.analisiCodice(slug, e.id, { ...consegna, cartella: r.cartellaUsata ?? cartella }, r.controlli);
      setAnalisi({ stato: "fatta", ...a });
    }
  }

  async function preparaPartenza() {
    const avviso =
      e.partenza === "gioco"
        ? "Rimetto il gioco com'era prima di questo esercizio. Se nella cartella c'è già qualcosa non lo cancello: lo conservo in una cartella con la data. Chiudi il progetto in Godot prima di procedere. Vado?"
        : "Copio il progetto di partenza nella cartella dell'esercizio. Se nella cartella c'è già qualcosa non lo cancello: lo conservo in una cartella con la data. Vado?";
    if (!window.confirm(avviso)) return;
    setPartenza({ stato: "in_corso" });
    const r = await api.preparaPartenza(slug, e.id);
    setPartenza({ stato: "fatta", ...r });
    if (r.cartella) setCartella(r.cartella);
  }

  async function mostraSoluzione() {
    const avviso = e.ruolo === "test" ? "Se guardi la soluzione del test, nella tua scheda «Cosa so fare» resterà scritto che l'hai fatto con la soluzione. Vuoi vederla?" : "Vuoi vedere la soluzione? Prova prima con i suggerimenti o chiedi al tutor.";
    if (!window.confirm(avviso)) return;
    setSoluzione((await api.soluzione(slug, e.id)).html);
  }

  return (
    <article id={e.id} className={`scheda esercizio ${e.ruolo === "test" ? "esercizio-test" : ""}`}>
      <div className="riga-spazio">
        <span className="sopratitolo">
          {e.ruolo === "test" ? RUOLI.test : (e.genere?.nome ?? RUOLI[e.ruolo])}
          {e.ruolo === "test" && e.genere ? ` · ${e.genere.nome.toLowerCase()}` : ""}
        </span>
        {(e.superato || esito?.superato) && <span className="etichetta etichetta-ok">Superato</span>}
      </div>
      <h3>{e.titolo}</h3>
      {e.genere && <p className="piccolo tenue">Allena: {e.genere.allena}</p>}
      <Html html={e.consegnaHtml} />

      {e.passiHtml.length > 0 && (
        <details className="apribile">
          <summary>Passi guidati ({e.passiHtml.length})</summary>
          <ol className="passi">
            {e.passiHtml.map((h, i) => (
              <Html key={i} html={h} come="li" />
            ))}
          </ol>
        </details>
      )}
      {e.verifiche.length > 0 && (
        <details className="apribile">
          <summary>Cosa verrà controllato ({e.verifiche.length})</summary>
          <ul className="piccolo">
            {e.verifiche.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </details>
      )}

      {e.modalita === "progetto" && (
        <div className="campo">
          <label htmlFor={`cartella-${e.id}`}>Cartella del tuo progetto Godot</label>
          <div className="riga">
            <input id={`cartella-${e.id}`} type="text" value={cartella} onChange={(ev) => setCartella(ev.target.value)} spellCheck={false} />
            <button type="button" className="pulsante pulsante-leggero" onClick={() => void api.apriCartella(cartella)} title="Apri la cartella in Esplora file">
              Apri
            </button>
          </div>
          <span className="aiuto">Qui l'aula cerca il tuo progetto (la cartella con project.godot). Se l'hai creato altrove con il nome chiesto, lo trova da sola nell'elenco del Project Manager. Legge una copia: non modifica niente.</span>
          {e.partenza && (
            <div className="nota">
              <p className="piccolo">
                {e.partenza === "progetto"
                  ? "Questo esercizio parte da un progetto già scritto: copialo nella cartella qui sopra, poi aggiungilo a Godot dal Project Manager con Import."
                  : "Si lavora sul gioco della fase, quello che hai costruito finora. Se l'hai rovinato o non lo trovi più, posso rimetterlo com'era prima di questo esercizio."}
              </p>
              <button type="button" className="pulsante pulsante-leggero" onClick={() => void preparaPartenza()} disabled={partenza.stato === "in_corso"}>
                {partenza.stato === "in_corso" ? "Copio…" : e.partenza === "progetto" ? "Copia il progetto di partenza" : "Rimetti il gioco com'era"}
              </button>
              {partenza.errore && <p className="piccolo testo-errore">{partenza.errore}</p>}
              {partenza.cartella && (
                <p className="piccolo">
                  Fatto: il progetto è in <code>{partenza.cartella}</code>. In Godot premi <strong>Import</strong> (o <strong>Scan</strong>) nel Project Manager.
                  {partenza.spostata ? ` Ciò che c'era prima è conservato in ${partenza.spostata}.` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {e.previsioni.map((p, i) => {
        const valutazione = esito?.previsioni.find((x) => x.id === p.id);
        return (
          <div key={p.id} className="campo">
            <div className="previsione-domanda">
              <span>{i + 1}. </span>
              <Html html={p.domandaHtml} come="span" />
            </div>
            <Html html={p.codiceHtml} classe="codice-blocco" />
            <input type="text" value={risposte[p.id] ?? ""} onChange={(ev) => setRisposte({ ...risposte, [p.id]: ev.target.value })} placeholder="Il risultato che ti aspetti, senza eseguire il codice" autoComplete="off" spellCheck={false} />
            {valutazione && (
              <div className={`piccolo ${valutazione.corretta ? "testo-ok" : "testo-errore"}`}>
                {valutazione.corretta ? "✓ " : "✗ "}
                <Html html={valutazione.commentoHtml} come="span" />
              </div>
            )}
          </div>
        );
      })}

      {e.modalita === "codice" && (
        <div className="campo">
          <label htmlFor={`codice-${e.id}`}>Il tuo codice GDScript{e.fileCodice ? ` (diventa ${e.fileCodice})` : ""}</label>
          <textarea
            id={`codice-${e.id}`}
            className="area-codice"
            value={codice}
            spellCheck={false}
            onChange={(ev) => setCodice(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key !== "Tab") return;
              ev.preventDefault();
              const t = ev.currentTarget;
              const inizio = t.selectionStart;
              setCodice(codice.slice(0, inizio) + "\t" + codice.slice(t.selectionEnd));
              requestAnimationFrame(() => t.setSelectionRange(inizio + 1, inizio + 1));
            }}
          />
        </div>
      )}
      {e.modalita === "ambiente" && <p className="aiuto">Non c'è niente da caricare: lascia Godot aperto come chiede la consegna e premi Verifica.</p>}

      <div className="azioni">
        <button type="button" className="pulsante" onClick={() => void verifica()} disabled={inVerifica}>
          {inVerifica ? "Verifico…" : "Verifica"}
        </button>
        {suggerimenti < e.suggerimenti.length && (
          <button type="button" className="pulsante pulsante-leggero" onClick={() => setSuggerimenti(suggerimenti + 1)}>
            Un suggerimento
          </button>
        )}
        <button type="button" className="pulsante pulsante-leggero" onClick={() => onTutor(e.id, e.modalita === "codice" ? codice : null)}>
          Chiedi al tutor
        </button>
        <button type="button" className="pulsante pulsante-leggero" onClick={() => void mostraSoluzione()}>
          Soluzione
        </button>
      </div>

      {suggerimenti > 0 && (
        <ul className="suggerimenti">
          {e.suggerimenti.slice(0, suggerimenti).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}

      {esito && (
        <div className={`esito ${esito.superato ? "esito-ok" : "esito-no"}`}>
          {esito.errore ? <p>{esito.errore}</p> : <p className="esito-titolo">{esito.riepilogo}</p>}
          {esito.controlli.length > 0 && (
            <ul className="controlli">
              {esito.controlli.map((c, i) => (
                <li key={i} className={c.superato ? "testo-ok" : "testo-errore"}>
                  {c.superato ? "✓" : "✗"} {c.descrizione}
                  {c.dettaglio && <pre className="dettaglio">{c.dettaglio}</pre>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {analisi.stato === "in_corso" && <p className="piccolo tenue">Guardo il tuo codice per spiegarti cosa non va…</p>}
      {analisi.stato === "fatta" && (
        <div className="nota">
          {analisi.errore ? (
            <p className="piccolo tenue">{analisi.errore}</p>
          ) : (
            <>
              <Html html={analisi.html ?? ""} />
              {(analisi.righe ?? []).length > 0 && (
                <ul className="piccolo">
                  {analisi.righe!.map((r, i) => (
                    <li key={i}>
                      {r.file ? <code>{r.file}{r.riga ? `:${r.riga}` : ""}</code> : null} {r.problema}
                      {r.suggerimento ? <span className="tenue"> — {r.suggerimento}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
      {soluzione !== null && (
        <details className="apribile" open>
          <summary>Soluzione</summary>
          <Html html={soluzione} />
        </details>
      )}
    </article>
  );
}
