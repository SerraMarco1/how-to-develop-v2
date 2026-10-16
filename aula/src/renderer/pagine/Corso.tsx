import { useEffect, useState } from "react";
import type { FaseCorso } from "../../comune/api.ts";
import { api } from "../api.ts";

const SEGNI = { completata: "✓", disponibile: "●", bloccata: "○", in_arrivo: "…" } as const;
const SPIEGAZIONI = { completata: "Completata", disponibile: "Da studiare", bloccata: "Si apre dopo quella prima", in_arrivo: "La sta preparando la fabbrica" } as const;

/** Il corso intero: le fasi e le loro lezioni, con lo stato di ognuna. */
export function PaginaCorso({ chiave }: { chiave: number }) {
  const [fasi, setFasi] = useState<FaseCorso[] | null>(null);
  useEffect(() => {
    void api.corso().then(setFasi);
  }, [chiave]);
  if (!fasi) return <p className="tenue">Carico…</p>;
  return (
    <div className="pagina">
      <h1>Corso</h1>
      <p className="tenue">Il corso è una strada sola: ogni lezione si apre quando hai completato quella prima.</p>
      {fasi.map((f) => {
        const fatte = f.lezioni.filter((l) => l.stato === "completata").length;
        const aperta = f.lezioni.some((l) => l.stato === "disponibile") || (fatte > 0 && fatte < f.lezioni.length);
        return (
          <details key={f.slug} className="fase" open={aperta}>
            <summary>
              <span className="fase-numero">Fase {f.numero}</span>
              <span className="fase-titolo">{f.titolo}</span>
              <span className="fase-conto tenue">
                {fatte}/{f.lezioni.length}
              </span>
            </summary>
            <p className="tenue piccolo">{f.descrizione}</p>
            {f.gioco && <p className="piccolo">Gioco della fase: {f.gioco}</p>}
            <ol className="elenco-lezioni">
              {f.lezioni.map((l) => (
                <li key={l.slug} className={`lezione-voce stato-${l.stato}`} title={SPIEGAZIONI[l.stato]}>
                  <span className="segno" aria-label={SPIEGAZIONI[l.stato]}>
                    {SEGNI[l.stato]}
                  </span>
                  <span className="numero">{l.numero}</span>
                  {l.stato === "disponibile" || l.stato === "completata" ? <a href={`#/lezione/${l.slug}`}>{l.titolo}</a> : <span>{l.titolo}</span>}
                  <span className="tenue piccolo">
                    {l.tipo === "progetto" ? "progetto · " : l.tipo === "metodo" ? "metodo · " : ""}
                    {l.minuti} min
                  </span>
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
