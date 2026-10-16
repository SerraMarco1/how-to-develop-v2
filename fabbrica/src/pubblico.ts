import type { StatoPubblico } from "@htd/condiviso/pacchetto.ts";
import type { LezioneNelCorso } from "@htd/condiviso/piano.ts";
import { scriviJson } from "./archivio.ts";

// Lo stato della fabbrica scritto per l'aula (stato/aula.json): una frase su cosa sta facendo, da mostrare nella
// pagina «Oggi». Non serve a far funzionare niente: se manca o è vecchio, l'aula lo dice e basta.

export function scriviStatoPubblico(stato: StatoPubblico["stato"], messaggio: string, lezione: LezioneNelCorso | null = null, riprende: number | null = null): void {
  const dati: StatoPubblico = {
    aggiornato: new Date().toISOString(),
    stato,
    lezione: lezione ? { slug: lezione.slug, numero: lezione.numero, titolo: lezione.titolo } : null,
    messaggio: messaggio.slice(0, 600),
    riprende: riprende ? new Date(riprende).toISOString() : null,
  };
  scriviJson("stato/aula.json", dati);
}
