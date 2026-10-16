Scrivi per intero la PARTE PRATICA della lezione "{{titolo_competenza}}" del corso su Godot 4.7: tutti gli esercizi e il test finale, in una sola risposta.

## Chi fa gli esercizi
{{profilo}}

## La lezione, come sta scritta nel piano del corso
Fase: {{titolo_modulo}}
Lezione: {{titolo_competenza}}
Cosa si impara:
{{obiettivi}}
Cosa si costruisce: {{costruisci}}
Come deve essere controllato: {{verifica}}

## Il gioco della fase
{{gioco}}
Il corso fa crescere questo gioco di un passo a ogni esercizio. Il progetto dello studente si chiama `{{nome_progetto}}` e sta nella cartella `{{cartella_progetto}}`.

### I file del progetto in questo momento (prima di questa lezione)
{{progetto_attuale}}

## Parte teorica della lezione (sintesi)
{{spiegazione}}

## Cosa sa già fare (lezioni precedenti)
{{gia_insegnato}}

## Argomenti che il corso tratterà DOPO: non usarli e non richiederli
{{non_ancora}}

## Gli esercizi da scrivere, in quest'ordine
{{elenco_esercizi}}
Poi il TEST finale: {{regola_test}}

## I tipi di esercizio
Ogni esercizio ha un campo `genere`. Niente domande a crocette, mai: ogni esercizio è un lavoro che la piattaforma controlla ESEGUENDO il progetto.
- "guidato": aggiunge un pezzo al gioco seguendo i passi. `passiGuida` contiene da 4 a 10 passi precisi (dove cliccare, cosa scrivere). `suggerimenti` vuoto.
- "obiettivo": dice cosa deve succedere, non come ottenerlo. `passiGuida` vuoto; `suggerimenti` contiene 2-3 indizi graduali che non danno la soluzione.
- "trova": come "obiettivo", ma il nodo, la proprietà o il metodo che servono NON sono stati spiegati e la consegna NON li nomina: vanno cercati nella documentazione. Scrivi in `daTrovare` i nomi che vanno trovati (es. ["flip_h", "rotation_degrees"]): non devono comparire né nella consegna né nei suggerimenti. Le verifiche controllano il risultato, non come è stato ottenuto.
- "prevedi": si legge del codice e si scrive cosa produrrà. Vedi sotto "Come si scrive un esercizio prevedi".
- "ripara": lo studente riceve un progetto che non funziona, o funziona male, e lo rimette a posto. Scrivi il progetto rotto in `partenza` e quello giusto in `soluzione`. La consegna descrive i SINTOMI (cosa si vede di sbagliato), mai la causa né dove si trova l'errore. Errori veri, del tipo che un principiante commette, coerenti con ciò che la lezione insegna.
- "estendi": lo studente riceve un progetto che funziona, scritto da un'altra persona (altri nomi, altro stile, ordinato), e deve aggiungere una funzione senza rompere il resto. `partenza` è il progetto ricevuto, `soluzione` quello con la funzione in più. Le verifiche controllano sia la funzione nuova sia ciò che funzionava già.
- "riordina": lo studente riscrive un codice che funziona ma è fatto male, senza cambiarne il comportamento. Le verifiche controllano (a) che il comportamento sia quello di prima e (b) COME è scritto il codice, con le funzioni `longest_function_lines`, `untyped_declarations`, `magic_numbers`, `count_in_code`, `has_function` della base di verifica.
- "imita": la consegna descrive con precisione un risultato (posizioni, colori, misure, tempi) e lo studente deve ottenere lo stesso. Le verifiche confrontano i valori, con una piccola tolleranza.
- "dati": lo studente scrive dei dati nel formato del gioco (un livello, una tabella, una storia). Le verifiche caricano quei dati nel gioco e li usano.
- "da-zero": una tappa del progetto di fine fase. Lo studente parte da un progetto vuoto (o da ciò che ha lasciato la tappa prima) e decide da solo scene, script e struttura. La consegna elenca cosa deve FARE il gioco alla fine della tappa, come un elenco di requisiti, e fissa solo i nomi che le verifiche devono trovare. `passiGuida` e `suggerimenti` vuoti. Le verifiche giocano il gioco: tengono premuti i tasti, fanno passare il tempo, controllano ciò che succede.

## Dove si lavora: campo `dove`
- "gioco": l'esercizio prosegue il gioco della fase. È il caso normale per "guidato", "obiettivo", "trova", "imita", "dati". Regole:
  - `soluzione.file` contiene SOLO i file che l'esercizio aggiunge o cambia, ognuno per intero. I file che non cambiano non vanno riscritti: la piattaforma li prende dallo stato precedente. Per togliere un file scrivine il percorso in `soluzione.rimossi`.
  - `soluzione.progetto` contiene solo le impostazioni che l'esercizio aggiunge (una nuova azione di input, la scena principale se cambia). Il nome del progetto non si tocca.
  - Ogni esercizio parte dal risultato del precedente: il secondo esercizio trova il gioco come lo ha lasciato la soluzione del primo, il test come lo ha lasciato l'ultimo esercizio.
  - Non rompere ciò che c'è: nomi di nodi, file e funzioni già presenti restano quelli, a meno che l'esercizio chieda proprio di cambiarli.
- "a-parte": un progetto separato. È il caso normale per "ripara" ed "estendi", e per "riordina" quando si riceve un codice scritto apposta male. `partenza` contiene il progetto da cui si parte (tutti i suoi file e le sue impostazioni), `soluzione` il progetto finito (tutti i file). Senza `partenza` il progetto si crea da zero.

{{istruzioni_progetto}}

Ricorda: le istruzioni qui sopra descrivono un progetto scritto per intero. Per un esercizio `dove: "gioco"` vale ciò che è detto prima: in `soluzione.file` solo i file aggiunti o cambiati, e in `soluzione.progetto` solo le impostazioni nuove.

{{istruzioni_ambiente}}

## Come si scrive un esercizio "prevedi"
- `modalita`: "previsioni". Niente `verifiche`, niente `soluzione.file`.
- `previsioni`: da 4 a 6 voci, ognuna {"codice": "...", "domanda": "...", "spiegazione": "..."}.
  - `codice`: uno script GDScript completo che contiene `func run():` e RESTITUISCE il valore su cui si chiede la previsione. La piattaforma lo esegue davvero in Godot 4.7 e prende da lì la risposta giusta: NON scrivere la risposta, non serve e non verrebbe usata.
  - Il codice usa solo ciò che la lezione ha spiegato o che è già noto. Niente numeri casuali, niente input, niente tempo: il risultato deve essere sempre lo stesso.
  - Lo script deve bastare a sé stesso: usa solo le variabili e le funzioni che dichiara lui. Un nodo creato con `.new()` (per esempio `Sprite2D.new()`) NON ha le variabili del tuo script, e usarle interrompe l'esecuzione. Per far vedere cosa fa una funzione che Godot chiama da solo (`_process(delta)`, `_ready()`), chiamala tu dentro `run()` con i valori che scegli: `_process(0.5)`, due volte se serve.
  - Il valore restituito è semplice: un numero, un testo, vero/falso, un Vector2. Mai un Array lungo o un Dictionary.
  - `domanda`: cosa bisogna dire, in modo preciso ("Quanto vale `x` alla fine?", "Che testo restituisce la funzione?").
  - `spiegazione`: perché il risultato è quello, passo per passo. Si vede dopo aver risposto.
  - Le voci vanno dalla più semplice alla più insidiosa, e ognuna mette alla prova una cosa diversa. Almeno due devono contenere il tranello tipico di questo argomento (un caso limite, un ordine delle operazioni, un tipo che cambia il risultato).
- `consegna`: una o due frasi: "Leggi ogni pezzo di codice e scrivi cosa restituisce, senza eseguirlo".

## Regole per ogni esercizio
- `consegna` (markdown): dice ESATTAMENTE cosa creare, con i nomi precisi di file, nodi, funzioni, azioni di input e valori. Tutto ciò che le verifiche controllano deve essere scritto in chiaro nella consegna: un nome non si può indovinare. (Per "trova" valgono i nomi di file e nodi, non quelli da cercare.)
- Chiedi solo cose spiegate nella teoria di questa lezione o già note. Niente che compaia tra gli argomenti che il corso tratterà DOPO.
- NON BANALE. Un esercizio che si risolve ricopiando un blocco della teoria o un esempio non insegna niente. Dopo il "guidato", ogni esercizio chiede di usare l'idea della lezione in una situazione che la teoria NON ha mostrato così com'è: un altro oggetto, un altro valore limite, due cose insieme, il caso al bordo. La consegna non deve contenere la soluzione sotto forma di descrizione riga per riga.
- Le verifiche devono FALLIRE prima che il lavoro sia fatto e PASSARE dopo. La piattaforma le esegue sul progetto di partenza (devono fallire) e sulla soluzione (devono passare): se passano anche prima, l'esercizio viene rifiutato.
- Le verifiche controllano il COMPORTAMENTO (cosa succede eseguendo il gioco, tenendo premuti i tasti, facendo passare il tempo), non come è scritto il codice. Ogni esercizio che riguarda qualcosa che si muove, reagisce o calcola ha una verifica `script_godot`. Le verifiche sul testo del codice (`testo_in_file`) si usano solo se la lezione insegna proprio quella parola chiave.
- Niente valori esatti fragili: per un movimento confronta prima e dopo; per un tempo usa una tolleranza.
- La consegna dà del tu a chi fa l'esercizio e parla solo del lavoro da fare: non nomina altri esercizi, non parla di correzioni o versioni precedenti, non chiede screenshot.
- `soluzione.spiegazione` (markdown): spiega passo passo come si arriva alla soluzione e perché.
- Testi in italiano; codice e nomi in inglese.

## Il test
- È un lavoro dello stesso genere degli esercizi, fatto senza aiuto: `passiGuida` vuoto, `suggerimenti` con al massimo un indizio leggero.
- Chiede di usare ciò che la lezione ha insegnato in una situazione nuova rispetto agli esercizi: non una loro copia con i nomi cambiati.
- Se è `dove: "gioco"` aggiunge al gioco l'ultimo pezzo di questa lezione; la lezione successiva partirà da lì.

## Formato della risposta (JSON)
{"esercizi": [ESERCIZIO, ...], "test": ESERCIZIO}

dove ESERCIZIO è:
{"genere": "...", "dove": "gioco" | "a-parte", "titolo": "...", "consegna": "...", "modalita": "progetto" | "ambiente" | "previsioni", "passiGuida": ["..."], "suggerimenti": ["..."], "daTrovare": ["..."], "verifiche": [ ... ], "previsioni": [ ... ], "partenza": {"progetto": { ... }, "file": [ ... ]}, "soluzione": {"progetto": { ... }, "file": [{"percorso": "...", "contenuto": "..."}], "rimossi": [], "spiegazione": "..."}}

I campi che non servono si omettono (per esempio `partenza` quando `dove` è "gioco", `previsioni` quando non è un "prevedi").

Rispondi con SOLO il JSON.
