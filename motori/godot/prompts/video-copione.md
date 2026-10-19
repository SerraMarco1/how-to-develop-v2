Scrivi il COPIONE del video «Il risultato atteso» per un esercizio del corso su Godot 4.7. Il video sta nell'esercizio, sotto la consegna: mostra a chi studia cosa deve vedere quando avvia il gioco dopo aver fatto l'esercizio, così può confrontarlo con il suo. Viene registrato eseguendo la soluzione in Godot, con le tue scritte sopra; Godot misura ogni fotogramma e il video si pubblica solo se le misure confermano il copione.

## L'esercizio
Titolo: {{titolo}}
Genere: {{genere}}
Consegna:
{{consegna}}
{{passi}}

## Il progetto dopo l'esercizio (la soluzione)
Schermo del gioco: {{schermo}} pixel. (0, 0) è l'angolo in alto a sinistra, y cresce verso il basso.
Scena principale (si avvia con F5): {{scena_principale}}
Azioni di input: {{azioni}}
File che l'esercizio aggiunge o cambia: {{cambiati}}

{{progetto}}

## Cosa deve mostrare il video
- Il RISULTATO di questo esercizio: ciò che dopo il lavoro si vede e prima no (nodi nuovi che compaiono, qualcosa che si muove, cambia colore o dimensione, mostra un testo). Non ciò che c'era già: il copione viene provato anche sul progetto com'era prima dell'esercizio, e se passa anche lì il video viene scartato.
- I soggetti sono ciò che l'esercizio chiede di costruire o cambiare: in un esercizio sui contenitori i contenitori, non solo il titolo della schermata.
- La scena in cui il risultato si vede: la principale (F5) se si vede lì, altrimenti la scena che l'esercizio crea o cambia (`star.tscn`, `hud.tscn`, `main_menu.tscn`…), che chi studia apre e avvia con F6. Sotto il video l'aula scrive come avviarla.
- La finestra del gioco così com'è, la stessa che vedrà chi studia: niente camera spostata, niente nodi aggiunti.

## Il copione
- `scena`: il file della scena da avviare (`res://…`).
- `durata`: da 6 a 12 secondi.
- `azioni`: solo se l'esercizio usa la tastiera. `azione` è il nome di un'azione di input del progetto; `inizio` e `fine` in secondi; `tasto` è il tasto da mostrare sullo schermo ("D", "Freccia destra", "Spazio").
- `soggetti` (da 1 a 3): i nodi di cui parla il video, che Godot misura e circonda con un riquadro giallo.
  - `id`: un nome breve in minuscolo (`stelle`).
  - `cerca`: come trovare quei nodi nella scena in esecuzione. `scena` = i nodi creati da quel file `.tscn` (anche con `instantiate()`); `script` = i nodi con quello script; `nome` = il nome del nodo (accetta `*`); `gruppo`; `classe` = una classe di Godot o un `class_name`. Con più criteri, il nodo deve soddisfarli tutti. I nodi creati con `new()` hanno nomi automatici (`@Sprite2D@2`): per quelli usa `scena`, `script` o `classe`.
  - `quanti`: quanti di quei nodi devono vedersi insieme (almeno).
  - `da`, `a`: l'intervallo in secondi in cui il soggetto deve vedersi come dici, lungo almeno mezzo secondo. Calcolalo dal codice: `_ready()` avviene a 0 s; un nodo che parte da y = 80 e scende di 180 pixel al secondo esce da uno schermo alto 648 dopo circa 3 secondi; un nodo figlio si sposta insieme al genitore e la sua `position` si somma a quella del genitore.
  - `deve`: `"esserci"` (si vede), `"muoversi"` (si sposta di almeno 24 pixel), `"comparire"` (all'inizio dell'intervallo non si vede, alla fine sì), `"sparire"` (il contrario), `"cambiare colore"` (cambia `modulate`), `"cambiare dimensione"` (diventa almeno il 15% più grande o più piccolo, per esempio con un Tween su `scale`), `"mostrare testo"` (una Label o un Button mostra `testo`, che va scritto: basta una parte, per esempio "Punti: 10").
  - `etichetta`: il nome in italiano scritto accanto al riquadro ("Stella", "Punteggio").
  - «Si vede» vuol dire: almeno l'80% del suo rettangolo dentro lo schermo, non nascosto, non trasparente, per almeno l'80% dell'intervallo (metà, per "mostrare testo").
- `scritte` (da 1 a 3): cosa guardare, in italiano corretto con gli accenti (è, più, perché), al massimo 80 caratteri ciascuna. Si vedono una alla volta: due scritte non si sovrappongono nel tempo (metti la seconda dopo la fine della prima). Ognuna è legata a un soggetto (`soggetto` = il suo `id`) e sta dentro il suo intervallo. Dì cosa succede e perché conta per l'esercizio ("Il ciclo for crea 5 stelle, una accanto all'altra"); numeri solo se veri (presi dal codice). Niente saluti, niente codice.

## Quando il video non si fa
Rispondi `{"video": false, "perche": "…"}` se il risultato dell'esercizio non compare sullo schermo in nessuna scena: si legge solo nel pannello Output, il gioco si comporta come prima (l'esercizio riordina il codice), cambia un valore che non si vede, oppure i nodi che l'esercizio crea stanno fuori dallo schermo (calcola le loro posizioni dal codice). Una scena che non è la principale non è un motivo: si avvia con F6.
{{correzione}}
## Formato della risposta (JSON)
{"video": true, "scena": "res://star.tscn", "durata": 8, "azioni": [], "soggetti": [{"id": "stella", "cerca": {"scena": "res://star.tscn"}, "quanti": 1, "da": 0.5, "a": 3, "deve": "muoversi", "etichetta": "Stella"}], "scritte": [{"testo": "La stella scende di 180 pixel al secondo", "da": 0.5, "a": 3, "soggetto": "stella"}]}

Rispondi con SOLO il JSON.
