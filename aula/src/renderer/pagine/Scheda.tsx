import { useEffect, useState } from "react";
import type { FaseScheda, VoceScheda } from "../../comune/api.ts";
import { api } from "../api.ts";

const LIVELLI = ["Non la so fare", "Con molto aiuto", "Con la documentazione aperta", "Da solo", "La insegnerei"];

function Voce({ v }: { v: VoceScheda }) {
  const [livello, setLivello] = useState<number | null>(v.livello);
  const [nota, setNota] = useState(v.nota ?? "");
  const salva = (l: number | null, n: string) => void api.autovaluta(v.chiave, l, n);
  return (
    <li className="voce-scheda">
      <span>{v.testo}</span>
      <select
        value={livello ?? ""}
        onChange={(e) => {
          const l = e.target.value === "" ? null : Number(e.target.value);
          setLivello(l);
          salva(l, nota);
        }}
        aria-label="Quanto la sai fare"
      >
        <option value="">Non valutata</option>
        {LIVELLI.map((n, i) => (
          <option key={i} value={i}>
            {i} — {n}
          </option>
        ))}
      </select>
      <input type="text" value={nota} placeholder="Nota (facoltativa)" onChange={(e) => setNota(e.target.value)} onBlur={() => salva(livello, nota)} />
    </li>
  );
}

/** «Cosa so fare»: voce per voce cosa insegna il corso, cosa ha misurato l'aula e come ti valuti tu. */
export function PaginaScheda() {
  const [fasi, setFasi] = useState<FaseScheda[] | null>(null);
  const [salvato, setSalvato] = useState<string | null>(null);
  useEffect(() => {
    void api.scheda().then(setFasi);
  }, []);
  if (!fasi) return <p className="tenue">Carico…</p>;
  const esporta = async (formato: "md" | "json", fase: string | null) => setSalvato((await api.esportaScheda(formato, fase)).salvato);
  return (
    <div className="pagina">
      <h1>Cosa so fare</h1>
      <p className="tenue">Per ogni cosa che il corso insegna: cosa ha misurato l'aula e come ti valuti tu, da 0 a 4. Scaricala e dalla a Claude insieme all'idea di un gioco: saprà cosa sai già fare e cosa ti manca.</p>
      <div className="azioni">
        <button type="button" className="pulsante" onClick={() => void esporta("md", null)}>
          Scarica (Markdown)
        </button>
        <button type="button" className="pulsante pulsante-leggero" onClick={() => void esporta("json", null)}>
          Scarica (JSON)
        </button>
      </div>
      {salvato && <p className="piccolo testo-ok">Salvata in {salvato}</p>}
      {fasi.map((f) => (
        <details key={f.slug} className="fase">
          <summary>
            <span className="fase-numero">Fase {f.numero}</span>
            <span className="fase-titolo">{f.titolo}</span>
            <button type="button" className="collegamento piccolo" onClick={(e) => (e.preventDefault(), void esporta("md", f.slug))}>
              scarica la fase
            </button>
          </summary>
          <h3>Alla fine della fase</h3>
          <ul className="elenco-scheda">
            {f.voci.map((v) => (
              <Voce key={v.chiave} v={v} />
            ))}
          </ul>
          {f.lezioni.map((l) => (
            <div key={l.slug} className="lezione-scheda">
              <h4>
                {l.numero} {l.titolo}
              </h4>
              <p className="piccolo tenue">{l.misure}</p>
              <ul className="elenco-scheda">
                {l.voci.map((v) => (
                  <Voce key={v.chiave} v={v} />
                ))}
              </ul>
            </div>
          ))}
        </details>
      ))}
    </div>
  );
}
