## Come si scrive un esercizio in modalità "ambiente"
Non c'è niente da consegnare: chi fa l'esercizio compie un'azione in Godot, poi preme Verifica e la piattaforma guarda da sola lo stato di Godot sul PC. Si usa quando non c'è ancora un progetto su cui lavorare.

- `consegna`: cosa fare, e in che stato lasciare Godot prima di premere Verifica (per esempio "lascia aperta la finestra del Project Manager"). Deve dire in chiaro tutto ciò che le verifiche controllano.
- `verifiche`: da 1 a 3, SOLO di questi tipi. Ognuna ha una `descrizione` in italiano che dice cosa viene controllato.
  - {"tipo": "godot_aperto", "descrizione": "..."} — è aperto Godot 4.7 in edizione standard (non l'edizione .NET).
  - {"tipo": "godot_aperto", "finestra": "project_manager", "descrizione": "..."} — in più, la finestra aperta è il Project Manager.
  - {"tipo": "godot_aperto", "finestra": "editor", "descrizione": "..."} — in più, è aperto l'editor su un progetto qualsiasi.
  - {"tipo": "impostazione_editor", "chiave": "...", "contiene": "...", "descrizione": "..."} — un'impostazione di Editor → Editor Settings ha il valore indicato. Chiavi utilizzabili (solo queste; `contiene` deve essere diverso dal valore predefinito):
{{impostazioni_editor}}
- `domande` vuoto. `soluzione.file` vuoto e niente `soluzione.progetto`. `soluzione.spiegazione`: i passaggi per arrivare al risultato.
- Non chiedere screenshot, non chiedere di scrivere risposte: la verifica è automatica.

### Esempio completo (è un modello per il FORMATO: non copiarne il contenuto)
{{esempio}}
