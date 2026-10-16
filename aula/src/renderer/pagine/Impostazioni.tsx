import { useEffect, useState } from "react";
import type { Impostazioni } from "../../comune/api.ts";
import { api } from "../api.ts";

const FORNITORI = [
  { id: "groq" as const, nome: "Groq", dove: "https://console.groq.com/keys", nota: "Gratuito, non usa i tuoi dati per addestrare i modelli. È il primo che il tutor prova." },
  { id: "mistral" as const, nome: "Mistral", dove: "https://console.mistral.ai/api-keys", nota: "Gratuito; con l'addestramento spento nella sua console (Privacy → Anonymous improvement data) non usa i tuoi dati." },
  { id: "gemini" as const, nome: "Google Gemini", dove: "https://aistudio.google.com/apikey", nota: "Gratuito ma nel piano gratuito può usare i dati: il tutor lo usa solo se gli altri non rispondono, e solo con Flash-Lite." },
];

/** Le poche impostazioni che servono a chi studia: cartella dei progetti, chiavi del tutor, dati della versione 1. */
export function PaginaImpostazioni({ onCambia }: { onCambia: () => void }) {
  const [i, setI] = useState<Impostazioni | null>(null);
  const [chiavi, setChiavi] = useState<Record<string, string>>({});
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [importo, setImporto] = useState(false);
  const carica = () => void api.impostazioni().then(setI);
  useEffect(() => {
    carica();
  }, []);
  if (!i) return <p className="tenue">Carico…</p>;

  async function salva(f: "groq" | "mistral" | "gemini", valore: string) {
    const r = await api.salvaChiave(f, valore.trim());
    setMessaggio(r.ok ? (valore.trim() ? "Chiave salvata (cifrata da Windows con il tuo account)." : "Chiave tolta.") : (r.errore ?? "Non salvata"));
    setChiavi({ ...chiavi, [f]: "" });
    carica();
    onCambia();
  }

  return (
    <div className="pagina">
      <h1>Impostazioni</h1>

      {(
        <section className="scheda">
          <h2>Dati della versione 1</h2>
          {i.datiImportati ? (
            <p className="tenue">Importati il {i.datiImportati}.</p>
          ) : (
            <>
              <p>
                Se hai usato la versione precedente, puoi portare qui progressi, tentativi, chat con il tutor, ripasso, scheda «Cosa so fare», cartella dei progetti e chiavi del tutor. Premi Importa e scegli il suo database: <code>data\how-to-develop.db</code> nella cartella della versione 1. Viene solo letto.
              </p>
              <button
                type="button"
                className="pulsante"
                disabled={importo}
                onClick={async () => {
                  setImporto(true);
                  const r = await api.importaVersione1();
                  setImporto(false);
                  if (r.riepilogo) setMessaggio(r.riepilogo);
                  carica();
                  onCambia();
                }}
              >
                {importo ? "Importo…" : "Importa"}
              </button>
            </>
          )}
        </section>
      )}

      <section className="scheda">
        <h2>Cartella dei progetti</h2>
        <p className="tenue piccolo">Qui stanno i progetti Godot degli esercizi: una cartella per fase e una per i giochi che crescono di lezione in lezione.</p>
        <p>
          <code>{i.cartellaProgetti}</code>
        </p>
        <div className="azioni">
          <button type="button" className="pulsante pulsante-leggero" onClick={() => void api.scegliCartellaProgetti().then(() => (carica(), onCambia()))}>
            Cambia cartella
          </button>
          <button type="button" className="pulsante pulsante-leggero" onClick={() => void api.apriCartella(i.cartellaProgetti)}>
            Apri
          </button>
        </div>
      </section>

      <section className="scheda">
        <h2>Chiavi del tutor</h2>
        <p className="tenue piccolo">Servono al tutor, all'analisi del tuo codice e alle spiegazioni alternative. Restano su questo PC, cifrate. Le lezioni le scrive la fabbrica con le sue chiavi, che stanno su GitHub.</p>
        {FORNITORI.map((f) => (
          <div key={f.id} className="campo">
            <label htmlFor={`chiave-${f.id}`}>
              {f.nome} {i.chiavi[f.id] ? <span className="etichetta etichetta-ok">presente</span> : <span className="etichetta">manca</span>}
            </label>
            <div className="riga">
              <input id={`chiave-${f.id}`} type="password" autoComplete="off" value={chiavi[f.id] ?? ""} placeholder={i.chiavi[f.id] ? "Scrivi per sostituirla" : "Incolla qui la chiave"} onChange={(e) => setChiavi({ ...chiavi, [f.id]: e.target.value })} />
              <button type="button" className="pulsante pulsante-leggero" disabled={!chiavi[f.id]?.trim()} onClick={() => void salva(f.id, chiavi[f.id] ?? "")}>
                Salva
              </button>
              {i.chiavi[f.id] && (
                <button type="button" className="pulsante pulsante-leggero" onClick={() => window.confirm(`Togliere la chiave di ${f.nome}?`) && void salva(f.id, "")}>
                  Togli
                </button>
              )}
            </div>
            <span className="aiuto">
              {f.nota}{" "}
              <button type="button" className="collegamento" onClick={() => void api.apriLink(f.dove)}>
                Dove si crea
              </button>
            </span>
          </div>
        ))}
      </section>

      {messaggio && <p className="nota">{messaggio}</p>}
      <p className="piccolo tenue">How to Develop {i.versione}</p>
    </div>
  );
}
