import { useState } from "react";
import type { Oggi } from "../../comune/api.ts";
import { api } from "../api.ts";

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("it-IT", { weekday: "long", hour: "2-digit", minute: "2-digit" }) : "");

/** La pagina iniziale: cosa studiare adesso, cosa c'è pronto, cosa sta facendo la fabbrica. */
export function PaginaOggi({ dati, onAggiorna }: { dati: Oggi | null; onAggiorna: () => void }) {
  const [scarico, setScarico] = useState(false);
  if (!dati) return <p className="tenue">Carico…</p>;
  const { prossima, fabbrica, sincronizzazione: s } = dati;
  const scarica = async () => {
    setScarico(true);
    await api.sincronizza();
    setScarico(false);
    onAggiorna();
  };
  return (
    <div className="pagina">
      <h1>Oggi</h1>

      {dati.daImpostare.length > 0 && (
        <section className="scheda scheda-avviso">
          <h2>Prima di cominciare</h2>
          <ul>
            {dati.daImpostare.includes("cartella") && <li>Scegli la cartella in cui tieni i progetti degli esercizi.</li>}
            {dati.daImpostare.includes("chiavi") && <li>Il tutor ha bisogno di almeno una chiave (Groq, Mistral o Gemini).</li>}
          </ul>
          <a className="pulsante" href="#/impostazioni">
            Vai alle impostazioni
          </a>
        </section>
      )}

      <section className="scheda in-evidenza">
        {prossima && prossima.stato === "disponibile" ? (
          <>
            <p className="sopratitolo">Da studiare adesso</p>
            <h2>
              {prossima.numero} · {prossima.titolo}
            </h2>
            <p className="tenue">Circa {prossima.minuti} minuti{prossima.tipo === "progetto" ? " · tappa del progetto di fine fase" : prossima.tipo === "metodo" ? " · lezione di metodo" : ""}</p>
            <a className="pulsante" href={`#/lezione/${prossima.slug}`}>
              Apri la lezione
            </a>
          </>
        ) : prossima ? (
          <>
            <p className="sopratitolo">In arrivo</p>
            <h2>
              {prossima.numero} · {prossima.titolo}
            </h2>
            <p>Hai completato tutte le lezioni pronte. Questa la sta ancora preparando la fabbrica.</p>
          </>
        ) : (
          <>
            <h2>Corso completato</h2>
            <p>Hai finito tutte le lezioni del corso.</p>
          </>
        )}
      </section>

      <div className="griglia-tre">
        <section className="scheda">
          <p className="sopratitolo">Lezioni pronte davanti a te</p>
          <p className="numero-grande">{dati.pronteDavanti}</p>
          <p className="tenue piccolo">
            {dati.completate} completate · {dati.pubblicate} pronte su {dati.totali}
          </p>
        </section>
        <section className="scheda">
          <p className="sopratitolo">Ripasso</p>
          <p className="numero-grande">{dati.ripassiDovuti}</p>
          <p className="tenue piccolo">{dati.ripassiDovuti ? <a href="#/ripasso">da fare oggi</a> : "niente da ripassare oggi"}</p>
        </section>
        <section className="scheda">
          <p className="sopratitolo">La fabbrica</p>
          <p className={`stato-fabbrica stato-${fabbrica.stato}`}>
            {fabbrica.stato === "lavora" ? "Sta scrivendo" : fabbrica.stato === "aspetta" ? "In attesa" : fabbrica.stato === "ferma" ? "Ferma" : fabbrica.stato === "finito" ? "Corso completo" : "Sconosciuto"}
          </p>
          <p className="tenue piccolo">
            {fabbrica.messaggio}
            {fabbrica.riprende && fabbrica.stato === "aspetta" ? ` Riprova ${quando(fabbrica.riprende)}.` : ""}
          </p>
        </section>
      </div>

      <p className="piccolo tenue">
        {s.inCorso || scarico ? "Scarico le lezioni nuove…" : s.errore ? s.errore : s.ultima ? `Lezioni controllate ${quando(s.ultima)}.` : "Lezioni non ancora scaricate."}{" "}
        {!s.inCorso && !scarico && (
          <button type="button" className="collegamento" onClick={() => void scarica()}>
            Controlla adesso
          </button>
        )}
      </p>
      {s.avvisi.length > 0 && (
        <div className="nota nota-errore">
          {s.avvisi.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}
    </div>
  );
}
