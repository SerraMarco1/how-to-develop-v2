import { useEffect, useState } from "react";
import type { Ripasso } from "../../comune/api.ts";
import { api } from "../api.ts";
import { Html } from "../componenti/Html.tsx";

/** Il ripasso di oggi: per ogni lezione in scadenza, qualche pezzo di codice di cui prevedere il risultato. */
export function PaginaRipasso({ onCambia }: { onCambia: () => void }) {
  const [ripassi, setRipassi] = useState<Ripasso[] | null>(null);
  useEffect(() => {
    void api.ripassi().then(setRipassi);
  }, []);
  if (!ripassi) return <p className="tenue">Carico…</p>;
  return (
    <div className="pagina">
      <h1>Ripasso</h1>
      <p className="tenue">Le lezioni completate tornano dopo qualche giorno, poi sempre più tardi se le ricordi bene. Leggi il codice e scrivi il risultato, senza eseguirlo.</p>
      {ripassi.length === 0 && <p>Niente da ripassare oggi.</p>}
      {ripassi.map((r) => (
        <UnRipasso key={r.slug} r={r} onFatto={onCambia} />
      ))}
    </div>
  );
}

function UnRipasso({ r, onFatto }: { r: Ripasso; onFatto: () => void }) {
  const [risposte, setRisposte] = useState<Record<string, string>>({});
  const [esito, setEsito] = useState<{ esiti: { id: string; corretta: boolean; commentoHtml: string }[]; prossimo: string } | null>(null);
  return (
    <section className="scheda">
      <h2>{r.titolo}</h2>
      {r.voci.map((v, i) => {
        const e = esito?.esiti.find((x) => x.id === v.id);
        return (
          <div key={v.id} className="campo">
            <div className="previsione-domanda">
              <span>{i + 1}. </span>
              <Html html={v.domandaHtml} come="span" />
            </div>
            <Html html={v.codiceHtml} classe="codice-blocco" />
            <input type="text" value={risposte[v.id] ?? ""} onChange={(ev) => setRisposte({ ...risposte, [v.id]: ev.target.value })} disabled={Boolean(esito)} autoComplete="off" spellCheck={false} />
            {e && (
              <div className={`piccolo ${e.corretta ? "testo-ok" : "testo-errore"}`}>
                {e.corretta ? "✓ " : "✗ "}
                <Html html={e.commentoHtml} come="span" />
              </div>
            )}
          </div>
        );
      })}
      {esito ? (
        <p className="piccolo">Prossimo ripasso di questa lezione: {esito.prossimo}.</p>
      ) : (
        <button type="button" className="pulsante" onClick={() => void api.rispondiRipasso(r.slug, risposte).then((x) => (setEsito(x), onFatto()))}>
          Controlla
        </button>
      )}
    </section>
  );
}
