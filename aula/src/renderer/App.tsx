import { useEffect, useState } from "react";
import type { Aggiornamento, Oggi as DatiOggi } from "../comune/api.ts";
import { api, leggiRotta, type Rotta } from "./api.ts";
import { Rete } from "./componenti/Rete.tsx";
import { PaginaCorso } from "./pagine/Corso.tsx";
import { PaginaImpostazioni } from "./pagine/Impostazioni.tsx";
import { PaginaLezione } from "./pagine/Lezione.tsx";
import { PaginaOggi } from "./pagine/Oggi.tsx";
import { PaginaRipasso } from "./pagine/Ripasso.tsx";
import { PaginaScheda } from "./pagine/Scheda.tsx";

const VOCI: { rotta: Rotta["pagina"]; nome: string; icona: string }[] = [
  { rotta: "oggi", nome: "Oggi", icona: "◐" },
  { rotta: "corso", nome: "Corso", icona: "▤" },
  { rotta: "ripasso", nome: "Ripasso", icona: "↻" },
  { rotta: "scheda", nome: "Cosa so fare", icona: "☑" },
];

export function App() {
  const [rotta, setRotta] = useState<Rotta>(leggiRotta());
  const [oggi, setOggi] = useState<DatiOggi | null>(null);
  const [aggiornamento, setAggiornamento] = useState<Aggiornamento>({ stato: "nessuno" });
  const [versioneDati, setVersioneDati] = useState(0);

  useEffect(() => {
    const cambia = () => {
      const nuova = leggiRotta();
      setRotta(nuova);
      window.scrollTo(0, 0);
      // Tornando alla pagina iniziale i numeri devono essere quelli di adesso.
      if (nuova.pagina === "oggi") void api.oggi().then(setOggi);
    };
    window.addEventListener("hashchange", cambia);
    return () => window.removeEventListener("hashchange", cambia);
  }, []);

  useEffect(() => {
    const ricarica = () => {
      void api.oggi().then(setOggi);
      setVersioneDati((v) => v + 1);
    };
    ricarica();
    const smetti = [api.suEvento("sincronizzato", ricarica), api.suEvento("aggiornamento", () => void api.aggiornamento().then(setAggiornamento))];
    void api.aggiornamento().then(setAggiornamento);
    return () => smetti.forEach((s) => s());
  }, []);

  const ripassi = oggi?.ripassiDovuti ?? 0;
  return (
    <div className="guscio">
      <nav className="laterale" aria-label="Sezioni">
        <a className="marchio" href="#/oggi">
          <span className="marchio-segno">H</span>
          <span>How to Develop</span>
        </a>
        <ul>
          {VOCI.map((v) => (
            <li key={v.rotta}>
              <a href={`#/${v.rotta}`} className={rotta.pagina === v.rotta || (v.rotta === "corso" && rotta.pagina === "lezione") ? "attiva" : ""}>
                <span className="icona" aria-hidden>
                  {v.icona}
                </span>
                {v.nome}
                {v.rotta === "ripasso" && ripassi > 0 && <span className="pallino">{ripassi}</span>}
              </a>
            </li>
          ))}
        </ul>
        <div className="laterale-fondo">
          {aggiornamento.stato !== "nessuno" && aggiornamento.stato !== "errore" && (
            <button type="button" className="pulsante pulsante-piccolo" onClick={() => void api.installaAggiornamento().then(() => api.aggiornamento().then(setAggiornamento))} disabled={aggiornamento.stato === "scaricamento"}>
              {aggiornamento.stato === "pronto" ? "Riavvia e aggiorna" : aggiornamento.stato === "scaricamento" ? `Scarico ${aggiornamento.messaggio ?? ""}` : `Aggiorna alla ${aggiornamento.versione}`}
            </button>
          )}
          <a href="#/impostazioni" className={rotta.pagina === "impostazioni" ? "attiva" : ""}>
            <span className="icona" aria-hidden>
              ⚙
            </span>
            Impostazioni
          </a>
        </div>
      </nav>
      <main className="contenuto">
        <Rete chiave={window.location.hash}>
        {rotta.pagina === "oggi" && <PaginaOggi dati={oggi} onAggiorna={() => void api.oggi().then(setOggi)} />}
        {rotta.pagina === "corso" && <PaginaCorso chiave={versioneDati} />}
        {rotta.pagina === "lezione" && rotta.slug && <PaginaLezione key={`${rotta.slug}-${versioneDati}`} slug={rotta.slug} onCambia={() => void api.oggi().then(setOggi)} />}
        {rotta.pagina === "ripasso" && <PaginaRipasso onCambia={() => void api.oggi().then(setOggi)} />}
        {rotta.pagina === "scheda" && <PaginaScheda />}
        {rotta.pagina === "impostazioni" && <PaginaImpostazioni onCambia={() => void api.oggi().then(setOggi)} />}
        </Rete>
      </main>
    </div>
  );
}
