Scrivi la PARTE TEORICA della lezione indicata del corso su Godot 4.7.

## Chi legge la lezione
{{profilo}}

## Lezione da scrivere
Modulo: {{titolo_modulo}}
Competenza: {{titolo_competenza}} ({{tipo_competenza}})
Descrizione: {{descrizione_competenza}}
Obiettivi:
{{obiettivi}}
Cosa si costruisce in questa lezione: {{costruisci}}

## Il gioco della fase
{{gioco}}
Ogni lezione fa fare un passo a questo gioco, e gli esercizi (scritti dopo) lo faranno crescere davvero. Gli esempi della teoria devono riguardare QUESTO gioco e partire dal progetto com'è adesso: stessi nomi di file, nodi, variabili e funzioni. Non inventare un altro progetto di esempio.

### I file del progetto «{{nome_progetto}}» in questo momento
{{progetto_attuale}}

## Cosa ha già imparato (lezioni precedenti)
{{gia_insegnato}}

## Argomenti che il corso tratterà DOPO: non spiegarli qui e non darli per noti
{{non_ancora}}

## Indicazioni per questo modulo
{{note_modulo}}

## Estratti della documentazione ufficiale di Godot 4.7
{{documentazione}}

## Immagini vere dell'editor che puoi mostrare
Sono schermate catturate dal vero Godot 4.7. Le descrizioni dicono cosa si vede davvero: quando parli di quella parte dell'editor, usa gli stessi nomi.
{{immagini}}

## REGOLE INTERNE (servono a te per non sbagliare: NON vanno ricopiate nella lezione)
Qui sotto ci sono le convenzioni del corso e un elenco di fatti verificati. Usali per controllare ciò che scrivi. Non riportarli nella lezione come elenco, come riquadri o parola per parola: la lezione spiega solo ciò che serve ai SUOI obiettivi, con parole sue, nel punto in cui serve. Un fatto che riguarda un'altra lezione (un altro pannello, un'altra procedura) qui non va scritto.

{{stile}}

## Come si costruisce la lezione
La lezione è un percorso unico, da leggere dall'inizio alla fine: ogni blocco prepara il successivo.
1. Apri con un blocco `testo`: a cosa serve questo argomento quando si fa un gioco, con un esempio concreto. Niente presentazioni generiche di Godot (tranne nella primissima lezione del corso).
2. Per ogni obiettivo, in ordine: prima un blocco `testo` che spiega l'idea e i termini nuovi, poi (se c'è qualcosa da fare) un blocco `passi` con le azioni nell'editor oppure un blocco `codice`, poi — solo se serve — un `testo` che dice cosa si deve vedere come risultato.
3. Chiudi con UN blocco `riepilogo`: da 3 a 6 punti brevi con ciò che bisogna ricordare.

Regole:
- TUTTA la spiegazione sta nei blocchi `testo`, `passi` e `codice`. Non esistono "note": un'informazione o fa parte della spiegazione, nel punto in cui serve, o non va scritta.
- `attenzione` è l'unico riquadro, e serve solo per UN errore che si commette davvero in quel punto ("se premi F5 senza una scena principale, Godot chiede di sceglierla"). Al massimo 2 in tutta la lezione, spesso nessuno. Va messo subito dopo il blocco a cui si riferisce.
- Ogni cosa si dice UNA volta sola. Non ripetere in un secondo blocco ciò che un blocco ha già detto; il `riepilogo` è l'unico punto in cui si riprende, in breve.
- Dai del tu a chi legge ("apri", "vedrai", "scrivi"). Non scrivere mai "lo studente".
- Resta dentro l'argomento di QUESTA lezione: insegna gli obiettivi indicati, non quelli delle lezioni successive.
- Usa SOLO concetti già insegnati o spiegati in questa lezione. Ogni termine tecnico nuovo va spiegato la prima volta.
- Chi legge affronta ogni lezione da zero: non fare paragoni con altri motori, programmi o linguaggi (Unity, Unreal, C#…) e non dare per noto niente che questo corso non abbia già insegnato. Il profilo qui sopra serve a scegliere il tono e gli esempi, non a saltare spiegazioni.
- Nei `passi`: un'azione per passo, con il nome esatto di ciò che si clicca (menu, pannello, pulsante) come appare nell'editor in inglese. Usa solo nomi che trovi negli estratti della documentazione, nelle descrizioni delle immagini o nelle regole interne: non inventare pulsanti. Se non conosci il nome esatto di un pulsante, descrivi dove si trova invece di inventarne uno.
- Per ogni blocco `codice` spiega le righe importanti nel campo `spiegazione`. Il codice deve essere completo e funzionante in Godot 4.7: verrà copiato.
- Se serve un'immagine di prova dentro un progetto usa `res://icon.svg`, che c'è in ogni progetto.
- Blocchi `immagine`: al massimo 3, solo tra quelle elencate sopra (campo `immagine` = il suo id) e solo dove il testo parla proprio di ciò che l'immagine mostra. Mettila subito dopo il blocco che la introduce. `didascalia`: una frase che dice cosa guardare.
- Niente domande o quiz: in questo corso non esistono domande a crocette.
- Spiega il PERCHÉ, non solo il come. Per ogni idea nuova: a cosa serve, cosa succederebbe senza, qual è l'errore che si fa di solito. Chi legge vuole basi solide, non una ricetta da ricopiare.
- La teoria mostra l'idea su UN esempio, quello che il primo esercizio (guidato) ripercorrerà. Non risolvere in anticipo le varianti e i casi limite: sono il lavoro degli esercizi successivi, e devono restare da pensare.
- Lunghezza: da 7 a 13 blocchi, ognuno breve (un blocco `testo` sta in 2-5 frasi). Meglio una lezione corta e chiara che una lunga.
- `sommario`: 2-3 frasi su cosa insegna la lezione (servirà alle lezioni successive).
- `concetti`: elenco dei concetti, classi, metodi e procedure introdotti (brevi).

## Tipi di blocco disponibili
- {"tipo": "testo", "md": "markdown"}
- {"tipo": "passi", "titolo": "Cosa si ottiene con questi passi", "passi": ["Nel pannello *Scene* premi **+**…", "…"]}
- {"tipo": "codice", "linguaggio": "gdscript", "codice": "...", "spiegazione": "markdown"}
- {"tipo": "attenzione", "md": "markdown: l'errore tipico e come evitarlo"}
- {"tipo": "immagine", "immagine": "id-del-catalogo", "didascalia": "..."}
- {"tipo": "riepilogo", "md": "- primo punto\n- secondo punto\n- terzo punto"}

## Formato della risposta (JSON)
{"titolo": "...", "sommario": "...", "concetti": ["..."], "obiettivi": ["..."], "durataMinuti": 45, "blocchi": [ ... ]}
