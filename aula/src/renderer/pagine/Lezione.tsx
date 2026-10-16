import { useEffect, useState } from "react";
import type { BloccoVista, LezioneVista } from "../../comune/api.ts";
import { api, vaiA } from "../api.ts";
import { Esercizio } from "../componenti/Esercizio.tsx";
import { Html } from "../componenti/Html.tsx";
import { Tutor } from "../componenti/Tutor.tsx";

function Blocco({ b }: { b: BloccoVista }) {
  switch (b.tipo) {
    case "testo":
      return <Html html={b.html} />;
    case "attenzione":
      return (
        <div className="riquadro-attenzione">
          <strong>Attenzione</strong>
          <Html html={b.html} />
        </div>
      );
    case "riepilogo":
      return (
        <div className="riquadro-riepilogo">
          <strong>In breve</strong>
          <Html html={b.html} />
        </div>
      );
    case "codice":
      return (
        <div>
          <Html html={b.html} classe="codice-blocco" />
          {b.spiegazioneHtml && <Html html={b.spiegazioneHtml} classe="md piccolo" />}
        </div>
      );
    case "passi":
      return (
        <div className="riquadro-passi">
          {b.titolo && <strong>{b.titolo}</strong>}
          <ol>
            {b.passiHtml.map((h, i) => (
              <Html key={i} html={h} come="li" />
            ))}
          </ol>
        </div>
      );
    case "immagine":
      return (
        <figure className="figura">
          <img src={b.url} alt={b.didascalia} loading="lazy" />
          {b.didascalia && <figcaption>{b.didascalia}</figcaption>}
        </figure>
      );
    case "video":
      return (
        <figure className="figura">
          <video src={b.url} controls loop muted playsInline preload="metadata" />
          <figcaption>
            {b.titolo}
            {b.azioni.length > 0 && <span className="tenue"> · tasti premuti: {b.azioni.map((a) => `${a.tasto ?? a.azione} da ${a.inizio}s a ${a.fine}s`).join(", ")}</span>}
          </figcaption>
        </figure>
      );
  }
}

/** Una lezione: teoria, esercizi, test, voto; il tutor in un pannello a destra. */
export function PaginaLezione({ slug, onCambia }: { slug: string; onCambia: () => void }) {
  const [l, setL] = useState<LezioneVista | null | undefined>(undefined);
  const [tutor, setTutor] = useState<{ aperto: boolean; pezzo: string | null; codice: string | null }>({ aperto: false, pezzo: null, codice: null });
  const [alternative, setAlternative] = useState<Record<string, string[]>>({});
  const [inSpiegazione, setInSpiegazione] = useState<string | null>(null);
  const [voto, setVoto] = useState<number | null>(null);
  const [nota, setNota] = useState("");
  const [votoSalvato, setVotoSalvato] = useState(false);

  const carica = () =>
    void api.lezione(slug).then((x) => {
      setL(x);
      if (x) {
        setAlternative(x.alternative);
        setVoto(x.voto);
        setNota(x.nota ?? "");
      }
    });
  useEffect(() => {
    carica();
  }, [slug]);

  if (l === undefined) return <p className="tenue">Carico…</p>;
  if (l === null)
    return (
      <div className="pagina">
        <h1>Lezione non disponibile</h1>
        <p>Questa lezione non è ancora pronta, oppure si apre dopo aver completato quella prima.</p>
        <a className="pulsante" href="#/corso">
          Torna al corso
        </a>
      </div>
    );

  async function altroModo(blocco: string) {
    setInSpiegazione(blocco);
    const r = await api.spiegaAltrimenti(slug, blocco);
    setInSpiegazione(null);
    if (r.html) setAlternative((a) => ({ ...a, [blocco]: [...(a[blocco] ?? []), r.html!] }));
    else if (r.errore) window.alert(r.errore);
  }

  const pezzi = [...l.esercizi.map((e) => ({ id: e.id, titolo: e.titolo })), { id: "test", titolo: "Test finale" }];
  return (
    <div className="pagina pagina-lezione">
      <header className="testa-lezione">
        <p className="sopratitolo">
          <a href="#/corso">Corso</a> › Fase {l.fase.numero}: {l.fase.titolo}
        </p>
        <h1>
          {l.numero} · {l.titolo}
        </h1>
        <p className="tenue">
          {l.tipo === "progetto" ? "Tappa del progetto di fine fase · " : l.tipo === "metodo" ? "Lezione di metodo · " : ""}circa {l.minuti} minuti
          {l.completata && <span className="etichetta etichetta-ok">Completata</span>}
        </p>
        {l.obiettivi.length > 0 && (
          <ul className="obiettivi">
            {l.obiettivi.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        )}
        <nav className="indice-lezione">
          <a href={`#/lezione/${slug}`} onClick={(e) => (e.preventDefault(), document.getElementById("teoria")?.scrollIntoView({ behavior: "smooth" }))}>
            Spiegazione
          </a>
          {[...l.esercizi, l.test].map((e) => (
            <a key={e.id} href={`#/lezione/${slug}`} onClick={(ev) => (ev.preventDefault(), document.getElementById(e.id)?.scrollIntoView({ behavior: "smooth" }))}>
              {e.superato ? "✓ " : ""}
              {e.id === "test" ? "Test finale" : e.titolo}
            </a>
          ))}
        </nav>
        {l.avvisi.length > 0 && (
          <div className="nota piccolo">
            {l.avvisi.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </div>
        )}
      </header>

      <section id="teoria" className="teoria">
        {l.blocchi.map((b) => (
          <div key={b.id} className="blocco">
            <Blocco b={b} />
            {(alternative[b.id] ?? []).map((h, i) => (
              <div key={i} className="nota">
                <p className="sopratitolo">Detto in un altro modo</p>
                <Html html={h} />
              </div>
            ))}
            {b.tipo !== "immagine" && b.tipo !== "video" && (
              <div className="azioni-blocco">
                <button type="button" className="collegamento" onClick={() => void altroModo(b.id)} disabled={inSpiegazione !== null}>
                  {inSpiegazione === b.id ? "Ci penso…" : "Spiegamelo in un altro modo"}
                </button>
                <button type="button" className="collegamento" onClick={() => void api.segnala(slug, b.id)}>
                  Segnala un errore
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {l.esercizi.length > 0 && (
        <section>
          <h2>Esercizi</h2>
          {l.esercizi.map((e) => (
            <Esercizio key={e.id} slug={slug} e={e} onCompletata={carica} onTutor={(pezzo, codice) => setTutor({ aperto: true, pezzo, codice })} />
          ))}
        </section>
      )}
      <section>
        <h2>Test finale</h2>
        <Esercizio
          slug={slug}
          e={l.test}
          onCompletata={() => {
            carica();
            onCambia();
          }}
          onTutor={(pezzo, codice) => setTutor({ aperto: true, pezzo, codice })}
        />
      </section>

      {l.completata && (
        <section className="scheda">
          <h2>Lezione completata</h2>
          {l.prossima ? (
            <button type="button" className="pulsante" onClick={() => vaiA(`/lezione/${l.prossima!.slug}`)}>
              Avanti: {l.prossima.titolo}
            </button>
          ) : (
            <p className="tenue">{l.attesaProssima ?? "Hai finito il corso."}</p>
          )}
          <div className="campo">
            <label>Com'era questa lezione? (facoltativo)</label>
            <div className="stelle">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={voto !== null && n <= voto ? "stella piena" : "stella"} onClick={() => (setVoto(n), setVotoSalvato(false))} aria-label={`${n} su 5`}>
                  ★
                </button>
              ))}
            </div>
            <textarea value={nota} onChange={(e) => (setNota(e.target.value), setVotoSalvato(false))} placeholder="Cosa ha funzionato, cosa no" />
            <button type="button" className="pulsante pulsante-leggero" disabled={voto === null} onClick={() => void api.vota(slug, voto!, nota).then(() => setVotoSalvato(true))}>
              {votoSalvato ? "Salvato" : "Salva il voto"}
            </button>
          </div>
          <p className="piccolo tenue">
            Quanto sai fare davvero le cose di questa lezione? Dillo nella scheda <a href="#/scheda">Cosa so fare</a>.
          </p>
        </section>
      )}

      {!tutor.aperto && (
        <button type="button" className="pulsante pulsante-tutor" onClick={() => setTutor({ aperto: true, pezzo: null, codice: null })}>
          Chiedi al tutor
        </button>
      )}
      <Tutor slug={slug} pezzi={pezzi} aperto={tutor.aperto} pezzoIniziale={tutor.pezzo} codiceIniziale={tutor.codice} onChiudi={() => setTutor({ ...tutor, aperto: false })} />
    </div>
  );
}
