## Come si scrive un esercizio "prevedi" (modalità "previsioni")
Chi fa l'esercizio legge del codice e scrive cosa produrrà, senza eseguirlo. Poi la piattaforma gli mostra la risposta vera e la spiegazione.

- `modalita`: "previsioni". Niente `verifiche`, niente `soluzione.file`, niente `partenza`.
- `consegna`: una o due frasi che presentano il lavoro ("Leggi ogni pezzo di codice e scrivi cosa restituisce, senza eseguirlo").
- `previsioni`: da 4 a 6 voci, ognuna {"codice": "...", "domanda": "...", "spiegazione": "..."}.
  - `codice`: uno script GDScript COMPLETO e valido per Godot 4.7, indentato con TAB, che contiene `func run():` e RESTITUISCE con `return` il valore su cui si chiede la previsione. Può avere altre funzioni e variabili. Se serve un nodo, comincia con `extends Node2D` (o un altro nodo): la piattaforma lo aggiunge alla scena prima di chiamare `run()`.
  - La piattaforma esegue lo script due volte in Godot e prende da lì la risposta giusta: NON scriverla tu.
  - Il risultato deve essere sempre lo stesso: niente numeri casuali, niente input, niente tempo, niente lettura di file.
  - Il valore restituito è breve e si può scrivere a mano: un numero, un testo corto, vero o falso, un Vector2. Mai un Array lungo o un Dictionary.
  - `domanda`: cosa bisogna dire, con precisione ("Quanto vale `total` alla fine?", "Che testo restituisce `run()`?").
  - `spiegazione` (markdown): perché il risultato è quello, passo per passo. Viene mostrata dopo la risposta.
- Le voci vanno dalla più semplice alla più insidiosa, ognuna su una cosa diversa. Almeno due contengono il tranello tipico dell'argomento: un caso limite, l'ordine delle operazioni, un tipo che cambia il risultato, una condizione che sembra vera e non lo è.
- Usa solo ciò che la lezione ha spiegato o che è già noto.

### Esempio completo (è un modello per il FORMATO: non copiarne il contenuto)
{{esempio}}
