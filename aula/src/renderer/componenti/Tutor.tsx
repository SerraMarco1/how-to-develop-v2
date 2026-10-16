import { useEffect, useRef, useState } from "react";
import type { MessaggioTutor } from "../../comune/api.ts";
import { api } from "../api.ts";
import { Html } from "./Html.tsx";

const LIVELLI = ["Domanda libera", "Domanda guida", "Indizio", "Spiegazione", "Esempio simile", "Soluzione"];

/** Il tutor: un pannello a destra. Il livello di aiuto lo scegli tu, dalla domanda guida alla soluzione. */
export function Tutor({ slug, pezzi, aperto, pezzoIniziale, codiceIniziale, onChiudi }: { slug: string; pezzi: { id: string; titolo: string }[]; aperto: boolean; pezzoIniziale: string | null; codiceIniziale: string | null; onChiudi: () => void }) {
  const [storia, setStoria] = useState<MessaggioTutor[]>([]);
  const [testo, setTesto] = useState("");
  const [livello, setLivello] = useState(0);
  const [pezzo, setPezzo] = useState<string | null>(pezzoIniziale);
  const [attesa, setAttesa] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const fondo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.storiaTutor(slug).then(setStoria);
  }, [slug]);
  useEffect(() => {
    setPezzo(pezzoIniziale);
  }, [pezzoIniziale]);
  // Un effetto non deve restituire niente: scrollIntoView, nel Chromium recente, restituisce una Promise.
  useEffect(() => {
    void fondo.current?.scrollIntoView({ behavior: "smooth" });
  }, [storia, attesa]);

  async function invia() {
    if (attesa || (!testo.trim() && livello === 0)) return;
    if (pezzo === "test" && livello >= 5 && !window.confirm("Se chiedi la soluzione del test, nella tua scheda resterà scritto. Vuoi continuare?")) return;
    setAttesa(true);
    setErrore(null);
    const r = await api.tutor(slug, testo.trim(), livello, pezzo, codiceIniziale);
    setAttesa(false);
    if (r.errore) {
      setErrore(r.errore);
      return;
    }
    setTesto("");
    setStoria(await api.storiaTutor(slug));
  }

  return (
    <aside className={`tutor ${aperto ? "tutor-aperto" : ""}`} aria-hidden={!aperto}>
      <header className="tutor-testa">
        <strong>Tutor</strong>
        <button type="button" className="collegamento" onClick={onChiudi}>
          Chiudi
        </button>
      </header>
      <div className="tutor-storia">
        {storia.length === 0 && <p className="tenue piccolo">Chiedi quello che vuoi su questa lezione. Se sei bloccato su un esercizio, sceglilo qui sotto: il tutor vedrà la consegna, l'ultima verifica e il tuo progetto.</p>}
        {storia.map((m) => (m.ruolo === "utente" ? <p key={m.id} className="fumetto fumetto-tu">{m.testo}</p> : <Html key={m.id} html={m.html} classe="md fumetto fumetto-tutor" />))}
        {attesa && <p className="tenue piccolo">Il tutor sta scrivendo…</p>}
        {errore && <p className="piccolo testo-errore">{errore}</p>}
        <div ref={fondo} />
      </div>
      <div className="tutor-piede">
        <div className="riga">
          <select value={pezzo ?? ""} onChange={(e) => setPezzo(e.target.value || null)} aria-label="Di cosa parli">
            <option value="">La lezione in generale</option>
            {pezzi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titolo}
              </option>
            ))}
          </select>
          <select value={livello} onChange={(e) => setLivello(Number(e.target.value))} aria-label="Quanto aiuto">
            {LIVELLI.map((l, i) => (
              <option key={i} value={i}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <textarea value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi la tua domanda" onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && void invia()} />
        <button type="button" className="pulsante" onClick={() => void invia()} disabled={attesa}>
          Invia
        </button>
      </div>
    </aside>
  );
}
