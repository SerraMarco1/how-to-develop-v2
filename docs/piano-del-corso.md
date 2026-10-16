# Imparare a fare videogiochi con Godot 4.7

> Piano del corso, versione 2. Questo documento è generato da `motori/godot/corso` con `npm run piano`: per cambiarlo si modificano quei file. I numeri delle lezioni sono quelli che mostra l'aula.

**12 fasi · 142 lezioni · 37 tappe di progetto · 224 ore**, più 9 rami facoltativi (93 ore).

## Il traguardo

Alla fine prendi in mano Godot e realizzi ciò che vuoi: sai programmare un gioco intero in GDScript, in 2D e in 3D, sai trovare e adattare gli asset che ti servono, e quando incontri qualcosa che non conosci sai dove cercare e come arrivare alla soluzione.

**Come si misura**

- Ogni fase finisce con un gioco costruito da solo, partendo da un progetto vuoto, con la sola documentazione: se lo porti in fondo, la fase è imparata.
- Tre giochi completi, finiti ed esportati: una visual novel, un gioco a piattaforme, un gioco 3D. Poi un gioco tuo.
- La piattaforma controlla ogni esercizio eseguendo il progetto: preme i tasti, clicca i pulsanti e guarda cosa succede.

## Le regole del corso

- Si parte da zero: nessuna conoscenza data per scontata, nemmeno di programmazione o di matematica.
- La programmazione si impara vedendo il risultato sullo schermo, non stampando numeri: ogni concetto entra quando il gioco ne ha bisogno.
- Dentro una fase si lavora sullo stesso gioco, che cresce di un passo a ogni lezione. Ogni lezione parte dal gioco com'era alla fine della precedente.
- In ogni lezione la guida cala: il primo esercizio è accompagnato, i successivi dicono solo il risultato da ottenere, il test si fa senza aiuto.
- Le lezioni di metodo insegnano a cavarsela: leggere la documentazione, leggere gli errori, fare debug, scomporre un problema, imparare da soli un argomento nuovo.
- Gli asset si usano, si cercano e si adattano; non si disegnano e non si compongono.
- Una sola lingua, GDScript, sempre con i tipi dichiarati. Editor, codice e nomi in inglese; spiegazioni in italiano.
- Il piano può adattarsi: se un test ti riesce a fatica, il sistema può aggiungere una lezione di rinforzo prima di proseguire. Non toglie e non riordina lezioni.

## Il corso in una pagina

| | Fase | Ore | Il gioco che cresce | La prova, da un progetto vuoto |
|---|---|---|---|---|
| 0 | [Orientamento](#fase-0--f00-orientamento) | 3 | Nessun gioco ancora: una scena che parte. | — |
| 1 | [Programmare da zero, vedendo il risultato](#fase-1--f01-programmare) | 20,5 | «Pioggia di stelle»: muovi un cesto a destra e a sinistra, prendi le stelle che cadono, eviti i sassi. Tre vite, difficoltà che cresce, fine partita e nuova partita. | «Schiva!», da un progetto vuoto: una navicella si muove in quattro direzioni, i meteoriti arrivano sempre più fitti, il punteggio è il tempo di sopravvivenza, con record della sessione e nuova partita. |
| 2 | [Il modo di Godot: nodi, scene e segnali](#fase-2--f02-nodi-scene-segnali) | 15,8 | «Pioggia di stelle», ricostruito con scene e segnali e arricchito: ondate, potenziamenti, un pulsante per ricominciare, piccole animazioni. | «Memory», da un progetto vuoto: una griglia di carte coperte create dal codice, due alla volta si girano, le coppie restano scoperte, le altre si ricoprono dopo un attimo. Contatore delle mosse, vittoria, nuova partita, tre grandezze di griglia. |
| 3 | [Interfaccia: menu, schermate e più scene](#fase-3--f03-interfaccia) | 13,8 | «Pioggia di stelle» diventa un gioco con un inizio e una fine: menu principale, punteggio e vite in sovrimpressione, pausa, schermata finale con il record. | «Quiz», da un progetto vuoto: menu, domande con quattro risposte prese da una tabella di dati, tempo per rispondere mostrato da una barra, schermata dei risultati, tutto usabile anche solo con la tastiera. |
| 4 | [Programmare meglio: classi, dati, file](#fase-4--f04-programmare-meglio) | 15,3 | «Quiz» cresce da dentro: le domande diventano file di dati, i record si salvano su disco, il codice si divide in classi con un compito ciascuna. | «Avventura testuale», da un progetto vuoto: stanze, uscite e oggetti descritti in un file JSON; ci si muove e si raccolgono oggetti con dei pulsanti; alcune uscite chiedono un oggetto; la partita si salva e si ricarica. Cambiando il file cambia l'avventura, senza toccare il codice. |
| 5 | [Asset e audio: trovarli, adattarli, usarli](#fase-5--f05-asset-e-audio) | 11,8 | «Quiz» e «Pioggia di stelle» ricevono grafica, font, suoni e musica veri, scelti da te. | «Rivesti il tuo gioco»: prendi uno dei tuoi giochi e gli dai un aspetto e un suono completi con asset trovati da te, un menu dei volumi che si ricorda le scelte e una schermata dei crediti con autori e licenze. |
| 6 | [Visual novel: il primo gioco completo](#fase-6--f06-visual-novel) | 35 | «Storie»: un motore per visual novel con una storia di esempio. Cresce di un sistema a ogni lezione, e ogni sistema resta separato dagli altri. | «La tua visual novel»: una storia tua di almeno dieci minuti, con almeno due finali che dipendono dalle scelte, asset trovati da te, salvataggi, impostazioni, e tre funzioni che aggiungi al motore da solo. Esportata per Windows e per il Web. |
| 7 | [2D d'azione: movimento, fisica, livelli, nemici](#fase-7--f07-azione-2d) | 21,3 | «Il custode»: un'avventura vista dall'alto. Stanze con muri, chiavi e porte, nemici che pattugliano e inseguono, cuori, proiettili, livelli a tessere, punto di salvataggio. | «Arena», da un progetto vuoto: nemici in ondate sempre più dure, si mira e si spara, i nemici lasciano esperienza, tra un'ondata e l'altra si sceglie un potenziamento tra tre, fine partita con record salvato. |
| 8 | [Piattaforme: animazione, stati, sensazione](#fase-8--f08-piattaforme) | 21,8 | «Salti»: un personaggio animato che corre e salta, piattaforme mobili, pericoli, nemici, punti di ripartenza, tre livelli a tessere con sfondi in profondità, effetti e suoni, menu e salvataggio dei livelli sbloccati. | «Il tuo gioco a piattaforme», da un progetto vuoto: tre livelli brevi, asset trovati da te, una meccanica in più scelta da un elenco (scatto, doppio salto, salto sul muro, interruttori e piattaforme, gravità invertita), menu, salvataggio, esportazione. |
| 9 | [3D: le basi](#fase-9--f09-3d-basi) | 20,8 | «L'isola»: un personaggio in terza persona cammina, corre e salta su un'isola costruita a blocchi, raccoglie cristalli, apre passaggi, spinge oggetti. Con modelli e animazioni importati. | «Percorso a ostacoli», da un progetto vuoto: un percorso 3D in terza persona con piattaforme mobili, oggetti da raccogliere, punti di ripartenza, tempo, schermata d'arrivo. Modelli trovati da te. |
| 10 | [3D: un gioco completo](#fase-10--f10-3d-gioco) | 21,3 | «Il faro»: un'avventura d'esplorazione in 3D. Giri un'isola, parli con chi ci abita usando il tuo motore dei dialoghi, raccogli e usi oggetti, risolvi enigmi per riaccendere il faro, eviti le creature che di notte pattugliano. | «Il tuo gioco 3D», da un progetto vuoto, a scelta tra tre tracce: esplorazione con dialoghi, arena d'azione, enigmi in prima persona. Asset trovati da te, menu, salvataggi, impostazioni grafiche, esportazione. |
| 11 | [Il tuo gioco](#fase-11--f11-il-tuo-gioco) | 24 | Il tuo. | Il gioco finito: giocabile dall'inizio alla fine, con menu, salvataggi, impostazioni, asset con i loro crediti, provato da almeno un'altra persona, esportato e pronto per la pubblicazione. |

## I tipi di esercizio

Ogni lezione dichiara quali tipi di esercizio usa. Sono tutti lavori pratici, controllati eseguendo il progetto: non esistono domande a crocette. Il test di una lezione è sempre uno di questi lavori, fatto senza aiuto.

| Tipo | Cosa fai | Cosa allena | In quante lezioni |
|---|---|---|---|
| **Costruisci, accompagnato** | Aggiungi un pezzo al gioco seguendo i passi. È sempre il primo esercizio su un argomento nuovo, mai l'unico. | Fare la cosa nuova una prima volta, senza perdersi. | 83 |
| **Costruisci, dato il risultato** | Ti viene detto cosa deve succedere, non come ottenerlo. | Passare da una richiesta al codice: è il lavoro di tutti i giorni. | 118 |
| **Prevedi** | Leggi un pezzo di codice o una scena e scrivi cosa succederà (un valore, un testo, una posizione) prima di eseguirlo. Poi la piattaforma lo esegue e confronta. | Leggere il codice e simularlo a mente: senza questo non si trova nessun errore. | 21 |
| **Ripara** | Ricevi un progetto che non funziona, o funziona male, e lo rimetti a posto. A volte gli errori fermano il gioco, a volte lo fanno solo sbagliare. | Il debug: leggere gli errori, restringere il campo, verificare un'ipotesi. | 21 |
| **Estendi il codice di un altro** | Ricevi un progetto che funziona, scritto da altri, e aggiungi una funzione. I controlli di prima vengono rifatti: niente deve rompersi. | Leggere e capire codice non tuo, e modificarlo con rispetto. | 12 |
| **Riordina** | Riscrivi un codice che funziona ma è fatto male, senza cambiarne il comportamento. I controlli di comportamento devono passare prima e dopo. | Dare struttura: è ciò che distingue un programma che cresce da uno che crolla. | 11 |
| **Trova nella documentazione** | Devi ottenere un risultato che la lezione non spiega: il nodo, la proprietà o il metodo giusto vanno cercati. | Cavarsela davanti a ciò che non conosci. | 13 |
| **Collauda** | Scrivi tu i controlli. La piattaforma li esegue contro una versione giusta e alcune versioni sbagliate: devono promuovere solo la giusta. | Pensare ai casi che rompono un programma, prima che lo trovi un giocatore. | 7 |
| **Rendi veloce** | Ricevi un progetto che va a scatti. Misuri, trovi la causa, lo sistemi. La piattaforma misura prima e dopo. | Misurare invece di indovinare. | 2 |
| **Scrivi i dati** | Produci contenuto nel formato del gioco: una storia, un livello, una tabella di nemici. La piattaforma lo controlla e lo gioca. | Usare i propri strumenti, e capire se il formato scelto regge. | 6 |
| **Rifai uguale** | Ti viene mostrato un risultato (un'immagine, un breve video, un gioco da provare) e devi ottenere lo stesso. La piattaforma confronta con il riferimento. | Osservare con precisione e tradurre ciò che vedi in impostazioni e codice. | 12 |
| **Da un progetto vuoto** | Le tappe dei progetti di fine fase: nessun file di partenza, nessun passo, solo ciò che il gioco deve fare. | Tutto insieme. È la misura vera di ciò che hai imparato. | 37 |

## La scheda «Cosa so fare»

Un documento che si scarica alla fine di ogni fase e alla fine del corso. Elenca, voce per voce, le cose che dovresti saper fare (sono le righe «impari» di ogni lezione e «alla fine» di ogni fase).

Per ogni voce:

- Ciò che la piattaforma ha misurato: test superato o no, al primo tentativo o dopo quanti, con quanto aiuto del tutor, in quanto tempo, quando.
- La tua valutazione, da «non la so» a «la insegnerei», e una nota libera.
- In quali progetti l'hai usata da solo.

A cosa serve:

- A te, per vedere cosa sai davvero e cosa ripassare.
- Quando avrai l'idea di un gioco: dai la scheda a Claude insieme all'idea. Dal confronto esce cosa sai già fare, cosa ti manca, e un ramo di lezioni scritto apposta per arrivarci.

Formati: Markdown, da leggere e stampare; JSON, da far leggere a un programma.

## Le scelte, e perché

| Scelta | Perché |
|---|---|
| GDScript come unica lingua del corso; C# è un ramo facoltativo. | È la lingua per cui Godot è pensato e quella usata dalla grande maggioranza dei progetti (nel sondaggio della comunità del 2025 solo il 16% circa usa C#). Tutta la documentazione e gli esempi partono da GDScript. |
| Molta interfaccia e molti dati, non solo movimento. | I giochi più venduti fatti con Godot (Brotato, Dome Keeper, Backpack Battles, Halls of Torment, Slay the Spire 2) sono fatti soprattutto di sistemi, menu, dati e salvataggi. È anche la parte che si programma di più. |
| La visual novel è il primo gioco completo, prima dei giochi d'azione. | È il genere che preferisci, è quasi tutta programmazione (dialoghi come dati, scelte, variabili, salvataggi) e non richiede la fisica. E si verifica con certezza: il testo mostrato, lo stato, il file salvato. |
| Il motore dei dialoghi si costruisce a mano; il plugin Dialogic si prova dopo. | Costruirlo è il modo per imparare a programmare un sistema vero. Sapere poi valutare e usare un plugin è una competenza a parte, con la sua lezione. |
| Il 3D ha lo stesso peso del 2D d'azione (circa 42 ore ciascuno). | L'hai chiesto, e i giochi 3D fatti con Godot (Buckshot Roulette, Cruelty Squad, Road to Vostok) mostrano che il motore lo regge. |
| Dentro il corso: Git, esportazione e pubblicazione, navigazione dei nemici, shader di base, traduzioni. | Servono a finire e a distribuire un gioco vero, e la documentazione ufficiale li tratta come parti normali del lavoro. |
| Rami facoltativi: gioco di ruolo a turni, roguelite d'arena, carte, sparatutto in prima persona, avventura narrativa esplorabile, generazione procedurale, multiplayer, strumenti per l'editor, C#. | Sono specializzazioni: si capiscono in fretta quando le basi ci sono, e non tutte ti interesseranno. |
| Fuori dal corso: realtà virtuale, esportazione per telefoni e console, GDExtension e C++, modifiche al motore. | Sono argomenti per chi ha già pubblicato qualcosa. L'ultima lezione ti dice dove si trovano. |

<a id="fase-0--f00-orientamento"></a>

## Fase 0 — Orientamento

*3 ore · 3 lezioni*

Installi Godot, impari a muoverti nell'editor costruendo una scena, e impari subito la cosa più utile di tutto il corso: trovare da solo una risposta nella documentazione.

**Il gioco che cresce:** Nessun gioco ancora: una scena che parte.

**Alla fine di questa fase:**

- Crei, apri, rinomini e togli un progetto senza pensarci.
- Costruisci una scena da una descrizione scritta, la salvi e la esegui.
- Cerchi una classe nell'aiuto integrato e trovi la proprietà che ti serve.

### 0.0 Installare Godot e gestire i progetti

*45 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Scaricare l'edizione giusta di Godot 4.7 (standard, non .NET) e avviarla; Creare un progetto, capire cosa c'è nella sua cartella (project.godot, .godot, res://); Rinominare un progetto, toglierlo dall'elenco senza cancellarlo, reimportarlo.
- **Costruisci:** Due progetti: uno resta nell'elenco con un nome nuovo, l'altro viene tolto dall'elenco ma resta sul disco e poi viene reimportato.
- **Come viene controllato:** La piattaforma legge l'elenco dei progetti di Godot e le cartelle sul disco: nome, presenza nell'elenco, file project.godot.

### 0.1 L'editor, costruendo una scena

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** A cosa servono le aree 2D, 3D e Script e i pannelli Scene, FileSystem, Inspector e Output; Aggiungere nodi, spostarli, cambiare le loro proprietà nell'Inspector; Salvare una scena, impostarla come principale ed eseguirla (F5, F6).
- **Costruisci:** Una scena ricostruita da una descrizione scritta: un Node2D con tre Sprite2D e un Label messi in posizioni, scale e colori precisi.
- **Come viene controllato:** La piattaforma apre la scena: tipi dei nodi, nomi, posizioni, scala, colore, testo; poi esegue il progetto e controlla che parta senza errori.

### 0.2 Trovare le risposte da soli: l'aiuto integrato

*60 minuti · lezione di metodo · esercizi: trova nella documentazione*

- **Impari:** Cercare una classe con F1 e leggerne la pagina: proprietà, metodi, segnali; Risalire la catena delle classi: una proprietà può stare in una classe madre; Passare dalla descrizione di una proprietà al suo campo nell'Inspector.
- **Costruisci:** Quattro modifiche alla scena della lezione precedente di cui la lezione non dice il nome: specchiare uno sprite, nasconderne un altro, ruotare un nodo di 45 gradi, mettere un testo tutto in maiuscolo. I nomi delle proprietà vanno trovati.
- **Come viene controllato:** La piattaforma legge le quattro proprietà nella scena salvata.

<a id="fase-1--f01-programmare"></a>

## Fase 1 — Programmare da zero, vedendo il risultato

*20,5 ore · 16 lezioni · 3 tappe di progetto*

Le basi della programmazione, imparate facendo muovere cose sullo schermo. Niente fisica e niente scorciatoie del motore: posizioni, condizioni, cicli e dati, scritti da te. Alla fine hai un piccolo gioco arcade fatto solo di codice tuo.

**Il gioco che cresce:** «Pioggia di stelle»: muovi un cesto a destra e a sinistra, prendi le stelle che cadono, eviti i sassi. Tre vite, difficoltà che cresce, fine partita e nuova partita.

**La prova, da un progetto vuoto:** «Schiva!», da un progetto vuoto: una navicella si muove in quattro direzioni, i meteoriti arrivano sempre più fitti, il punteggio è il tempo di sopravvivenza, con record della sessione e nuova partita.

**Alla fine di questa fase:**

- Scrivi uno script da un file vuoto: variabili con i tipi, condizioni, cicli, funzioni.
- Tieni tanti oggetti in un Array e i loro dati in un Dictionary.
- Leggi un messaggio d'errore, trovi la riga e correggi.
- Organizzi un gioco in stati (in partita, finita) e in funzioni piccole con nomi chiari.

### 1.0 Il primo script: dare ordini a un nodo

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Cos'è uno script e come si collega a un nodo; La funzione _ready(): cosa viene eseguito all'avvio; Cambiare una proprietà dal codice (position, modulate) e usare print() per guardare dentro al programma.
- **Costruisci:** Il cesto: uno Sprite2D che all'avvio si mette da solo in basso al centro, cambia colore e scrive nell'Output dove si trova.
- **Come viene controllato:** La piattaforma esegue la scena: posizione e colore del nodo dopo l'avvio, testo stampato.

### 1.1 Variabili e tipi: ricordare i valori

*60 minuti · esercizi: costruisci, accompagnato; prevedi; costruisci, dato il risultato*

- **Impari:** Dichiarare variabili e costanti con il tipo: int, float, String, bool; La differenza tra numeri interi e con la virgola, e cosa succede quando si mescolano; Vector2: due numeri insieme, per posizioni e velocità.
- **Costruisci:** Velocità, posizione di partenza e nome del giocatore diventano variabili; un Label mostra un testo composto con quei valori.
- **Come viene controllato:** La piattaforma legge i valori delle variabili dello script e il testo del Label dopo l'avvio.

### 1.2 _process e delta: far muovere qualcosa

*60 minuti · esercizi: costruisci, accompagnato; prevedi; costruisci, dato il risultato*

- **Impari:** Il ciclo del gioco: _process() viene chiamata a ogni fotogramma; Perché si moltiplica per delta: stessa velocità su ogni computer; Sommare una velocità a una posizione.
- **Costruisci:** Una stella che cade dall'alto a velocità costante, in pixel al secondo.
- **Come viene controllato:** La piattaforma fa passare un tempo noto e controlla di quanto è scesa la stella, a due frequenze di fotogrammi diverse.

### 1.3 Condizioni: if, elif, else

*60 minuti · esercizi: costruisci, accompagnato; prevedi; costruisci, dato il risultato*

- **Impari:** Confronti e valori vero/falso; if, elif, else e come si combinano le condizioni con and, or, not; Ragionare sui casi limite: esattamente sul bordo, appena oltre.
- **Costruisci:** La stella, arrivata in fondo allo schermo, ricomincia dall'alto; cambia colore quando supera la metà.
- **Come viene controllato:** La piattaforma porta la stella in posizioni precise (prima, sul bordo, oltre) e controlla cosa succede.

### 1.4 Input: leggere la tastiera

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Le azioni di input e la Input Map: perché non si leggono i tasti direttamente; Input.is_action_pressed() dentro _process(); Tenere un valore dentro un intervallo con clamp().
- **Costruisci:** Il cesto si muove a destra e a sinistra con le frecce e con A e D, e non esce dallo schermo.
- **Come viene controllato:** La piattaforma tiene premute le azioni per un tempo noto: spostamento, direzione, blocco ai bordi.

### 1.5 Funzioni: dare un nome a un pezzo di lavoro

*75 minuti · esercizi: costruisci, accompagnato; riordina; prevedi*

- **Impari:** Scrivere una funzione, con parametri e con un valore restituito; Variabili locali e variabili dello script; Spezzare un programma lungo in funzioni che fanno una cosa sola.
- **Costruisci:** Il codice scritto finora diviso in move_basket(), reset_star() e is_caught(), che dice se una stella è stata presa.
- **Come viene controllato:** La piattaforma chiama le funzioni con valori di prova e confronta il risultato; poi controlla che il gioco si comporti come prima.

### 1.6 Leggere gli errori e usare il Debugger

*60 minuti · lezione di metodo · esercizi: ripara*

- **Impari:** Distinguere un errore di scrittura (il gioco non parte) da un errore durante l'esecuzione; Leggere il messaggio: file, riga, cosa si aspettava il motore; Guardare i valori mentre il gioco gira: print(), punti di interruzione, esecuzione passo passo.
- **Costruisci:** Ricevi una copia del gioco con cinque errori dentro (due di scrittura, tre di logica) e la rimetti in funzione.
- **Come viene controllato:** La piattaforma esegue il progetto: nessun errore, e il gioco si comporta come quello giusto.

### 1.7 Numeri casuali e distanze

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; prevedi*

- **Impari:** randf_range() e randi_range(): il caso dentro un intervallo; Sottrarre due Vector2 e misurare una distanza con distance_to(); Decidere che due oggetti si toccano quando sono abbastanza vicini.
- **Costruisci:** Ogni stella parte da un punto a caso in alto; viene presa quando è abbastanza vicina al cesto.
- **Come viene controllato:** La piattaforma fa nascere cento stelle e controlla che stiano tutte dentro lo schermo e non tutte nello stesso punto; poi mette stella e cesto a distanze note.

### 1.8 Punteggio e testo sullo schermo

*45 minuti · esercizi: costruisci, dato il risultato; prevedi*

- **Impari:** Trasformare un numero in testo e comporre una frase; Formattare: zeri davanti, decimali, più valori nella stessa frase; Aggiornare un Label solo quando il valore cambia.
- **Costruisci:** Punteggio e vite mostrati in alto, aggiornati a ogni stella presa o persa.
- **Come viene controllato:** La piattaforma fa prendere tre stelle e ne fa perdere una, poi legge il testo dei Label.

### 1.9 Cicli: for e while

*60 minuti · esercizi: costruisci, accompagnato; prevedi; costruisci, dato il risultato*

- **Impari:** Ripetere un lavoro con for e range(); while: ripetere finché una condizione è vera, e come non restare bloccati; Creare nodi dal codice con new() e add_child().
- **Costruisci:** Cinque stelle create dal codice all'avvio, ognuna a un'altezza diversa.
- **Come viene controllato:** La piattaforma conta i nodi creati e controlla le loro posizioni di partenza.

### 1.10 Array: tanti oggetti insieme

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** Creare un Array con il tipo dei suoi elementi, aggiungere e togliere; Scorrere un Array e fare la stessa cosa a ogni elemento; L'errore tipico: togliere elementi mentre si scorre.
- **Costruisci:** Tutte le stelle stanno in un Array: cadono insieme, quelle prese o uscite vengono tolte e sostituite.
- **Come viene controllato:** La piattaforma controlla la lunghezza dell'Array nel tempo e che ogni stella si muova; fa prendere una stella e controlla che sparisca dall'Array e dalla scena.

### 1.11 Dictionary: dati con un nome

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Chiavi e valori: quando un Dictionary è meglio di tante variabili; Leggere, scrivere, controllare se una chiave esiste; Descrivere i tipi di oggetto del gioco come dati, invece che con tanti if.
- **Costruisci:** Tre tipi di oggetto che cadono (stella, stella d'oro, sasso), ognuno con punti, velocità e colore scritti in un Dictionary.
- **Come viene controllato:** La piattaforma legge la tabella dei tipi e controlla l'effetto di ognuno: punti aggiunti o vita tolta.

### 1.12 Stati del gioco: enum e match

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** enum: dare un nome a un insieme di casi; match al posto di una catena di if; Un gioco è sempre in uno stato: in partita, finita.
- **Costruisci:** Alla terza vita persa il gioco si ferma e mostra «Partita finita»; un tasto la fa ricominciare da zero.
- **Come viene controllato:** La piattaforma fa perdere tre vite, controlla lo stato e che niente si muova più; preme il tasto e controlla che tutto sia tornato all'inizio.

### 1.13 Difficoltà che cresce nel tempo

*60 minuti · esercizi: costruisci, dato il risultato; prevedi*

- **Impari:** Contare il tempo che passa sommando delta; Una funzione che dal tempo calcola un valore: min(), max(), lerp(); Far succedere qualcosa a intervalli regolari senza un Timer.
- **Costruisci:** Le stelle cadono sempre più in fretta e nascono sempre più spesso, fino a un massimo.
- **Come viene controllato:** La piattaforma chiama la funzione della difficoltà a tempi diversi e conta quante stelle nascono in due intervalli uguali, all'inizio e dopo.

### 1.14 Ordinare il codice

*60 minuti · esercizi: riordina*

- **Impari:** Le convenzioni di GDScript: nomi, ordine dentro al file, righe vuote; Togliere i numeri sparsi nel codice dandogli un nome; Commenti che spiegano il perché, non il cosa.
- **Costruisci:** Ricevi una versione disordinata ma funzionante del gioco e la riordini senza cambiarne il comportamento.
- **Come viene controllato:** La piattaforma rifà tutti i controlli delle lezioni precedenti (il gioco deve funzionare come prima) e controlla lo script: tipi dichiarati ovunque, nessun numero sparso, nessuna funzione troppo lunga.

### 1.15 Classi e oggetti: ogni cosa pensa a sé

*75 minuti · esercizi: costruisci, accompagnato; riordina; costruisci, dato il risultato*

- **Impari:** Uno script è una classe; ogni nodo che lo usa è un oggetto con i suoi valori; extends e class_name; Spostare dati e comportamento dentro l'oggetto a cui appartengono.
- **Costruisci:** Lo script FallingItem: ogni oggetto che cade sa di che tipo è, come muoversi e quanto vale. Lo script principale si accorcia.
- **Come viene controllato:** La piattaforma crea oggetti FallingItem di tipi diversi, controlla le loro proprietà e i loro metodi, poi rifà i controlli sul gioco intero.

### 1.16 Progetto «Schiva!» – tappa 1: muoversi e nascere

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Partire da un progetto vuoto e decidere da soli scene, script e nomi.
- **Costruisci:** La navicella si muove in quattro direzioni dentro lo schermo; i meteoriti nascono fuori dallo schermo e lo attraversano.
- **Come viene controllato:** La piattaforma tiene premute le quattro azioni e controlla spostamenti e bordi; conta i meteoriti nel tempo e controlla che si muovano e vengano tolti quando escono.

### 1.17 Progetto «Schiva!» – tappa 2: urti, vite e tempo

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Mettere insieme da soli distanze, stati e difficoltà.
- **Costruisci:** Urto per vicinanza, tre vite, punteggio che è il tempo di sopravvivenza, meteoriti sempre più fitti.
- **Come viene controllato:** La piattaforma mette navicella e meteorite a distanze note, controlla vite e punteggio nel tempo e la frequenza delle nascite.

### 1.18 Progetto «Schiva!» – tappa 3: fine partita, record e ordine

*60 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Chiudere un gioco: ogni partita deve poter finire e ricominciare pulita.
- **Costruisci:** Schermata di fine partita con il tempo fatto e il record della sessione, nuova partita con un tasto, codice riordinato.
- **Come viene controllato:** La piattaforma gioca due partite di seguito: stato, record, azzeramento completo; poi controlla lo script come nella lezione sull'ordine.

<a id="fase-2--f02-nodi-scene-segnali"></a>

## Fase 2 — Il modo di Godot: nodi, scene e segnali

*15,8 ore · 11 lezioni · 3 tappe di progetto*

Nella fase 1 hai fatto tutto a mano. Qui impari gli strumenti che Godot ti dà per non farlo: l'albero dei nodi, le scene riutilizzabili, i segnali con cui i nodi si avvisano. Riscrivi il tuo gioco in questo modo e ne costruisci uno nuovo.

**Il gioco che cresce:** «Pioggia di stelle», ricostruito con scene e segnali e arricchito: ondate, potenziamenti, un pulsante per ricominciare, piccole animazioni.

**La prova, da un progetto vuoto:** «Memory», da un progetto vuoto: una griglia di carte coperte create dal codice, due alla volta si girano, le coppie restano scoperte, le altre si ricoprono dopo un attimo. Contatore delle mosse, vittoria, nuova partita, tre grandezze di griglia.

**Alla fine di questa fase:**

- Dividi un gioco in scene piccole e le crei dal codice quando servono.
- Fai parlare i nodi con i segnali, anche con segnali tuoi.
- Regoli il gioco dall'Inspector con le proprietà esportate.
- Apri la pagina di una classe che non conosci e la usi.

### 2.0 L'albero dei nodi: genitori e figli

*60 minuti · esercizi: costruisci, accompagnato; prevedi; costruisci, dato il risultato*

- **Impari:** Un figlio si muove, ruota e si nasconde insieme al genitore; Posizione locale e posizione globale; L'ordine dei nodi decide chi viene disegnato sopra.
- **Costruisci:** Il cesto diventa un piccolo albero (corpo, manico, ombra) che si muove tutto insieme; l'interfaccia passa davanti al gioco.
- **Come viene controllato:** La piattaforma legge l'albero della scena, sposta il genitore e controlla la posizione globale dei figli.

### 2.1 Raggiungere i nodi dal codice

*75 minuti · esercizi: costruisci, accompagnato; ripara; costruisci, dato il risultato*

- **Impari:** $Percorso, get_node() e i nomi unici con %; @onready: prendere un nodo quando esiste davvero; L'errore più comune di tutti: «null instance», e come si legge.
- **Costruisci:** Lo script principale smette di cercare i nodi a ogni fotogramma: li prende una volta sola, con riferimenti che non si rompono se sposti un nodo nell'albero.
- **Come viene controllato:** La piattaforma sposta un nodo dentro l'albero ed esegue: il gioco deve funzionare ancora; controlla le variabili @onready.

### 2.2 Scene riutilizzabili: lo stampo e le copie

*75 minuti · esercizi: costruisci, accompagnato; riordina; costruisci, dato il risultato*

- **Impari:** Salvare un ramo come scena: uno stampo da cui fare copie; PackedScene, preload() e instantiate(); Cosa mettere dentro una scena e cosa lasciare fuori.
- **Costruisci:** L'oggetto che cade diventa la scena falling_item.tscn, con il suo script; il gioco ne crea copie quando servono.
- **Come viene controllato:** La piattaforma controlla che la scena esista e si apra da sola, e che gli oggetti in gioco siano sue copie.

### 2.3 La vita di un nodo: dalla nascita a queue_free()

*60 minuti · esercizi: prevedi; ripara; costruisci, dato il risultato*

- **Impari:** L'ordine in cui il motore chiama _init, _enter_tree, _ready, _process; queue_free(): togliere un nodo nel modo giusto; Riconoscere un riferimento a un nodo che non esiste più.
- **Costruisci:** Gli oggetti presi o usciti dallo schermo vengono eliminati davvero; dopo dieci minuti di gioco i nodi sono quanti all'inizio.
- **Come viene controllato:** La piattaforma fa girare il gioco a lungo e conta i nodi; elimina un oggetto e controlla che niente provi più a usarlo.

### 2.4 Segnali: collegare ciò che esiste già

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Un segnale è un avviso: chi lo manda non sa chi ascolta; Collegare un segnale dall'editor e dal codice con connect(); I segnali che userai sempre: pressed, timeout.
- **Costruisci:** Un pulsante «Ricomincia» nella schermata di fine partita e un Timer che fa nascere gli oggetti al posto del conteggio fatto a mano.
- **Come viene controllato:** La piattaforma clicca il pulsante e controlla che la partita ricominci; controlla i collegamenti dei segnali e il ritmo delle nascite.

### 2.5 Timer: far succedere le cose nel tempo

*45 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Timer a ripetizione e a colpo singolo, avviare e fermare; Un'attesa in mezzo a una funzione con await; Scegliere tra un nodo Timer e un'attesa nel codice.
- **Costruisci:** Ondate: dieci secondi di pioggia, tre di pausa, poi più fitta. Dopo un sasso sei intoccabile per un secondo.
- **Come viene controllato:** La piattaforma fa passare il tempo e conta le nascite in pioggia e in pausa; fa colpire due sassi a mezzo secondo di distanza e controlla le vite.

### 2.6 Segnali tuoi, con parametri

*75 minuti · esercizi: costruisci, accompagnato; riordina; costruisci, dato il risultato*

- **Impari:** Dichiarare un segnale ed emetterlo con dei dati; La regola che tiene in ordine un progetto: chiamate verso il basso, segnali verso l'alto; Togliere una dipendenza: chi manda il segnale funziona anche se nessuno ascolta.
- **Costruisci:** Ogni oggetto avvisa quando viene preso e quanto vale; punteggio e interfaccia ascoltano. L'oggetto non conosce più né il gioco né l'interfaccia.
- **Come viene controllato:** La piattaforma apre la scena dell'oggetto da sola (deve funzionare), controlla il segnale e i suoi parametri, e che il punteggio cambi quando il segnale parte.

### 2.7 Gruppi: parlare a tanti nodi insieme

*45 minuti · esercizi: costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Mettere un nodo in un gruppo dall'editor e dal codice; Prendere tutti i nodi di un gruppo o chiamare una funzione su tutti; Gruppi o Array: quando conviene l'uno o l'altro.
- **Costruisci:** Due potenziamenti: uno ferma per tre secondi tutto ciò che cade, l'altro trasforma tutti i sassi in stelle.
- **Come viene controllato:** La piattaforma fa prendere ogni potenziamento e controlla l'effetto su tutti gli oggetti presenti.

### 2.8 @export: regolare il gioco dall'Inspector

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Esporre una variabile nell'Inspector: numeri con limiti, colori, scelte, scene; Stessa scena, valori diversi: varianti senza scrivere altro codice; Cosa conviene esportare e cosa lasciare nel codice.
- **Costruisci:** Velocità, durata delle ondate, vite e scene da far nascere si regolano dall'Inspector; nasce una variante «difficile» del gioco senza toccare il codice.
- **Come viene controllato:** La piattaforma legge le proprietà esportate (nome, tipo, limiti) e controlla che cambiandole il gioco cambi.

### 2.9 Tween: animare con il codice

*60 minuti · esercizi: costruisci, accompagnato; rifai uguale*

- **Impari:** Portare una proprietà da un valore a un altro in un certo tempo; Curve di movimento: partire piano, arrivare piano, rimbalzare; Mettere più animazioni in fila o insieme e fare qualcosa alla fine.
- **Costruisci:** Il cesto si gonfia un attimo quando prende una stella, il punteggio guadagnato sale e svanisce, la schermata finale entra in dissolvenza.
- **Come viene controllato:** La piattaforma fa prendere una stella e legge la scala del cesto durante e dopo l'animazione; controlla che al termine tutto sia tornato com'era.

### 2.10 Leggere la pagina di una classe che non conosci

*60 minuti · lezione di metodo · esercizi: trova nella documentazione*

- **Impari:** Come è fatta una pagina della documentazione: descrizione, proprietà, metodi, segnali, costanti; Leggere la firma di un metodo: cosa vuole e cosa restituisce; Provare una cosa nuova in una scena di prova prima di metterla nel gioco.
- **Costruisci:** Tre aggiunte che la lezione descrive solo come risultato: una barra che mostra quanto manca alla fine dell'ondata, una scia dietro alle stelle d'oro, il gioco che si ferma quando la finestra perde il fuoco. I nodi e i metodi vanno trovati.
- **Come viene controllato:** La piattaforma controlla i tre comportamenti, senza imporre come sono stati ottenuti.

### 2.11 Progetto «Memory» – tappa 1: la griglia

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Progettare da soli una scena riutilizzabile e crearne tante copie in ordine.
- **Costruisci:** La scena della carta (coperta o scoperta, con il suo valore) e la griglia creata dal codice, con le coppie mescolate.
- **Come viene controllato:** La piattaforma conta le carte, controlla che ogni valore compaia esattamente due volte e che l'ordine cambi a ogni partita.

### 2.12 Progetto «Memory» – tappa 2: le regole

*105 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Tradurre le regole di un gioco in stati, segnali e attese.
- **Costruisci:** Due carte si girano; se sono uguali restano scoperte, altrimenti si ricoprono dopo un secondo; durante l'attesa non si può cliccare altro.
- **Come viene controllato:** La piattaforma clicca coppie giuste e sbagliate e controlla lo stato di ogni carta nel tempo, compreso il clic durante l'attesa.

### 2.13 Progetto «Memory» – tappa 3: partita completa

*75 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Rendere un gioco regolabile e rigiocabile.
- **Costruisci:** Contatore delle mosse, messaggio di vittoria, nuova partita, tre grandezze di griglia scelte da una proprietà esportata, carte che si girano con un'animazione.
- **Come viene controllato:** La piattaforma gioca una partita intera conoscendo i valori delle carte: mosse contate, vittoria, nuova partita rimescolata; ripete con le tre griglie.

<a id="fase-3--f03-interfaccia"></a>

## Fase 3 — Interfaccia: menu, schermate e più scene

*13,8 ore · 10 lezioni · 3 tappe di progetto*

Un gioco non è solo la partita: ci sono il menu, il punteggio, la pausa, le impostazioni. Impari i nodi Control e i contenitori, i temi, il passaggio da una scena all'altra e i dati che devono restare. È la base della visual novel, che è quasi tutta interfaccia.

**Il gioco che cresce:** «Pioggia di stelle» diventa un gioco con un inizio e una fine: menu principale, punteggio e vite in sovrimpressione, pausa, schermata finale con il record.

**La prova, da un progetto vuoto:** «Quiz», da un progetto vuoto: menu, domande con quattro risposte prese da una tabella di dati, tempo per rispondere mostrato da una barra, schermata dei risultati, tutto usabile anche solo con la tastiera.

**Alla fine di questa fase:**

- Costruisci un'interfaccia che resta in ordine quando la finestra cambia grandezza.
- Dai a tutto il gioco lo stesso aspetto con un tema.
- Passi da una scena all'altra e tieni i dati che servono con un Autoload.
- Fai funzionare i menu con tastiera e gamepad.

### 3.0 Control: ancore e dimensioni

*75 minuti · esercizi: costruisci, accompagnato; rifai uguale; ripara*

- **Impari:** La differenza tra i nodi 2D del gioco e i nodi Control dell'interfaccia; Ancore: a quale punto dello schermo resta attaccato un elemento; Dimensione minima e riempimento.
- **Costruisci:** Punteggio in alto a sinistra, vite in alto a destra, un messaggio al centro: restano al loro posto con la finestra a tre grandezze diverse.
- **Come viene controllato:** La piattaforma esegue la scena a tre grandezze di finestra e misura dove si trova ogni elemento rispetto ai bordi.

### 3.1 Contenitori: l'interfaccia che si dispone da sola

*75 minuti · esercizi: costruisci, accompagnato; rifai uguale*

- **Impari:** VBoxContainer, HBoxContainer, GridContainer, MarginContainer, CenterContainer; Chi decide la dimensione: il contenitore, non il figlio; Annidare contenitori per ottenere una disposizione complessa.
- **Costruisci:** Il menu principale: titolo, tre pulsanti in colonna, la versione in un angolo. Aggiungere un quarto pulsante non richiede di spostare niente.
- **Come viene controllato:** La piattaforma aggiunge un pulsante al contenitore e controlla che gli altri si siano ridisposti senza sovrapporsi, a più grandezze di finestra.

### 3.2 I controlli che userai sempre

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Label, Button, TextureRect, ProgressBar, Slider, CheckBox, LineEdit: proprietà e segnali di ognuno; Leggere e scrivere il loro valore dal codice; Disattivare e nascondere un controllo.
- **Costruisci:** Una schermata «Nuova partita»: nome del giocatore, difficoltà con uno Slider, una casella per i potenziamenti; «Gioca» resta spento finché il nome è vuoto.
- **Come viene controllato:** La piattaforma scrive nei controlli, li sposta e li spunta, e legge cosa arriva al gioco; controlla quando il pulsante è spento.

### 3.3 Temi e font: un aspetto coerente

*75 minuti · esercizi: costruisci, accompagnato; rifai uguale*

- **Impari:** Un Theme vale per tutti i controlli sotto il nodo a cui è dato; StyleBoxFlat: sfondo, bordo, angoli, margini; gli stati di un pulsante; Usare un font e le sue dimensioni; quando usare una modifica locale.
- **Costruisci:** Un tema del gioco: pulsanti con quattro stati, pannelli, font del titolo e del testo. Menu e schermate lo usano senza modifiche locali.
- **Come viene controllato:** La piattaforma legge il tema e i suoi stili, e controlla che i controlli delle scene lo ereditino invece di avere colori messi a mano.

### 3.4 L'interfaccia durante la partita: CanvasLayer

*45 minuti · esercizi: costruisci, dato il risultato; riordina*

- **Impari:** CanvasLayer: un piano che non si muove con il gioco; L'interfaccia come scena a parte, che ascolta i segnali del gioco; Una barra che mostra un valore.
- **Costruisci:** La scena hud.tscn: punteggio, vite come icone, barra dell'ondata. Non conosce il gioco: riceve tutto dai segnali.
- **Come viene controllato:** La piattaforma apre l'interfaccia da sola, emette i segnali a mano e legge cosa mostra.

### 3.5 Più scene: dal menu alla partita e ritorno

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** change_scene_to_file() e change_scene_to_packed(); Cosa succede alla scena vecchia: tutto ciò che conteneva sparisce; Chiudere il gioco.
- **Costruisci:** Menu → partita → schermata finale → menu, con «Esci».
- **Come viene controllato:** La piattaforma clicca i pulsanti e controlla quale scena è in esecuzione a ogni passo.

### 3.6 Autoload: i dati che restano

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** Un Autoload esiste per tutta la durata del gioco, sopra le scene; Cosa metterci (record, impostazioni, dati della partita) e cosa no; Il rischio: un posto dove finisce di tutto.
- **Costruisci:** L'Autoload Game: nome del giocatore, difficoltà scelta, record. La schermata finale mostra il record anche dopo essere passati dal menu.
- **Come viene controllato:** La piattaforma controlla che l'Autoload sia registrato, cambia scena più volte e legge i valori.

### 3.7 Pausa

*45 minuti · esercizi: costruisci, dato il risultato; ripara*

- **Impari:** get_tree().paused ferma il gioco, non l'interfaccia che dici tu; process_mode: chi continua a funzionare in pausa; Un menu di pausa che non lascia il gioco in uno stato strano.
- **Costruisci:** Esc mette in pausa e mostra «Riprendi», «Ricomincia», «Menu».
- **Come viene controllato:** La piattaforma mette in pausa a metà partita: niente si muove e il tempo non avanza, i pulsanti rispondono; riprende e controlla che si riparta dallo stesso punto.

### 3.8 Menu con tastiera e gamepad: il focus

*45 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Il focus: quale controllo riceve i tasti; Dare il focus al primo pulsante quando una schermata si apre; Decidere a mano dove va il focus quando l'ordine automatico sbaglia.
- **Costruisci:** Tutti i menu del gioco si usano senza mouse: frecce per muoversi, Invio per scegliere, Esc per tornare indietro.
- **Come viene controllato:** La piattaforma naviga ogni menu premendo solo le azioni dell'interfaccia e controlla dove si trova il focus e cosa succede a ogni conferma.

### 3.9 Schermi diversi

*45 minuti · esercizi: costruisci, dato il risultato; prevedi*

- **Impari:** La risoluzione di base del progetto e come viene adattata alla finestra; Le modalità di stretch e di aspect, e quale scegliere per un gioco 2D; Finestra e schermo intero.
- **Costruisci:** Il gioco resta proporzionato su finestre larghe e strette e passa a schermo intero con un tasto.
- **Come viene controllato:** La piattaforma legge le impostazioni del progetto ed esegue il gioco a più proporzioni, controllando che niente esca dallo schermo.

### 3.10 Progetto «Quiz» – tappa 1: dati e schermate

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Separare i dati (le domande) dall'interfaccia che li mostra.
- **Costruisci:** Le domande in una tabella di dati; menu e schermata della domanda con quattro risposte generate dai dati; tema del gioco.
- **Come viene controllato:** La piattaforma sostituisce la tabella con domande sue e controlla che la schermata mostri quelle, anche con un numero diverso di domande.

### 3.11 Progetto «Quiz» – tappa 2: partita

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Gestire da soli il flusso di una partita fatta di schermate.
- **Costruisci:** Risposta giusta o sbagliata mostrata prima di passare oltre, tempo per rispondere con una barra, punteggio, schermata dei risultati con il record.
- **Come viene controllato:** La piattaforma gioca una partita conoscendo le risposte: punteggio, tempo scaduto, risultati, record dopo due partite.

### 3.12 Progetto «Quiz» – tappa 3: rifinitura

*60 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Portare un'interfaccia al livello di un gioco che si può dare a qualcuno.
- **Costruisci:** Tutto usabile con la sola tastiera, pausa, finestra ridimensionabile senza difetti, piccole animazioni tra una domanda e l'altra.
- **Come viene controllato:** La piattaforma gioca una partita intera senza mouse, a due grandezze di finestra, mettendo in pausa a metà.

<a id="fase-4--f04-programmare-meglio"></a>

## Fase 4 — Programmare meglio: classi, dati, file

*15,3 ore · 10 lezioni · 3 tappe di progetto*

Prima del primo gioco grande servono strumenti più forti: classi tue, dati salvati come file, attese, funzioni passate come valori. E due abitudini da professionista: tenere la storia del progetto con Git e trovare un errore con metodo.

**Il gioco che cresce:** «Quiz» cresce da dentro: le domande diventano file di dati, i record si salvano su disco, il codice si divide in classi con un compito ciascuna.

**La prova, da un progetto vuoto:** «Avventura testuale», da un progetto vuoto: stanze, uscite e oggetti descritti in un file JSON; ci si muove e si raccolgono oggetti con dei pulsanti; alcune uscite chiedono un oggetto; la partita si salva e si ricarica. Cambiando il file cambia l'avventura, senza toccare il codice.

**Alla fine di questa fase:**

- Progetti le classi di un piccolo sistema e decidi chi fa cosa.
- Tieni i dati del gioco fuori dal codice, in Resource e in file JSON.
- Salvi e ricarichi una partita.
- Usi Git ogni giorno e trovi un errore di logica con il debugger.

### 4.0 Classi fatte bene

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; prevedi*

- **Impari:** Una classe che non è un nodo: RefCounted, _init() con parametri; Proprietà con controllo sui valori (set e get) e funzioni statiche; Cosa rendere usabile da fuori e cosa tenere per sé.
- **Costruisci:** Le classi Question e QuizSession: la sessione sa qual è la domanda corrente, se una risposta è giusta, quanto vale il punteggio. L'interfaccia non fa più calcoli.
- **Come viene controllato:** La piattaforma usa le classi senza interfaccia: crea una sessione con domande sue, risponde e confronta punteggio e stato, compresi i casi sbagliati (risposta fuori elenco, sessione finita).

### 4.1 Ereditarietà e composizione

*75 minuti · esercizi: costruisci, accompagnato; estendi il codice di un altro; prevedi*

- **Impari:** Una classe che estende una classe tua: ridefinire un metodo, chiamare super(); is e as: chiedere di che tipo è un oggetto; Quando conviene comporre (un oggetto che ne contiene altri) invece di ereditare.
- **Costruisci:** Tre tipi di domanda (scelta singola, vero o falso, numero da indovinare con tolleranza) che il quiz tratta allo stesso modo.
- **Come viene controllato:** La piattaforma crea domande dei tre tipi e chiama gli stessi metodi su tutte; aggiunge un quarto tipo suo e controlla che il quiz lo accetti senza modifiche.

### 4.2 Resource: i dati come file

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** Una Resource tua, con proprietà esportate, salvata come file .tres; Creare e modificare i dati dall'Inspector; L'errore tipico: due oggetti che condividono la stessa Resource senza saperlo.
- **Costruisci:** Ogni argomento del quiz è una Resource con il suo elenco di domande; il menu elenca gli argomenti trovati nella cartella.
- **Come viene controllato:** La piattaforma aggiunge un file di argomento suo nella cartella e controlla che compaia nel menu e si possa giocare.

### 4.3 File e JSON: leggere e scrivere

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** res:// e user://: dove stanno i file del gioco e dove quelli del giocatore; FileAccess e JSON: scrivere una struttura di dati e rileggerla; Non fidarsi di un file: mancante, vuoto, rovinato.
- **Costruisci:** I record per argomento si salvano su disco e tornano alla riapertura; un file rovinato non blocca il gioco.
- **Come viene controllato:** La piattaforma gioca, chiude, riapre e legge i record; poi sostituisce il file con uno mancante, uno vuoto e uno rovinato e controlla che il gioco parta lo stesso.

### 4.4 await: aspettare senza fermare il gioco

*60 minuti · esercizi: prevedi; riordina; costruisci, dato il risultato*

- **Impari:** Una funzione che si ferma a metà e riprende: aspettare un segnale, un tempo, un'altra funzione; Scrivere una sequenza di passi dall'alto in basso; Cosa succede se, mentre aspetti, l'oggetto viene eliminato o la scena cambia.
- **Costruisci:** La sequenza tra una domanda e l'altra (mostra l'esito, aspetta, sfuma, cambia domanda, riappare) scritta come una sola funzione.
- **Come viene controllato:** La piattaforma segue la sequenza nel tempo, e torna al menu a metà sequenza: non deve comparire nessun errore.

### 4.5 Funzioni come valori: Callable e lambda

*60 minuti · esercizi: prevedi; costruisci, dato il risultato*

- **Impari:** Mettere una funzione in una variabile e passarla a un'altra funzione; Filtrare, trasformare e ordinare un Array: filter, map, sort_custom, any, all; Collegare un segnale passando dati in più con bind.
- **Costruisci:** Filtri del quiz (solo le domande difficili, solo quelle sbagliate l'ultima volta) e classifica dei record ordinata; i pulsanti delle risposte collegati tutti alla stessa funzione.
- **Come viene controllato:** La piattaforma chiama le funzioni di filtro e di ordinamento con dati suoi e confronta il risultato.

### 4.6 Scegliere come tenere i dati

*60 minuti · esercizi: costruisci, dato il risultato; riordina*

- **Impari:** Array, Dictionary, classe o Resource: cosa cambia quando leggi, cerchi, salvi; Dati dentro altri dati, e come descrivere un collegamento (questa stanza porta a quella); Riconoscere quando una struttura è sbagliata: troppi if, troppe ricerche.
- **Costruisci:** Due modelli di dati progettati da te e messi alla prova: un inventario con quantità e limite di posti, e una mappa di stanze collegate.
- **Come viene controllato:** La piattaforma usa i due modelli attraverso le funzioni richieste (aggiungi, togli, conta, «da qui dove posso andare») con casi normali e casi limite.

### 4.7 Collaudare il proprio codice: scrivere i controlli

*60 minuti · lezione di metodo · esercizi: costruisci, accompagnato; collauda*

- **Impari:** Un controllo automatico: uno script che usa il tuo codice e dice se il risultato è quello atteso; Scegliere i casi: quello normale, i bordi, i dati sbagliati; Un buon controllo fallisce quando il codice è sbagliato: come accorgersi di un controllo che passa sempre.
- **Costruisci:** I controlli per l'inventario e per la mappa di stanze della lezione precedente, lanciabili con un comando.
- **Come viene controllato:** La piattaforma esegue i tuoi controlli contro la versione giusta di ogni classe e contro quattro versioni con un errore ciascuna: devono promuovere la giusta e bocciare tutte le altre.

### 4.8 Git: la storia del progetto

*75 minuti · lezione di metodo · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Cosa salva Git e perché serve anche quando lavori da solo; Il ciclo di ogni giorno: guardare cosa è cambiato, salvare un passo con un messaggio, tornare indietro; Quali file di un progetto Godot non vanno salvati (.gitignore).
- **Costruisci:** Il progetto del quiz entra in Git: file esclusi impostati, almeno cinque passi con messaggi chiari, una modifica sbagliata fatta apposta e poi annullata.
- **Come viene controllato:** La piattaforma legge la storia del progetto: cartella .godot esclusa, numero di passi, messaggi non vuoti e non tutti uguali, stato finale pulito.

### 4.9 Trovare un errore con metodo

*60 minuti · lezione di metodo · esercizi: ripara*

- **Impari:** Il metodo: far succedere l'errore a comando, restringere dove può essere, fare un'ipotesi, verificarla; Punti di interruzione, esecuzione passo passo, valori delle variabili, albero della scena mentre il gioco gira; assert() e push_error(): far parlare il programma quando qualcosa non torna.
- **Costruisci:** Ricevi un quiz che parte senza errori ma sbaglia in quattro modi (punteggio, ordine, salvataggio, una domanda saltata) e lo correggi.
- **Come viene controllato:** La piattaforma gioca partite con risposte note e confronta punteggi, ordine e file salvato con quelli giusti.

### 4.10 Progetto «Avventura testuale» – tappa 1: il mondo come dati

*90 minuti · progetto · esercizi: da un progetto vuoto; scrivi i dati*

- **Impari:** Progettare un formato di dati e il codice che lo legge e lo controlla.
- **Costruisci:** Il file JSON dell'avventura (stanze, uscite, oggetti) e le classi che lo caricano; un file sbagliato produce un messaggio chiaro invece di un blocco.
- **Come viene controllato:** La piattaforma carica un'avventura sua e interroga il mondo; poi dà file con errori (uscita verso una stanza che non esiste, campo mancante) e controlla che vengano segnalati.

### 4.11 Progetto «Avventura testuale» – tappa 2: giocare

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Collegare un modello di dati a un'interfaccia generata dai dati.
- **Costruisci:** Descrizione della stanza, pulsanti per le uscite e per gli oggetti creati dai dati, inventario, uscite che chiedono un oggetto, una stanza finale.
- **Come viene controllato:** La piattaforma percorre l'avventura cliccando i pulsanti: stanza corrente, inventario, uscita bloccata e poi aperta, arrivo alla fine.

### 4.12 Progetto «Avventura testuale» – tappa 3: salvare

*60 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Decidere qual è lo stato di una partita e salvarlo tutto.
- **Costruisci:** Salva e carica in qualsiasi momento; progetto in Git con la storia delle tre tappe.
- **Come viene controllato:** La piattaforma salva a metà, continua, ricarica e controlla che stanza, inventario e uscite aperte siano quelli del salvataggio; legge la storia in Git.

<a id="fase-5--f05-asset-e-audio"></a>

## Fase 5 — Asset e audio: trovarli, adattarli, usarli

*11,8 ore · 9 lezioni · 2 tappe di progetto*

Non devi disegnare né comporre, ma devi saper trovare ciò che serve, capire se puoi usarlo, adattarlo al tuo progetto e farlo entrare in Godot nel modo giusto. Poi l'audio: suoni, musica, volumi.

**Il gioco che cresce:** «Quiz» e «Pioggia di stelle» ricevono grafica, font, suoni e musica veri, scelti da te.

**La prova, da un progetto vuoto:** «Rivesti il tuo gioco»: prendi uno dei tuoi giochi e gli dai un aspetto e un suono completi con asset trovati da te, un menu dei volumi che si ricorda le scelte e una schermata dei crediti con autori e licenze.

**Alla fine di questa fase:**

- Trovi asset gratuiti e sai dire se e come puoi usarli.
- Adatti un'immagine o un suono al progetto: dimensioni, ritaglio, formato, volume.
- Imposti l'importazione in Godot per pixel art e per grafica morbida.
- Gestisci musica ed effetti su bus separati, con i volumi regolabili.

### 5.0 Dove si trovano gli asset e cosa puoi farne: le licenze

*60 minuti · esercizi: costruisci, dato il risultato; ripara*

- **Impari:** Dove cercare grafica, suoni, musica e font gratuiti e come valutare la qualità di un pacchetto; Le licenze che incontrerai (CC0, CC BY, CC BY-SA, non commerciale, OFL) e cosa chiede ognuna; Tenere un registro: cosa hai preso, da dove, di chi è, con quale licenza.
- **Costruisci:** Per un incarico preciso (un gioco di carte a tema spaziale) scegli immagini, un font, tre suoni e una musica, e compili il registro degli asset. Poi ricevi la cartella degli asset di un gioco destinato alla vendita, con dodici file e le loro licenze: togli quelli che non si possono usare e completi il registro con ciò che ogni licenza ti obbliga a fare.
- **Come viene controllato:** La piattaforma controlla che i file ci siano, che ognuno abbia la sua riga completa nel registro e che le licenze dichiarate permettano l'uso richiesto; nella cartella ricevuta controlla quali file hai tenuto e gli obblighi che hai scritto per ognuno.

### 5.1 Importare immagini

*60 minuti · esercizi: costruisci, accompagnato; ripara*

- **Impari:** Cosa fa Godot quando trova un file nuovo: la cartella .godot e i file .import; Filtro, ripetizione, compressione: le impostazioni che cambiano l'aspetto; Pixel art nitida o grafica morbida: l'impostazione di tutto il progetto e le eccezioni.
- **Costruisci:** Lo stesso gioco in due versioni: una in pixel art nitida, una con grafica morbida. Poi ricevi un progetto in cui tutto è sfocato o seghettato e lo sistemi.
- **Come viene controllato:** La piattaforma legge le impostazioni del progetto e dei singoli file importati.

### 5.2 Fogli di sprite: un'immagine, tanti pezzi

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Mostrare solo una parte di un'immagine: region e fotogrammi; AtlasTexture: un pezzo di un foglio usato come immagine a sé; Leggere la griglia di un foglio fatto da altri: dimensione delle celle, margini, spazi.
- **Costruisci:** Le icone del gioco prese da un unico foglio; le carte di un mazzo ritagliate da un foglio con margini e spazi.
- **Come viene controllato:** La piattaforma controlla le regioni usate: ogni icona deve corrispondere alla cella giusta, senza pezzi delle celle vicine.

### 5.3 Adattare un'immagine al progetto

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Con un programma di grafica gratuito: ridimensionare senza sfocare, ritagliare, togliere uno sfondo; Cambiare colore in Godot senza toccare il file; NinePatchRect: un riquadro che si allarga senza deformare i bordi.
- **Costruisci:** Tre immagini trovate in rete portate alle dimensioni e al formato chiesti, con sfondo trasparente; un pannello dell'interfaccia che resta nitido a qualsiasi dimensione.
- **Come viene controllato:** La piattaforma legge i file: dimensioni, formato, trasparenza presente; controlla i margini del NinePatchRect a due dimensioni diverse.

### 5.4 Font

*45 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Importare un font e usarlo nel tema; Dimensioni, contorno, spaziatura; un font di riserva per i caratteri che mancano; Le licenze dei font.
- **Costruisci:** Un font per i titoli e uno per il testo in tutto il gioco, con le lettere accentate che si vedono bene.
- **Come viene controllato:** La piattaforma controlla i font nel tema e che una frase con lettere accentate e simboli non mostri caratteri mancanti.

### 5.5 Suoni e musica

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** WAV per gli effetti, Ogg per la musica; la ripetizione senza stacco; AudioStreamPlayer: far partire un suono, fermarlo, cambiarne volume e intonazione; Perché un suono si tronca, e come evitarlo.
- **Costruisci:** Effetti per stella presa, sasso, fine partita; musica che gira senza stacco. Poi ricevi un gioco in cui i suoni si tagliano a vicenda e lo sistemi.
- **Come viene controllato:** La piattaforma fa succedere gli eventi e controlla quale suono è in riproduzione, e che due suoni vicini si sentano entrambi.

### 5.6 Bus audio, volumi e impostazioni

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** I bus: far passare musica ed effetti da canali separati; Decibel e cursori: perché un cursore lineare suona sbagliato e come si converte; Salvare le impostazioni e ritrovarle al prossimo avvio.
- **Costruisci:** Menu dei volumi con tre cursori (generale, musica, effetti) e un pulsante per il silenzio; le scelte restano dopo la chiusura.
- **Come viene controllato:** La piattaforma muove i cursori e legge il volume dei bus; chiude, riapre e controlla che i valori siano rimasti.

### 5.7 Adattare un suono al progetto

*45 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Con un programma audio gratuito: tagliare il silenzio, portare i suoni allo stesso volume, esportare nel formato giusto; Preparare una musica che si ripete senza stacco; Tenere piccoli i file.
- **Costruisci:** Cinque suoni trovati in rete, con durate e volumi diversi, portati allo stesso livello, tagliati ed esportati nel formato adatto.
- **Come viene controllato:** La piattaforma legge i file: formato, durata entro i limiti chiesti, silenzio iniziale assente, livello massimo simile tra tutti.

### 5.8 Tenere in ordine un progetto

*45 minuti · esercizi: riordina*

- **Impari:** Cartelle per funzione e nomi coerenti; Spostare e rinominare i file dentro Godot, mai da fuori; Riconoscere e riparare un collegamento rotto.
- **Costruisci:** Ricevi un progetto con trenta file tutti nella cartella principale, nomi a caso e due collegamenti rotti, e lo riordini secondo le convenzioni del corso.
- **Come viene controllato:** La piattaforma controlla struttura e nomi, carica ogni scena e risorsa (nessun collegamento rotto) e rifà i controlli sul gioco.

### 5.9 Progetto «Rivesti il tuo gioco» – tappa 1: scegliere e preparare

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Scegliere asset che stanno bene insieme e prepararli tutti prima di usarli.
- **Costruisci:** Grafica, font, effetti e musica trovati da te, adattati e importati, con il registro completo.
- **Come viene controllato:** La piattaforma controlla file, impostazioni di importazione, formati e registro.

### 5.10 Progetto «Rivesti il tuo gioco» – tappa 2: dentro al gioco

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Sostituire aspetto e suono di un gioco senza romperne il funzionamento.
- **Costruisci:** Il gioco con il nuovo aspetto, suoni su ogni evento, musica, menu dei volumi che si ricorda le scelte, schermata dei crediti generata dal registro.
- **Come viene controllato:** La piattaforma rifà tutti i controlli del gioco originale, poi controlla suoni, bus, impostazioni salvate e che i crediti elenchino tutte le righe del registro.

<a id="fase-6--f06-visual-novel"></a>

## Fase 6 — Visual novel: il primo gioco completo

*35 ore · 25 lezioni · 4 tappe di progetto*

Costruisci da zero il motore di una visual novel: la storia scritta come dati, un interprete che la esegue, scelte, variabili, salvataggi, impostazioni, più lingue. Poi lo usi per una storia tua, la esporti e la pubblichi. È il primo gioco che porti dall'idea a qualcosa che un'altra persona può scaricare.

**Il gioco che cresce:** «Storie»: un motore per visual novel con una storia di esempio. Cresce di un sistema a ogni lezione, e ogni sistema resta separato dagli altri.

**La prova, da un progetto vuoto:** «La tua visual novel»: una storia tua di almeno dieci minuti, con almeno due finali che dipendono dalle scelte, asset trovati da te, salvataggi, impostazioni, e tre funzioni che aggiungi al motore da solo. Esportata per Windows e per il Web.

**Alla fine di questa fase:**

- Scomponi un gioco in sistemi e li costruisci uno alla volta senza che si intralcino.
- Scrivi un interprete: un programma che legge dei dati e li esegue.
- Salvi e ricarichi lo stato completo di un gioco, su più salvataggi.
- Esporti un gioco, lo fai provare e lo pubblichi.
- Valuti un plugin e decidi se usarlo o farne a meno.

### 6.0 Com'è fatta una visual novel: scomporre un gioco in pezzi

*45 minuti · lezione di metodo · esercizi: costruisci, dato il risultato*

- **Impari:** Guardare un gioco finito ed elencare i sistemi che lo compongono; Decidere cosa è dato (la storia) e cosa è programma (ciò che la esegue); Stabilire l'ordine: cosa serve per primo, cosa può aspettare.
- **Costruisci:** La mappa dei sistemi del motore, con per ognuno cosa fa, cosa gli serve dagli altri e in quale ordine lo costruirai; la struttura delle cartelle del progetto.
- **Come viene controllato:** La piattaforma controlla che la mappa nomini i sistemi indispensabili e che ogni dipendenza indicata esista; il progetto ha la struttura dichiarata.

### 6.1 La finestra di dialogo

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** RichTextLabel e BBCode: grassetto, corsivo, colore dentro al testo; Una scena dell'interfaccia con una sola funzione pubblica per mostrare una battuta; Testo lungo: andare a capo, adattare, scorrere.
- **Costruisci:** dialogue_box.tscn: nome di chi parla, testo, indicatore «continua». Una funzione show_line(speaker, text).
- **Come viene controllato:** La piattaforma chiama la funzione con battute corte, lunghe e con BBCode e legge cosa viene mostrato e se resta dentro al riquadro.

### 6.2 Testo che compare lettera per lettera

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; prevedi*

- **Impari:** visible_characters e visible_ratio: mostrare una parte del testo; Il clic ha due significati: completa la battuta, oppure passa alla prossima; _unhandled_input: leggere un tasto solo se l'interfaccia non l'ha già usato.
- **Costruisci:** Le battute compaiono a una velocità regolabile; un clic durante la scrittura la completa, un clic a testo completo fa avanzare; un segnale avvisa quando la battuta è finita.
- **Come viene controllato:** La piattaforma legge i caratteri visibili nel tempo, clicca a metà e a fine battuta e controlla i due effetti e il segnale.

### 6.3 La storia come dati

*75 minuti · esercizi: costruisci, accompagnato; scrivi i dati; costruisci, dato il risultato*

- **Impari:** Progettare un formato: cosa serve per descrivere una battuta; Caricare la storia da un file e scorrerla una voce alla volta; Tenere separato chi legge la storia da chi la mostra.
- **Costruisci:** Il formato del file della storia e la classe StoryPlayer che lo carica e avanza. La finestra di dialogo non sa da dove arriva il testo. Scrivi una scena di venti battute nel formato.
- **Come viene controllato:** La piattaforma dà al motore una storia sua e la fa avanzare fino in fondo, controllando ordine e testo di ogni battuta; controlla che la tua scena rispetti il formato.

### 6.4 Personaggi: figure, espressioni, entrate e uscite

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Una Resource per ogni personaggio: nome, colore del nome, immagini delle espressioni; Mostrare, spostare e far uscire una figura con un'animazione; Mettere in evidenza chi parla.
- **Costruisci:** Il sistema dei personaggi: entrano da un lato, cambiano espressione, si spostano tra sinistra, centro e destra, escono; chi non parla si scurisce.
- **Come viene controllato:** La piattaforma dà i comandi e legge posizione, immagine mostrata e colore di ogni figura dopo ogni passo.

### 6.5 Sfondi e transizioni

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Gli strati di una scena: sfondo, figure, interfaccia; Dissolvenza tra due immagini e passaggio dal nero; Aspettare che una transizione finisca prima di proseguire.
- **Costruisci:** Cambio di sfondo in dissolvenza e chiusura a nero; la storia aspetta la fine della transizione.
- **Come viene controllato:** La piattaforma dà il comando e controlla immagine mostrata e trasparenze durante e dopo, e che la battuta successiva non parta prima.

### 6.6 Un interprete: far eseguire la storia

*75 minuti · esercizi: costruisci, accompagnato; estendi il codice di un altro; collauda*

- **Impari:** Ogni voce della storia è un comando con un tipo e dei dati; Un punto solo che legge il tipo e passa il lavoro al sistema giusto, aspettando che finisca; Aggiungere un comando nuovo senza toccare quelli che ci sono.
- **Costruisci:** L'interprete: battuta, sfondo, mostra, nascondi, espressione, attesa. Poi aggiungi da solo un comando (un tremolio dello schermo) e scrivi i controlli che lo provano.
- **Come viene controllato:** La piattaforma esegue una storia che usa tutti i comandi e controlla ordine ed effetti; esegue i tuoi controlli contro una versione giusta e due sbagliate del comando nuovo: devono promuovere solo la giusta.

### 6.7 Scelte

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; scrivi i dati*

- **Impari:** Un menu creato dai dati: tanti pulsanti quante sono le opzioni; Etichette e salti: la storia non è più una fila, è una rete; Fermare tutto il resto mentre si aspetta la scelta.
- **Costruisci:** Il comando di scelta: mostra le opzioni, aspetta, salta al punto giusto della storia. Una scena con tre bivi, due dei quali si ricongiungono.
- **Come viene controllato:** La piattaforma percorre la tua scena per ogni strada possibile e controlla le battute incontrate; dà scelte con due, tre e sei opzioni.

### 6.8 Variabili della storia e condizioni

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; prevedi*

- **Impari:** Lo stato della storia: un posto solo dove stanno le variabili; Comandi che cambiano una variabile e condizioni che la leggono; Descrivere una condizione come dato (variabile, confronto, valore) e valutarla.
- **Costruisci:** Variabili, comandi «imposta» e «aggiungi», battute e opzioni che compaiono solo a certe condizioni. Una scena in cui una scelta fatta all'inizio cambia una battuta alla fine.
- **Come viene controllato:** La piattaforma valuta condizioni con stati noti; percorre la tua scena per due strade e controlla variabili e battute. Per cinque piccole storie devi scrivere il valore finale delle variabili prima di eseguirle.

### 6.9 Capitoli: la storia su più file

*45 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Dividere una storia lunga in file e saltare da uno all'altro; Dare a ogni punto della storia un indirizzo che non cambia; Caricare un capitolo solo quando serve.
- **Costruisci:** Tre capitoli in tre file, con salti tra capitoli e una struttura di cartelle per storia, immagini e audio.
- **Come viene controllato:** La piattaforma percorre una storia sua su tre file con salti avanti e indietro.

### 6.10 Uno strumento per te: controllare la storia prima di giocarla

*60 minuti · esercizi: costruisci, dato il risultato; collauda*

- **Impari:** Scrivere un programma che controlla dei dati e spiega cosa non va e dove; Gli errori tipici di una storia: salto verso un'etichetta che non c'è, personaggio sconosciuto, variabile mai impostata, punto mai raggiungibile; Percorrere una rete di collegamenti senza girare in tondo.
- **Costruisci:** Un controllore che legge tutti i file della storia ed elenca gli errori con file e riga, e che si può lanciare dall'editor.
- **Come viene controllato:** La piattaforma gli dà una storia corretta (nessun errore) e storie con errori noti: deve trovarli tutti, senza segnalarne di falsi.

### 6.11 Musica, effetti e voci nella storia

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Un gestore dell'audio che vive sopra le scene; Passare da una musica all'altra in dissolvenza; Effetti che non si interrompono a vicenda.
- **Costruisci:** Comandi per musica, effetto e silenzio; la musica continua tra una scena e l'altra e cambia in dissolvenza.
- **Come viene controllato:** La piattaforma dà i comandi e controlla cosa suona e a che volume durante e dopo la dissolvenza.

### 6.12 Dare vita al testo

*60 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Segni dentro al testo che cambiano il ritmo: una pausa, un rallentamento; Leggere un testo e separare ciò che va mostrato da ciò che va eseguito; Gli effetti di RichTextLabel, e come se ne scrive uno.
- **Costruisci:** Pause e cambi di velocità scritti dentro alle battute; una parola che trema. Come si crea un effetto di testo tuo lo trovi nella documentazione.
- **Come viene controllato:** La piattaforma legge i caratteri visibili nel tempo per una battuta con pause, e controlla che i segni non compaiano nel testo mostrato.

### 6.13 Il primo shader: una dissolvenza con una maschera

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Cos'è uno shader: un piccolo programma eseguito per ogni punto dell'immagine; Leggere un'immagine e scegliere se mostrare un punto oppure no; Comandare uno shader dal codice con un parametro.
- **Costruisci:** Una transizione in cui lo sfondo nuovo compare seguendo il disegno di un'immagine in bianco e nero, comandata da un parametro da 0 a 1.
- **Come viene controllato:** La piattaforma controlla che lo shader si compili, che il parametro esista e che la transizione lo porti da 0 a 1 nel tempo chiesto.

### 6.14 Menu principale e gestione delle scene

*60 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Un gestore delle scene con una dissolvenza tra l'una e l'altra; Riusare ciò che hai costruito: menu, tema, focus; «Continua» compare solo se c'è qualcosa da continuare.
- **Costruisci:** Titolo, «Nuova partita», «Continua», «Carica», «Impostazioni», «Esci»; ritorno al titolo dal gioco con conferma.
- **Come viene controllato:** La piattaforma naviga tutti i percorsi tra le schermate, con il mouse e con la sola tastiera.

### 6.15 Salvare e caricare: lo stato del gioco

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** Elencare tutto ciò che serve per riprendere esattamente da qui; Ogni sistema dice il suo stato e lo sa ripristinare; Un numero di versione nel salvataggio, per quando il formato cambierà.
- **Costruisci:** Salvataggio e caricamento completi: punto della storia, variabili, sfondo, figure con espressione e posizione, musica. Poi ricevi un motore in cui il caricamento dimentica due cose e le trovi.
- **Come viene controllato:** La piattaforma salva in dieci punti diversi di una storia, ricarica ognuno e confronta tutto lo stato con quello del momento del salvataggio.

### 6.16 Più salvataggi, con data e miniatura

*75 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Una schermata dei salvataggi creata dai file che esistono; Catturare ciò che c'è sullo schermo e salvarlo come immagine; Sovrascrivere ed eliminare, con conferma.
- **Costruisci:** Schermata con dodici posti: miniatura, capitolo, data. Salva, carica, sovrascrivi, elimina. Come si cattura lo schermo lo trovi nella documentazione.
- **Come viene controllato:** La piattaforma salva in più posti, controlla file e miniature, sovrascrive, elimina e ricarica.

### 6.17 Impostazioni che restano

*45 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** ConfigFile: un file di impostazioni con sezioni e valori; Applicare le impostazioni all'avvio, prima che si veda qualcosa; Valori predefiniti quando il file non c'è o è vecchio.
- **Costruisci:** Velocità del testo, volumi, schermo intero: si regolano, si applicano subito, si ritrovano al prossimo avvio.
- **Come viene controllato:** La piattaforma cambia ogni impostazione, chiude, riapre e controlla; toglie il file e controlla i valori predefiniti.

### 6.18 Storico, salto del testo già letto, avanzamento automatico

*75 minuti · esercizi: costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Tenere memoria di ciò che è stato mostrato; Ricordare tra una partita e l'altra quali battute sono già state lette; Tre modi di avanzare (a mano, automatico, veloce) come stati dello stesso sistema.
- **Costruisci:** Storico scorrevole delle ultime cento battute; avanzamento automatico con attesa proporzionale alla lunghezza; salto veloce che si ferma al primo testo mai letto e alle scelte.
- **Come viene controllato:** La piattaforma legge lo storico dopo un percorso noto; attiva il salto su una storia letta a metà e controlla dove si ferma.

### 6.19 Più lingue

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Chiavi al posto delle frasi, e una tabella con una colonna per lingua; tr() e il cambio di lingua mentre il gioco gira; Cosa tradurre nella storia e cosa no: i testi sì, i nomi dei comandi no.
- **Costruisci:** Interfaccia e storia di esempio in italiano e in inglese, con la scelta nelle impostazioni; il cambio di lingua aggiorna subito anche la battuta sullo schermo.
- **Come viene controllato:** La piattaforma cambia lingua nel menu e a metà di una battuta e legge i testi mostrati; cerca nell'interfaccia frasi rimaste scritte a mano.

### 6.20 Galleria e finali sbloccati

*45 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Dati che appartengono al giocatore e non a una partita; Sbloccare qualcosa quando succede un fatto nella storia; Una schermata che mostra il posseduto e nasconde il resto.
- **Costruisci:** Elenco dei finali raggiunti e galleria delle immagini viste, che restano anche iniziando una nuova partita.
- **Come viene controllato:** La piattaforma raggiunge un finale, comincia una partita nuova e controlla che lo sblocco resti; controlla cosa mostra la galleria prima e dopo.

### 6.21 Usare il lavoro degli altri: i plugin

*60 minuti · lezione di metodo · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Trovare un plugin, installarlo e attivarlo; Valutarlo: licenza, ultimo aggiornamento, documentazione, versione di Godot; Costruire o adottare: cosa guadagni e cosa perdi in ciascun caso.
- **Costruisci:** In un progetto a parte installi Dialogic 2 e rifai con quello la prima scena della storia di esempio. Prima di fidarti controlli quattro cose (licenza, data dell'ultimo aggiornamento, versione di Godot richiesta, se è documentato ciò che ti serve) e le scrivi nel registro, come per qualsiasi asset.
- **Come viene controllato:** La piattaforma controlla che il plugin sia installato e attivo, esegue la scena e legge le battute mostrate; controlla le quattro voci nel registro.

### 6.22 Esportare: Windows e Web

*75 minuti · esercizi: costruisci, accompagnato; ripara*

- **Impari:** Modelli di esportazione e preimpostazioni; Quali file finiscono nel gioco esportato, e quali restano fuori se non lo dici; Le differenze tra editor e gioco esportato che fanno comparire errori nuovi.
- **Costruisci:** Il gioco esportato per Windows e per il Web. Poi ricevi un progetto che nell'editor funziona e una volta esportato no (file della storia non inclusi, un percorso scritto con maiuscole diverse) e lo sistemi.
- **Come viene controllato:** La piattaforma controlla le preimpostazioni e i file prodotti, ed esegue il gioco esportato fino alla terza battuta.

### 6.23 Pubblicare su itch.io

*45 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Preparare ciò che serve: archivio, versione per il browser, immagini, descrizione, crediti; Creare la pagina e caricare il gioco; Numerare le versioni.
- **Costruisci:** La pagina del gioco con la versione per Windows e quella giocabile nel browser. Puoi tenerla privata.
- **Come viene controllato:** La piattaforma controlla il pacchetto pronto sul disco (archivio, immagini, descrizione, crediti completi). La pubblicazione in sé la confermi tu.

### 6.24 Collaudo: far provare il gioco e correggere

*45 minuti · lezione di metodo · esercizi: costruisci, dato il risultato; collauda*

- **Impari:** Provare il proprio gioco con un elenco, non a caso; Scrivere una segnalazione che permetta di rifare l'errore; Decidere cosa correggere subito e cosa lasciare.
- **Costruisci:** L'elenco di collaudo del motore; lo esegui, scrivi le segnalazioni di ciò che trovi, correggi, e segni ogni correzione in Git.
- **Come viene controllato:** La piattaforma controlla l'elenco (deve coprire ogni sistema), il formato delle segnalazioni e la storia in Git.

### 6.25 Progetto «La tua visual novel» – tappa 1: storia e materiali

*120 minuti · progetto · esercizi: da un progetto vuoto; scrivi i dati*

- **Impari:** Progettare una storia che sta nel tempo che hai, e raccogliere ciò che le serve.
- **Costruisci:** Lo schema della storia (scene, bivi, variabili, almeno due finali), i personaggi, e tutti gli asset trovati e adattati con il registro.
- **Come viene controllato:** La piattaforma controlla lo schema (finali, variabili usate in almeno una condizione), gli asset e il registro.

### 6.26 Progetto «La tua visual novel» – tappa 2: scrivere la storia

*150 minuti · progetto · esercizi: da un progetto vuoto; scrivi i dati*

- **Impari:** Produrre contenuto con il proprio strumento, e correggerlo quando non basta.
- **Costruisci:** La storia scritta per intero nel formato del motore, giocabile dall'inizio a ogni finale.
- **Come viene controllato:** Il tuo controllore non trova errori; la piattaforma percorre la storia per ogni strada: ogni finale è raggiungibile, nessun punto è irraggiungibile, la durata stimata supera i dieci minuti.

### 6.27 Progetto «La tua visual novel» – tappa 3: tre funzioni tue

*150 minuti · progetto · esercizi: da un progetto vuoto; trova nella documentazione*

- **Impari:** Aggiungere a un sistema esistente qualcosa che nessuna lezione ha spiegato.
- **Costruisci:** Tre funzioni scelte da un elenco e costruite da solo: per esempio un indicatore di affinità con un personaggio, il salvataggio rapido, un diario che si riempie, un minigioco dentro la storia, una mappa da cui scegliere la scena.
- **Come viene controllato:** Per ogni funzione dell'elenco la piattaforma ha i suoi controlli di comportamento; rifà poi tutti i controlli del motore, che deve funzionare come prima.

### 6.28 Progetto «La tua visual novel» – tappa 4: finire

*120 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Portare un gioco fino in fondo: rifinire, collaudare, esportare, consegnare.
- **Costruisci:** Audio e transizioni ovunque, salvataggi e impostazioni provati, due lingue per l'interfaccia, collaudo con l'elenco, esportazione per Windows e Web, pacchetto pronto per la pubblicazione.
- **Come viene controllato:** La piattaforma esegue il gioco esportato, salva e ricarica in tre punti, cambia impostazioni e lingua, e controlla il pacchetto.

<a id="fase-7--f07-azione-2d"></a>

## Fase 7 — 2D d'azione: movimento, fisica, livelli, nemici

*21,3 ore · 14 lezioni · 4 tappe di progetto*

Finora le collisioni le hai calcolate a mano. Ora usi la fisica di Godot: corpi, forme, aree, livelli a tessere, telecamera, proiettili, nemici che ti cercano. E impari il pezzo riutilizzabile, che scrivi una volta e monti su giocatore e nemici.

**Il gioco che cresce:** «Il custode»: un'avventura vista dall'alto. Stanze con muri, chiavi e porte, nemici che pattugliano e inseguono, cuori, proiettili, livelli a tessere, punto di salvataggio.

**La prova, da un progetto vuoto:** «Arena», da un progetto vuoto: nemici in ondate sempre più dure, si mira e si spara, i nemici lasciano esperienza, tra un'ondata e l'altra si sceglie un potenziamento tra tre, fine partita con record salvato.

**Alla fine di questa fase:**

- Fai muovere un personaggio con la fisica e lo fai scontrare con il mondo.
- Costruisci un livello con le tessere, collisioni comprese.
- Scrivi nemici che pattugliano, inseguono e aggirano gli ostacoli.
- Costruisci componenti riutilizzabili (vita, danno) invece di riscrivere.
- Misuri perché un gioco rallenta e lo sistemi.

### 7.0 Vettori per il movimento

*60 minuti · esercizi: prevedi; costruisci, dato il risultato*

- **Impari:** Un vettore è una direzione con una lunghezza: sommare, sottrarre, moltiplicare; normalized(): perché in diagonale si va più veloci, e come si evita; direction_to(), angle(), move_toward().
- **Costruisci:** Funzioni di movimento provate una per una: direzione dai tasti, velocità uguale in ogni direzione, avvicinamento graduale a un punto.
- **Come viene controllato:** Per otto calcoli scrivi il risultato prima di eseguirli; poi la piattaforma chiama le tue funzioni con valori noti, diagonali comprese.

### 7.1 CharacterBody2D e move_and_slide()

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** I tipi di corpo fisico e a cosa serve ognuno; _physics_process e velocity; move_and_slide() ferma e fa scivolare; Accelerare e frenare invece di partire e fermarsi di colpo.
- **Costruisci:** Il custode si muove in otto direzioni con accelerazione e frenata regolabili dall'Inspector.
- **Come viene controllato:** La piattaforma tiene premute le azioni e misura velocità massima, tempo per raggiungerla e spazio di frenata, diagonali comprese.

### 7.2 Muri, forme, layer e maschere

*75 minuti · esercizi: costruisci, accompagnato; ripara; costruisci, dato il risultato*

- **Impari:** StaticBody2D e le forme di collisione; Layer e maschere: su quale strato sto e quali strati vedo; Rendere visibili le collisioni mentre il gioco gira.
- **Costruisci:** Una stanza con muri e un tavolo; strati con un nome per giocatore, muri, nemici, oggetti. Poi ricevi un progetto in cui tre cose si attraversano e non dovrebbero. Infine imposti strati e maschere di sei oggetti perché valga una tabella data di chi urta chi.
- **Come viene controllato:** La piattaforma spinge il personaggio contro ogni ostacolo e controlla che si fermi; fa incontrare a due a due i sei oggetti e confronta chi si ferma e chi passa con la tabella.

### 7.3 Livelli a tessere: TileSet e TileMapLayer

*90 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; rifai uguale*

- **Impari:** Creare un TileSet da un foglio di immagini e dare le collisioni alle tessere; Dipingere su più strati: pavimento, muri, decorazioni; I terreni: bordi e angoli che si sistemano da soli.
- **Costruisci:** Il primo livello del gioco dipinto su tre strati con muri solidi. Poi riproduci una stanza partendo da una sua immagine.
- **Come viene controllato:** La piattaforma controlla strati, tessere con collisione e che il personaggio non attraversi i muri in venti punti; confronta la tua stanza con quella di riferimento cella per cella.

### 7.4 La telecamera

*45 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Camera2D che segue il personaggio; Limiti: non mostrare ciò che sta fuori dal livello; Ammorbidire il movimento.
- **Costruisci:** La telecamera segue il custode con dolcezza e si ferma ai bordi del livello, calcolati dalla mappa. Come si ottiene la grandezza della mappa lo trovi nella documentazione.
- **Come viene controllato:** La piattaforma porta il personaggio ai quattro angoli e controlla cosa inquadra la telecamera.

### 7.5 Area2D: oggetti da raccogliere e zone

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Un'area si accorge di chi entra e di chi esce, senza fermarlo; Riconoscere chi è entrato; Un oggetto raccoglibile come scena con dati esportati.
- **Costruisci:** Monete, cuori e chiavi da raccogliere; una zona che mostra un messaggio quando ci entri e lo toglie quando esci.
- **Come viene controllato:** La piattaforma fa camminare il personaggio sugli oggetti e nelle zone e controlla conteggi, oggetti spariti e messaggio; ci fa passare un nemico e controlla che non raccolga niente.

### 7.6 Porte, chiavi e interruttori

*60 minuti · esercizi: costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Oggetti del livello con un loro stato, che si parlano con i segnali; Collegare gli oggetti tra loro dall'Inspector; Un tasto «interagisci» che agisce su ciò che hai davanti.
- **Costruisci:** Porte che chiedono una chiave, interruttori che ne aprono una o più, una leva che va tenuta abbassata. In un livello scritto da altri aggiungi una piastra a pressione senza toccare le porte.
- **Come viene controllato:** La piattaforma risolve piccole stanze di prova nell'ordine giusto e in quello sbagliato e controlla lo stato di ogni porta.

### 7.7 Proiettili e mira

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** Creare una scena nel punto e nella direzione giusti; Mirare con il mouse o con una seconda leva; Tempo tra un colpo e l'altro, e togliere i proiettili che non servono più.
- **Costruisci:** Il custode spara dove mira con un ritmo massimo; i proiettili spariscono contro i muri e dopo due secondi. Poi ricevi un progetto in cui i proiettili si accumulano all'infinito.
- **Come viene controllato:** La piattaforma mira in quattro direzioni e controlla direzione e velocità dei proiettili, il ritmo tenendo premuto e il numero di nodi dopo un minuto di fuoco.

### 7.8 Vita e danno: un componente riutilizzabile

*75 minuti · esercizi: costruisci, accompagnato; collauda; estendi il codice di un altro*

- **Impari:** Un componente è un nodo con un solo compito, da montare su scene diverse; Chi colpisce e chi viene colpito: due aree con ruoli distinti; Tempo di intoccabilità dopo un colpo.
- **Costruisci:** I componenti Health, Hitbox e Hurtbox, usati uguali da giocatore, nemici e casse che si rompono. Scrivi tu i controlli di Health.
- **Come viene controllato:** La piattaforma monta i componenti su una scena sua e controlla danno, cura, morte e intoccabilità; esegue i tuoi controlli contro una versione giusta e tre sbagliate.

### 7.9 Nemici: pattugliare e inseguire

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Il comportamento di un nemico come stati: pattuglia, insegue, torna; Accorgersi del giocatore: distanza e linea di vista con RayCast2D; Punti di pattuglia messi nel livello.
- **Costruisci:** Un nemico che fa la ronda tra punti scelti nel livello, insegue quando ti vede (non attraverso i muri) e torna al suo giro quando ti perde.
- **Come viene controllato:** La piattaforma mette il giocatore fuori vista, in vista e dietro un muro e controlla lo stato del nemico e dove si dirige.

### 7.10 Nemici che trovano la strada

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Perché andare dritti verso il giocatore non basta; La zona percorribile ricavata dalle tessere e NavigationAgent2D; Ricalcolare la strada ogni tanto, non a ogni fotogramma.
- **Costruisci:** Il nemico raggiunge il giocatore girando attorno ai muri e passando dalle porte aperte.
- **Come viene controllato:** La piattaforma mette nemico e giocatore ai lati opposti di un muro con un solo varco e controlla che il nemico arrivi entro un tempo dato; chiude il varco e controlla che si fermi.

### 7.11 Oggetti spinti dalla fisica

*45 minuti · esercizi: costruisci, dato il risultato; ripara*

- **Impari:** RigidBody2D: lo muove la fisica, tu gli dai solo spinte; Massa, attrito, rimbalzo; Quale corpo usare per cosa.
- **Costruisci:** Casse che si spingono e che tengono abbassate le piastre a pressione; un barile che rotola. Poi ricevi una scena in cui sei oggetti hanno il tipo di corpo sbagliato (una porta che cade, una cassa che non si sposta, una piattaforma che si lascia spingere) e dai a ognuno quello giusto.
- **Come viene controllato:** La piattaforma spinge una cassa su una piastra e controlla che la porta si apra; nella scena ricevuta spinge, lascia cadere e urta ognuno dei sei oggetti e controlla come reagisce.

### 7.12 Riusare il proprio lavoro: menu e salvataggi in un gioco diverso

*60 minuti · esercizi: costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Portare in un altro progetto ciò che hai già scritto: cosa è generico e cosa no; Salvare un gioco d'azione: posizione, inventario, porte aperte, oggetti presi; Dare a ogni oggetto del livello un nome che resta uguale tra le partite.
- **Costruisci:** Menu, impostazioni e gestione delle scene della visual novel portati nel «Custode»; un punto di salvataggio che registra tutto lo stato del livello.
- **Come viene controllato:** La piattaforma gioca, salva, continua, ricarica e confronta posizione, inventario e stato di ogni porta e oggetto.

### 7.13 Quando il gioco rallenta: misurare

*45 minuti · lezione di metodo · esercizi: rendi veloce*

- **Impari:** Misurare prima di cambiare: i contatori e il profiler; Le cause più comuni: troppo lavoro a ogni fotogramma, troppi nodi, ricerche ripetute; Fare meno spesso, fare su meno oggetti, non rifare.
- **Costruisci:** Ricevi un'arena con cinquecento nemici che va a scatti e la porta a girare fluida senza cambiarne il comportamento.
- **Come viene controllato:** La piattaforma misura il tempo di calcolo di mille fotogrammi prima e dopo (deve scendere sotto una soglia) e rifà i controlli di comportamento.

### 7.14 Progetto «Arena» – tappa 1: muoversi e sparare

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Impostare da soli scene, strati di collisione e componenti di un gioco d'azione.
- **Costruisci:** Arena chiusa, giocatore che si muove, mira e spara, componenti di vita e danno.
- **Come viene controllato:** La piattaforma controlla movimento, muri, direzione e ritmo dei colpi, danno ricevuto.

### 7.15 Progetto «Arena» – tappa 2: nemici e ondate

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Descrivere nemici e ondate come dati.
- **Costruisci:** Tre tipi di nemico descritti come Resource, ondate descritte come dati, nemici che nascono ai bordi e inseguono.
- **Come viene controllato:** La piattaforma sostituisce i dati delle ondate con i suoi e controlla quanti e quali nemici nascono e come si comportano.

### 7.16 Progetto «Arena» – tappa 3: esperienza e potenziamenti

*105 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Progettare un sistema di potenziamenti che si sommano senza una catena di if.
- **Costruisci:** I nemici lasciano esperienza; a fine ondata il gioco si ferma e propone tre potenziamenti a caso tra almeno otto; gli effetti si sommano.
- **Come viene controllato:** La piattaforma raccoglie esperienza, sceglie potenziamenti noti e misura gli effetti (ritmo, danno, velocità), anche presi due volte.

### 7.17 Progetto «Arena» – tappa 4: gioco completo

*75 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Chiudere il giro: menu, fine partita, record, suoni, prestazioni.
- **Costruisci:** Menu, pausa, fine partita con record salvato, suoni e musica, cento nemici insieme senza scatti, esportazione per Windows.
- **Come viene controllato:** La piattaforma gioca una partita fino alla fine, controlla record e impostazioni salvate, misura il tempo di calcolo con cento nemici ed esegue il gioco esportato.

<a id="fase-8--f08-piattaforme"></a>

## Fase 8 — Piattaforme: animazione, stati, sensazione

*21,8 ore · 14 lezioni · 4 tappe di progetto*

Un gioco a piattaforme è il banco di prova della sensazione: come salta, come atterra, come reagisce. Impari le animazioni, la macchina a stati (lo schema che userai in ogni gioco), le particelle, i piccoli effetti che fanno la differenza. Alla fine hai il secondo gioco completo.

**Il gioco che cresce:** «Salti»: un personaggio animato che corre e salta, piattaforme mobili, pericoli, nemici, punti di ripartenza, tre livelli a tessere con sfondi in profondità, effetti e suoni, menu e salvataggio dei livelli sbloccati.

**La prova, da un progetto vuoto:** «Il tuo gioco a piattaforme», da un progetto vuoto: tre livelli brevi, asset trovati da te, una meccanica in più scelta da un elenco (scatto, doppio salto, salto sul muro, interruttori e piattaforme, gravità invertita), menu, salvataggio, esportazione.

**Alla fine di questa fase:**

- Regoli un salto finché «si sente» giusto, e sai quali numeri toccare.
- Animi un personaggio e fai seguire le animazioni a ciò che sta facendo.
- Scrivi una macchina a stati e ne riconosci il bisogno.
- Aggiungi particelle, scuotimenti, lampeggi e suoni che danno peso alle azioni.
- Porti a termine un secondo gioco completo riusando il lavoro già fatto.

### 8.0 Gravità e salto

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; prevedi*

- **Impari:** La gravità come accelerazione; is_on_floor(); Altezza e durata del salto calcolate, invece di numeri trovati a tentativi; Salto più basso se lasci subito il tasto.
- **Costruisci:** Il personaggio corre e salta; altezza e durata del salto si scelgono dall'Inspector e il codice calcola gravità e spinta.
- **Come viene controllato:** La piattaforma misura altezza massima e durata con tocco breve e lungo e controlla che non si possa saltare in aria; per tre coppie di valori scrivi l'altezza attesa prima di provarla.

### 8.1 Un salto che perdona

*45 minuti · esercizi: costruisci, dato il risultato; rifai uguale*

- **Impari:** Saltare ancora per un istante dopo aver lasciato il bordo; Ricordare il tasto premuto un istante prima di toccare terra; Accelerazione diversa a terra e in aria.
- **Costruisci:** Le due tolleranze del salto, regolabili; controllo in aria ridotto. Poi regoli il personaggio finché si comporta come quello di un gioco di riferimento che puoi provare.
- **Come viene controllato:** La piattaforma preme il salto pochi fotogrammi dopo il bordo e pochi prima dell'atterraggio, dentro e fuori tolleranza; confronta altezza, durata e distanza del salto con il riferimento.

### 8.2 Animazioni a fotogrammi

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** SpriteFrames: più animazioni ricavate da un foglio di immagini; Scegliere l'animazione da ciò che il personaggio sta facendo; Girare il personaggio nel verso in cui va.
- **Costruisci:** Fermo, corsa, salto, caduta, con il personaggio girato nel verso giusto.
- **Come viene controllato:** La piattaforma mette il personaggio in ogni situazione e legge animazione in corso e verso.

### 8.3 La macchina a stati

*90 minuti · esercizi: costruisci, accompagnato; estendi il codice di un altro; riordina*

- **Impari:** Il problema: tante variabili vero/falso che si contraddicono; Uno stato alla volta, con entrata, uscita, aggiornamento e passaggi; Ogni stato in un suo script, con una classe base comune.
- **Costruisci:** Ricevi un personaggio che funziona ma è scritto con dodici variabili vero/falso e lo riscrivi come macchina a stati; poi aggiungi lo stato «accovacciato» senza toccare gli altri.
- **Come viene controllato:** La piattaforma rifà tutti i controlli di comportamento (devono passare come prima), legge lo stato corrente in dieci situazioni e controlla il nuovo stato.

### 8.4 AnimationPlayer: animare qualsiasi cosa

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Tracce e fotogrammi chiave su qualsiasi proprietà di qualsiasi nodo; Chiamare una funzione in un punto preciso dell'animazione; Accorgersi di quando un'animazione finisce.
- **Costruisci:** Un attacco con la sua animazione, in cui il colpo è attivo solo nei fotogrammi giusti; una porta che si apre; un cartello che oscilla da solo.
- **Come viene controllato:** La piattaforma legge le tracce e segue nel tempo le proprietà animate; controlla che il colpo faccia danno solo nell'intervallo attivo.

### 8.5 AnimationTree: comandare le animazioni

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Una macchina a stati fatta apposta per le animazioni; Passaggi con condizioni e passaggi comandati dal codice; Mescolare due animazioni secondo un valore.
- **Costruisci:** Le animazioni del personaggio passano all'AnimationTree, con passaggi morbidi tra corsa e fermo.
- **Come viene controllato:** La piattaforma legge l'animazione in corso in ogni situazione e durante i passaggi.

### 8.6 Piattaforme mobili, a senso unico, scale

*60 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** AnimatableBody2D: una piattaforma che ti porta con sé; Piattaforme che si attraversano da sotto e da cui si può scendere; Una zona che cambia le regole del movimento: la scala.
- **Costruisci:** Piattaforme che vanno avanti e indietro lungo un percorso, piattaforme a senso unico da cui scendi con giù più salto, scale. Le impostazioni necessarie le trovi nella documentazione.
- **Come viene controllato:** La piattaforma fa salire il personaggio su una piattaforma mobile e controlla che si muova con lei; lo fa passare da sotto e scendere; lo fa arrampicare.

### 8.7 Pericoli, punti di ripartenza, rinascita

*60 minuti · esercizi: costruisci, dato il risultato; ripara*

- **Impari:** Riusare i componenti di vita e danno in un gioco diverso; La sequenza di morte e rinascita scritta con le attese; Rimettere il livello com'era: cosa torna e cosa resta.
- **Costruisci:** Spine, vuoto sotto al livello, bandierine di ripartenza; alla morte una breve sequenza e si riparte dall'ultima bandierina. Poi ricevi un progetto in cui dopo la rinascita il personaggio resta bloccato.
- **Come viene controllato:** La piattaforma fa morire il personaggio in tre modi, prima e dopo una bandierina, e controlla dove riparte, in che stato e con quali nemici e oggetti.

### 8.8 Nemici a piattaforme

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Camminare fino al bordo e girarsi: RayCast2D verso il basso; Da dove arriva l'urto: saltarci sopra o toccarlo di lato; Varianti dello stesso nemico con dati diversi.
- **Costruisci:** Un nemico che cammina e si gira ai bordi e ai muri, si elimina saltandoci sopra con un rimbalzo; uno che lancia proiettili a intervalli; uno che vola avanti e indietro.
- **Come viene controllato:** La piattaforma controlla il giro del nemico su piattaforme di lunghezze diverse e l'urto dall'alto e di lato.

### 8.9 Livelli: terreni, sfondi in profondità, più livelli

*75 minuti · esercizi: costruisci, dato il risultato; rifai uguale*

- **Impari:** Terreni che disegnano da soli bordi e angoli; Sfondi che scorrono a velocità diverse; Un gestore dei livelli: fine livello, livello successivo, conteggio degli oggetti.
- **Costruisci:** Tre livelli con terreni, sfondo su tre piani, un traguardo che porta al livello dopo. Un livello lo ricostruisci da una sua immagine.
- **Come viene controllato:** La piattaforma controlla tessere e collisioni, lo scorrimento degli sfondi rispetto alla telecamera e il passaggio tra i livelli.

### 8.10 Particelle

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** GPUParticles2D e il materiale che descrive come nascono, si muovono e muoiono; Sbuffi singoli ed emissioni continue; Far partire un effetto nel punto e nel momento giusti.
- **Costruisci:** Polvere all'atterraggio e alla partenza, scintille quando raccogli una moneta, frammenti quando un nemico viene eliminato.
- **Come viene controllato:** La piattaforma fa succedere i tre eventi e controlla che l'effetto giusto parta nel punto giusto e che i nodi vengano tolti alla fine.

### 8.11 Dare peso alle azioni

*60 minuti · esercizi: costruisci, dato il risultato; rifai uguale*

- **Impari:** Schiacciare e allungare il personaggio; Scuotere la telecamera e fermare il gioco per un istante al momento dell'urto; Suoni con piccole variazioni, perché non siano sempre uguali.
- **Costruisci:** Deformazione al salto e all'atterraggio, scuotimento e fermo immagine quando vieni colpito, suoni con intonazione variabile. Ricevi lo stesso gioco con e senza questi effetti e porti il tuo al livello della versione rifinita.
- **Come viene controllato:** La piattaforma legge la scala del personaggio attorno a salto e atterraggio, lo scostamento della telecamera e la velocità del tempo attorno a un colpo, e che tutto torni normale.

### 8.12 Shader utili: lampeggio e contorno

*60 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Leggere il colore di un punto dell'immagine e cambiarlo; Un parametro comandato dal codice; Guardare i punti vicini per disegnare un contorno.
- **Costruisci:** Il personaggio lampeggia di bianco quando viene colpito; gli oggetti con cui puoi interagire hanno un contorno quando sei vicino.
- **Come viene controllato:** La piattaforma controlla che gli shader si compilino, colpisce il personaggio e legge il parametro nel tempo; avvicina e allontana il personaggio da un oggetto.

### 8.13 Il gioco completo

*60 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Montare il guscio (menu, impostazioni, salvataggi) attorno a un gioco nuovo; Una schermata di scelta del livello con i livelli sbloccati; Esportare e provare il gioco esportato.
- **Costruisci:** Menu, scelta del livello, pausa, salvataggio dei livelli sbloccati e del miglior tempo, esportazione per Windows e Web.
- **Come viene controllato:** La piattaforma completa il primo livello, controlla che il secondo sia sbloccato anche dopo aver chiuso e riaperto, ed esegue il gioco esportato.

### 8.14 Progetto «Il tuo gioco a piattaforme» – tappa 1: il personaggio

*105 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Costruire da soli un personaggio con macchina a stati e animazioni, da asset trovati.
- **Costruisci:** Personaggio con asset tuoi: corsa, salto con le tolleranze, animazioni, macchina a stati.
- **Come viene controllato:** La piattaforma misura il salto, legge stati e animazioni nelle situazioni di base, controlla il registro degli asset.

### 8.15 Progetto «Il tuo gioco a piattaforme» – tappa 2: la tua meccanica

*105 minuti · progetto · esercizi: da un progetto vuoto; trova nella documentazione*

- **Impari:** Aggiungere una meccanica che nessuna lezione ha spiegato.
- **Costruisci:** Una meccanica scelta dall'elenco (scatto, doppio salto, salto sul muro, interruttori e piattaforme, gravità invertita), come nuovo stato o nuovo componente.
- **Come viene controllato:** Per ogni meccanica dell'elenco la piattaforma ha i suoi controlli di comportamento.

### 8.16 Progetto «Il tuo gioco a piattaforme» – tappa 3: livelli e nemici

*105 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Costruire livelli che insegnano la meccanica al giocatore, un passo alla volta.
- **Costruisci:** Tre livelli brevi che introducono, sviluppano e mettono alla prova la tua meccanica; due tipi di nemico, pericoli, bandierine.
- **Come viene controllato:** La piattaforma controlla che ogni livello abbia partenza, traguardo raggiungibile, almeno una bandierina e gli elementi chiesti; fa morire e rinascere il personaggio.

### 8.17 Progetto «Il tuo gioco a piattaforme» – tappa 4: finire

*75 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Rifinire e consegnare.
- **Costruisci:** Effetti e suoni, menu e scelta del livello, salvataggio, collaudo con l'elenco, esportazione.
- **Come viene controllato:** La piattaforma controlla effetti e suoni sugli eventi principali, il salvataggio dopo riavvio ed esegue il gioco esportato.

<a id="fase-9--f09-3d-basi"></a>

## Fase 9 — 3D: le basi

*20,8 ore · 13 lezioni · 3 tappe di progetto*

Una dimensione in più cambia come si pensa: assi, rotazioni, luci, telecamere. Tutto ciò che sai di nodi, segnali, fisica e stati vale ancora. Qui impari lo spazio 3D, a dare forma e luce a una scena, a far muovere un personaggio e a seguirlo con la telecamera, a importare modelli e animazioni fatti da altri.

**Il gioco che cresce:** «L'isola»: un personaggio in terza persona cammina, corre e salta su un'isola costruita a blocchi, raccoglie cristalli, apre passaggi, spinge oggetti. Con modelli e animazioni importati.

**La prova, da un progetto vuoto:** «Percorso a ostacoli», da un progetto vuoto: un percorso 3D in terza persona con piattaforme mobili, oggetti da raccogliere, punti di ripartenza, tempo, schermata d'arrivo. Modelli trovati da te.

**Alla fine di questa fase:**

- Ti orienti nello spazio 3D: assi, posizioni, rotazioni, locale e globale.
- Costruisci e illumini una scena.
- Scrivi un personaggio in terza persona e uno in prima, con la loro telecamera.
- Importi un modello con le sue animazioni e lo fai funzionare nel gioco.

### 9.0 Lo spazio 3D

*75 minuti · esercizi: costruisci, accompagnato; rifai uguale; prevedi*

- **Impari:** Muoversi nell'editor 3D; i tre assi, con Y verso l'alto e l'avanti verso −Z; Node3D: posizione, rotazione, scala; locale e globale; Le unità sono metri: dare alle cose dimensioni sensate.
- **Costruisci:** Una piccola scena di blocchi ricostruita da una descrizione con misure e posizioni. Per otto nodi figli scrivi la posizione globale prima di leggerla.
- **Come viene controllato:** La piattaforma legge posizioni, rotazioni e scale e le confronta con quelle di riferimento entro una tolleranza.

### 9.1 Vettori e rotazioni in 3D

*75 minuti · esercizi: prevedi; costruisci, dato il risultato*

- **Impari:** Vector3 e le direzioni proprie di un oggetto: il suo avanti, il suo destra, il suo alto; Ruotare attorno a un asse, guardare verso un punto, gradi e radianti; Girarsi con gradualità invece che di scatto.
- **Costruisci:** Una torretta che si gira verso un bersaglio a velocità limitata; una freccia che indica sempre l'uscita; un oggetto che avanza nel verso in cui guarda.
- **Come viene controllato:** La piattaforma sposta il bersaglio e misura l'angolo della torretta nel tempo; per sei situazioni scrivi il vettore risultante prima di eseguire.

### 9.2 Mesh e materiali

*75 minuti · esercizi: costruisci, accompagnato; rifai uguale*

- **Impari:** MeshInstance3D e le forme di base; StandardMaterial3D: colore, ruvidità, metallo, luce propria, immagini; Un materiale condiviso tra più oggetti, o uno per oggetto.
- **Costruisci:** Cinque materiali (legno opaco, metallo lucido, plastica, vetro, cristallo luminoso) applicati agli oggetti dell'isola secondo una tabella.
- **Come viene controllato:** La piattaforma legge le proprietà di ogni materiale e a quali oggetti è applicato.

### 9.3 Luci, ombre e ambiente

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Luce direzionale, puntiforme, a cono; quando accendere le ombre; WorldEnvironment: cielo, luce ambientale, nebbia, bagliore; La stessa scena in atmosfere diverse cambiando solo luce e ambiente.
- **Costruisci:** L'isola di giorno, al tramonto e di notte con una lanterna: tre impostazioni di luce e ambiente che si scambiano con un tasto.
- **Come viene controllato:** La piattaforma legge luci e ambiente delle tre impostazioni (tipo, colore, energia, ombre, cielo, nebbia) e controlla lo scambio.

### 9.4 La telecamera 3D

*45 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Campo visivo, distanza minima e massima; Più telecamere e quale è attiva; Dal mondo allo schermo: dove appare un punto 3D.
- **Costruisci:** Tre inquadrature fisse dell'isola che si alternano; un'etichetta dell'interfaccia che resta sopra un cristallo mentre la telecamera si muove. Il metodo che serve lo trovi nella documentazione.
- **Come viene controllato:** La piattaforma cambia telecamera e controlla quale è attiva; muove la telecamera e controlla che l'etichetta segua il cristallo.

### 9.5 Costruire un livello in fretta

*75 minuti · esercizi: costruisci, accompagnato; rifai uguale*

- **Impari:** CSG: abbozzare un livello sommando e sottraendo forme, con le collisioni; GridMap: livelli a blocchi con una libreria di pezzi; Prima la forma grezza e giocabile, poi l'aspetto.
- **Costruisci:** L'isola abbozzata con le forme CSG (colline, un ponte, una grotta scavata) e un sotterraneo fatto con GridMap da una pianta data.
- **Come viene controllato:** La piattaforma controlla i nodi, le collisioni attive e le celle del GridMap rispetto alla pianta; fa cadere un corpo di prova in dieci punti e controlla che si fermi.

### 9.6 Collisioni in 3D

*60 minuti · esercizi: costruisci, dato il risultato; ripara*

- **Impari:** Corpi e forme in 3D: cosa cambia e cosa no rispetto al 2D; Ricavare una forma di collisione da un modello: semplice o fedele; Layer e maschere, con gli stessi nomi usati nel 2D.
- **Costruisci:** Collisioni per gli oggetti dell'isola, semplici dove basta e fedeli dove serve. Poi ricevi una scena in cui si cade attraverso il pavimento in tre punti.
- **Come viene controllato:** La piattaforma fa cadere e scorrere un corpo di prova in venti punti e controlla dove si ferma.

### 9.7 Un personaggio in terza persona

*90 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** CharacterBody3D: gravità, salto, move_and_slide() in tre dimensioni; Muoversi rispetto alla telecamera, non rispetto al mondo; Girare il personaggio verso dove sta andando.
- **Costruisci:** Il personaggio cammina, corre e salta; «avanti» è sempre il verso in cui guarda la telecamera; il corpo si gira con gradualità.
- **Come viene controllato:** La piattaforma tiene premuto «avanti» con la telecamera in quattro orientamenti e misura la direzione dello spostamento; misura salto e rotazione.

### 9.8 Telecamera in terza persona

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Un braccio che tiene la telecamera a distanza e la avvicina se c'è un muro; Girare con il mouse: catturare il puntatore, leggere il movimento; Limiti verso l'alto e verso il basso; la stessa cosa con il gamepad.
- **Costruisci:** La telecamera gira attorno al personaggio con mouse o leva destra, non entra nei muri e non si ribalta; Esc libera il puntatore.
- **Come viene controllato:** La piattaforma simula movimenti del mouse e legge gli angoli; mette un muro dietro al personaggio e controlla che la telecamera si avvicini.

### 9.9 Prima persona e interazione con lo sguardo

*75 minuti · esercizi: costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Lo stesso personaggio visto dai suoi occhi; Un raggio dal centro dello schermo: cosa sto guardando; Oggetti che rispondono allo stesso comando, ognuno a modo suo.
- **Costruisci:** Una variante in prima persona; guardando un oggetto compare «Premi E»; leve, porte e cartelli rispondono ciascuno a modo suo. In un progetto scritto da altri aggiungi un oggetto nuovo che risponde allo stesso comando.
- **Come viene controllato:** La piattaforma orienta lo sguardo verso oggetti vicini, lontani e coperti da un muro, e controlla scritta ed effetto dell'interazione.

### 9.10 Importare modelli 3D

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato; ripara*

- **Impari:** Dove trovare modelli gratuiti e in quale formato prenderli (glTF); Le impostazioni di importazione: scala, materiali, collisioni generate; Usare un modello importato senza modificare l'originale.
- **Costruisci:** Alberi, rocce e un ponte presi da un pacchetto gratuito, alla scala giusta e con collisioni. Poi ricevi tre modelli importati male (enorme, coricato, senza colori) e li sistemi.
- **Come viene controllato:** La piattaforma misura le dimensioni dei modelli nella scena, controlla orientamento, materiali e collisioni, e il registro degli asset.

### 9.11 Animazioni 3D importate

*90 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Le animazioni che arrivano con un modello, e come farle ripetere; AnimationTree: da fermo a camminata a corsa secondo la velocità; Animazioni che si sovrappongono al movimento: salto, caduta, atterraggio.
- **Costruisci:** Il personaggio dell'isola con un modello animato: fermo, camminata e corsa che sfumano l'una nell'altra, salto e caduta.
- **Come viene controllato:** La piattaforma fa muovere il personaggio a velocità diverse e legge il valore di mescolamento e l'animazione in corso; controlla salto e caduta.

### 9.12 Oggetti fisici e zone in 3D

*60 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** RigidBody3D: casse da spingere, oggetti che rotolano; Area3D: raccogliere, zone, piastre a pressione; Riusare in 3D i componenti scritti per il 2D: cosa passa uguale.
- **Costruisci:** Cristalli da raccogliere, casse da spingere su piastre che aprono un passaggio, una zona d'acqua in cui si va più piano.
- **Come viene controllato:** La piattaforma raccoglie i cristalli, spinge una cassa su una piastra e controlla il passaggio, attraversa la zona d'acqua e misura la velocità.

### 9.13 Progetto «Percorso a ostacoli» – tappa 1: personaggio e telecamera

*105 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Mettere in piedi da soli un progetto 3D con personaggio animato e telecamera.
- **Costruisci:** Personaggio in terza persona con modello e animazioni trovati da te, telecamera che gira e non entra nei muri.
- **Come viene controllato:** La piattaforma misura movimento rispetto alla telecamera, salto, animazioni, e controlla il registro degli asset.

### 9.14 Progetto «Percorso a ostacoli» – tappa 2: il percorso

*105 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Costruire un livello 3D giocabile e illuminarlo.
- **Costruisci:** Il percorso: piattaforme ferme e mobili, ostacoli che girano, vuoto, punti di ripartenza, oggetti da raccogliere, luce e ambiente.
- **Come viene controllato:** La piattaforma controlla gli elementi chiesti, fa cadere il personaggio nel vuoto e controlla la ripartenza, sale su una piattaforma mobile.

### 9.15 Progetto «Percorso a ostacoli» – tappa 3: gioco completo

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Chiudere un gioco 3D con ciò che hai già: interfaccia, menu, salvataggi.
- **Costruisci:** Tempo e oggetti raccolti sullo schermo, schermata d'arrivo con il miglior tempo salvato, menu, pausa, esportazione.
- **Come viene controllato:** La piattaforma porta il personaggio al traguardo lungo un tracciato noto, controlla tempo, record salvato ed esegue il gioco esportato.

<a id="fase-10--f10-3d-gioco"></a>

## Fase 10 — 3D: un gioco completo

*21,3 ore · 12 lezioni · 4 tappe di progetto*

Dalle basi a un gioco 3D finito. Porti nel 3D ciò che hai già costruito (dialoghi, menu, salvataggi, componenti), aggiungi personaggi che trovano la strada, un inventario, enigmi, effetti, e impari a misurare e alleggerire una scena 3D. È il terzo gioco completo.

**Il gioco che cresce:** «Il faro»: un'avventura d'esplorazione in 3D. Giri un'isola, parli con chi ci abita usando il tuo motore dei dialoghi, raccogli e usi oggetti, risolvi enigmi per riaccendere il faro, eviti le creature che di notte pattugliano.

**La prova, da un progetto vuoto:** «Il tuo gioco 3D», da un progetto vuoto, a scelta tra tre tracce: esplorazione con dialoghi, arena d'azione, enigmi in prima persona. Asset trovati da te, menu, salvataggi, impostazioni grafiche, esportazione.

**Alla fine di questa fase:**

- Riusi i tuoi sistemi in un gioco diverso da quello per cui li avevi scritti.
- Scrivi personaggi 3D che trovano la strada e reagiscono al giocatore.
- Costruisci un inventario e degli enigmi guidati dai dati.
- Misuri e alleggerisci una scena 3D.
- Porti a termine un gioco 3D completo.

### 10.0 Riusare i propri sistemi in un gioco 3D

*75 minuti · esercizi: costruisci, dato il risultato; riordina*

- **Impari:** Trovare ciò che lega un sistema al gioco per cui è nato, e tagliarlo; Tenere i sistemi riusabili in una cartella a parte, copiabile tra progetti; Collegare un sistema vecchio a un gioco nuovo solo con segnali e funzioni pubbliche.
- **Costruisci:** Il motore dei dialoghi, il gestore delle scene, salvataggi e impostazioni entrano nel «Faro»: parli con un abitante dell'isola e la conversazione usa i tuoi file della storia.
- **Come viene controllato:** La piattaforma controlla che i sistemi stiano nella cartella comune senza riferimenti alle scene della visual novel, avvia una conversazione in 3D e la segue fino alla fine, scelte comprese.

### 10.1 Personaggi che trovano la strada in 3D

*90 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** La superficie percorribile calcolata dalla scena; NavigationAgent3D: dare una meta e seguire il percorso; Più personaggi che non si ammassano.
- **Costruisci:** Gli abitanti camminano tra i loro posti durante il giorno; una creatura pattuglia e ti insegue aggirando rocce e case.
- **Come viene controllato:** La piattaforma dà una meta dietro un ostacolo e controlla l'arrivo entro un tempo dato; mette tre personaggi verso lo stesso punto e controlla le distanze tra loro.

### 10.2 Creature e scontri semplici in 3D

*75 minuti · esercizi: costruisci, dato il risultato; estendi il codice di un altro*

- **Impari:** Macchina a stati e componenti di vita e danno, portati in 3D; Vedere il giocatore: distanza, angolo di vista, ostacoli; Un colpo con la sua zona attiva e una spinta all'indietro.
- **Costruisci:** La creatura ha stati (ronda, sospetto, inseguimento, ritorno) e ti vede solo davanti a sé e non attraverso i muri; la lanterna la respinge.
- **Come viene controllato:** La piattaforma mette il giocatore davanti, dietro e oltre un muro e legge lo stato della creatura; usa la lanterna e misura la spinta.

### 10.3 Interfaccia in un gioco 3D

*60 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Testo e immagini dentro al mondo, sempre rivolti alla telecamera; Un indicatore sullo schermo che punta a qualcosa nel mondo, anche quando è fuori vista; Tenere leggibile l'interfaccia sopra una scena che cambia luce.
- **Costruisci:** Nomi sopra gli abitanti, un indicatore della meta che si ferma al bordo dello schermo quando la meta è fuori vista, la scritta di interazione.
- **Come viene controllato:** La piattaforma gira la telecamera e controlla dove sta l'indicatore con la meta in vista, di lato e alle spalle.

### 10.4 Suoni nello spazio

*45 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Un suono che ha un posto: più forte da vicino, da destra o da sinistra; Zone che cambiano il suono: dentro la grotta c'è l'eco; Passi diversi su terreni diversi.
- **Costruisci:** Il mare lungo la costa, il fuoco nel villaggio, l'eco nella grotta, passi che cambiano tra erba, legno e pietra.
- **Come viene controllato:** La piattaforma controlla sorgenti e loro distanze, porta il personaggio nella grotta e legge il bus in uso, lo fa camminare su tre terreni e legge quale suono parte.

### 10.5 Un inventario

*75 minuti · esercizi: costruisci, accompagnato; collauda; costruisci, dato il risultato*

- **Impari:** Gli oggetti come Resource; l'inventario come classe che non sa niente dell'interfaccia; Un'interfaccia a griglia che si aggiorna con i segnali; Usare un oggetto su qualcosa nel mondo, combinare due oggetti.
- **Costruisci:** Inventario con posti limitati e oggetti che si impilano, schermata a griglia, uso di un oggetto su una porta o su un altro oggetto. Scrivi tu i controlli della classe.
- **Come viene controllato:** La piattaforma usa la classe senza interfaccia con casi normali e limite; esegue i tuoi controlli contro una versione giusta e tre sbagliate; raccoglie e usa oggetti nel gioco.

### 10.6 Enigmi: condizioni ed effetti come dati

*60 minuti · esercizi: costruisci, dato il risultato; scrivi i dati*

- **Impari:** Un enigma è un insieme di condizioni e un effetto; Pezzi generici (un interruttore, un sensore, un contatore) collegati dall'Inspector; Far conoscere lo stato degli enigmi alla storia e ai salvataggi.
- **Costruisci:** Tre enigmi fatti con gli stessi pezzi: una sequenza di leve, specchi da orientare, pesi sulle piastre. Un quarto lo progetti tu combinando i pezzi.
- **Come viene controllato:** La piattaforma risolve ogni enigma nell'ordine giusto e in uno sbagliato; salva a metà e ricarica; controlla che il tuo enigma sia risolvibile e non già risolto all'inizio.

### 10.7 Particelle ed effetti in 3D

*60 minuti · esercizi: costruisci, accompagnato; rifai uguale*

- **Impari:** GPUParticles3D: forma di emissione, direzione, vita, colore nel tempo; Particelle che urtano il mondo o ne sono attratte; Scie dietro a un oggetto.
- **Costruisci:** Fuoco e fumo nel villaggio, spruzzi sulla costa, scintille quando raccogli un cristallo, la scia della luce del faro. Un effetto lo rifai guardandone uno di riferimento.
- **Come viene controllato:** La piattaforma legge le impostazioni degli effetti e controlla che quelli a evento partano nel punto giusto e vengano tolti.

### 10.8 Shader 3D: primi passi

*75 minuti · esercizi: costruisci, accompagnato; costruisci, dato il risultato*

- **Impari:** Spostare i punti di un modello: onde, erba che si muove; Decidere colore e luce propria di ogni punto; Lo stesso con i nodi grafici (VisualShader), quando conviene.
- **Costruisci:** L'acqua che ondeggia, l'erba mossa dal vento, i cristalli che pulsano; l'altezza delle onde si regola dal codice quando arriva la tempesta.
- **Come viene controllato:** La piattaforma controlla che gli shader si compilino, che i parametri esistano e che cambino quando parte la tempesta.

### 10.9 Luce di qualità e ciclo del giorno

*60 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Luce che rimbalza: le tecniche che Godot offre e quanto costano; Riflessi e nebbia con volume; Cambiare luce e cielo nel tempo dal codice.
- **Costruisci:** Un ciclo giorno-notte: sole che si muove, colori del cielo e della luce che cambiano, luci del villaggio che si accendono al buio, creature che escono di notte.
- **Come viene controllato:** La piattaforma porta l'ora a valori noti e legge direzione ed energia del sole, stato delle luci del villaggio e presenza delle creature.

### 10.10 Prestazioni in 3D

*60 minuti · lezione di metodo · esercizi: rendi veloce*

- **Impari:** Cosa pesa in una scena 3D: oggetti disegnati, ombre, luci, particelle; Disegnare migliaia di copie con un oggetto solo; non disegnare ciò che non si vede; Dare al giocatore la scelta: qualità delle ombre, risoluzione di calcolo.
- **Costruisci:** Ricevi l'isola con diecimila fili d'erba e trecento alberi come nodi separati, ombre ovunque, e la alleggerisci senza cambiarne l'aspetto in modo evidente; aggiungi le impostazioni grafiche.
- **Come viene controllato:** La piattaforma conta nodi e oggetti disegnati prima e dopo (devono scendere sotto una soglia), controlla che erba e alberi ci siano ancora e che le impostazioni grafiche cambino i valori giusti.

### 10.11 Il gioco completo

*60 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Cosa salvare in un gioco 3D con storia, inventario ed enigmi; Un inizio e una fine: introduzione, obiettivo, conclusione; Esportare un gioco 3D e controllare peso e tempi di caricamento.
- **Costruisci:** «Il faro» dall'inizio alla fine: introduzione, i tre enigmi, il faro riacceso, titoli di coda con i crediti; salvataggio completo; esportazione.
- **Come viene controllato:** La piattaforma porta la partita a metà lungo un percorso noto, salva, ricarica e confronta tutto lo stato; esegue il gioco esportato.

### 10.12 Progetto «Il tuo gioco 3D» – tappa 1: scegliere e abbozzare

*120 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Partire da un'idea e arrivare in fretta a qualcosa che si può provare.
- **Costruisci:** La traccia scelta in una pagina (obiettivo, cosa si fa, cosa serve), il livello abbozzato a blocchi, personaggio e telecamera funzionanti.
- **Come viene controllato:** La piattaforma controlla la pagina, che il progetto parta, che personaggio e telecamera rispondano e che il livello abbia collisioni.

### 10.13 Progetto «Il tuo gioco 3D» – tappa 2: i sistemi

*150 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Scegliere quali dei propri sistemi riusare e scrivere solo ciò che manca.
- **Costruisci:** I sistemi della tua traccia: dialoghi e inventario, oppure nemici e ondate, oppure enigmi e interazione. Con i tuoi sistemi riusati dalla cartella comune.
- **Come viene controllato:** Per ogni traccia la piattaforma ha i suoi controlli di comportamento; controlla quali sistemi sono stati riusati.

### 10.14 Progetto «Il tuo gioco 3D» – tappa 3: il mondo

*120 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Sostituire l'abbozzo con asset veri senza rompere il gioco.
- **Costruisci:** Modelli, materiali, luce, ambiente, suoni ed effetti, con asset trovati da te.
- **Come viene controllato:** La piattaforma rifà i controlli della tappa 2, controlla asset e registro, luci e ambiente, e misura il peso della scena.

### 10.15 Progetto «Il tuo gioco 3D» – tappa 4: finire

*90 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Rifinire, collaudare, consegnare.
- **Costruisci:** Menu, salvataggi, impostazioni grafiche e audio, un inizio e una fine, collaudo, esportazione.
- **Come viene controllato:** La piattaforma salva e ricarica in due punti, cambia le impostazioni ed esegue il gioco esportato.

<a id="fase-11--f11-il-tuo-gioco"></a>

## Fase 11 — Il tuo gioco

*24 ore · 5 lezioni · 4 tappe di progetto*

L'ultima fase è il traguardo del corso messo alla prova: un gioco tuo, di qualsiasi genere, portato dall'idea alla pubblicazione. Le poche lezioni riguardano il metodo: scegliere un'idea che si può finire, pianificare, imparare da soli ciò che manca. Il resto è lavoro tuo, controllato a tappe.

**Il gioco che cresce:** Il tuo.

**La prova, da un progetto vuoto:** Il gioco finito: giocabile dall'inizio alla fine, con menu, salvataggi, impostazioni, asset con i loro crediti, provato da almeno un'altra persona, esportato e pronto per la pubblicazione.

**Alla fine di questa fase:**

- Scegli un'idea e la riduci a qualcosa che puoi finire.
- Dividi un gioco in sistemi, compiti e tappe, e parti dal rischio più grosso.
- Impari da solo un argomento che il corso non ha trattato.
- Porti un gioco tuo fino alla pubblicazione.

### 11.0 Scegliere e ridurre: l'idea in una pagina

*60 minuti · lezione di metodo · esercizi: costruisci, dato il risultato*

- **Impari:** Il cuore del gioco: cosa fa il giocatore, ogni dieci secondi e ogni dieci minuti; Tagliare: la versione più piccola che è ancora quel gioco; Guardare un gioco simile e capire di quali sistemi è fatto.
- **Costruisci:** Una pagina: cosa si fa nel gioco, come si vince o si finisce, i sistemi necessari, cosa hai deciso di lasciare fuori, quanto dura.
- **Come viene controllato:** La piattaforma controlla che la pagina abbia tutte le voci e che ogni sistema elencato sia tra quelli costruiti nel corso, oppure sia dichiarato «da imparare».

### 11.1 Pianificare: sistemi, compiti, tappe

*60 minuti · lezione di metodo · esercizi: costruisci, dato il risultato*

- **Impari:** Da un sistema a compiti di un'ora o due; Mettere per prima la parte che potrebbe non funzionare; Una tappa è qualcosa che si può giocare, non un elenco di file.
- **Costruisci:** Il piano del tuo gioco in quattro tappe giocabili, con i compiti di ognuna; il progetto in Git con un segno per ogni tappa.
- **Come viene controllato:** La piattaforma controlla che il piano abbia le quattro tappe con compiti e che il progetto sia in Git.

### 11.2 Tappa 1: il prototipo del cuore del gioco

*240 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Scoprire in poche ore se l'idea regge.
- **Costruisci:** Il cuore del gioco giocabile con forme grezze: niente menu, niente grafica, solo ciò che il giocatore fa.
- **Come viene controllato:** La piattaforma controlla che il progetto parta senza errori, che esistano le azioni di input e che rispondano; il resto lo dichiari tu rispondendo a tre domande sul prototipo.

### 11.3 Imparare da soli un argomento nuovo

*75 minuti · lezione di metodo · esercizi: trova nella documentazione; costruisci, dato il risultato*

- **Impari:** Il metodo: pagina della documentazione, progetto dimostrativo ufficiale, scena di prova, poi il gioco; Leggere il codice di un progetto dimostrativo senza perdersi; Capire quando una risposta trovata in rete riguarda una versione vecchia di Godot.
- **Costruisci:** Scegli da un elenco un argomento mai trattato nel corso (per esempio disegnare forme dal codice, un percorso curvo da seguire, una minimappa con una seconda vista, il caricamento in sottofondo) e ne fai una scena dimostrativa che funziona.
- **Come viene controllato:** Per ogni argomento dell'elenco la piattaforma ha i suoi controlli di comportamento sulla scena dimostrativa.

### 11.4 Tappa 2: i sistemi

*360 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Costruire i sistemi del gioco riusando tutto ciò che puoi.
- **Costruisci:** Tutti i sistemi della tua pagina funzionano insieme, ancora con forme grezze; salvataggio compreso.
- **Come viene controllato:** La piattaforma controlla che il progetto parta, che salvi e ricarichi, e la storia in Git; per ogni sistema dichiari come si prova e la piattaforma esegue ciò che è eseguibile.

### 11.5 Lasciare al giocatore la scelta dei tasti

*45 minuti · esercizi: costruisci, dato il risultato; trova nella documentazione*

- **Impari:** Cambiare la Input Map mentre il gioco gira; Aspettare il prossimo tasto premuto e assegnarlo; Salvare la scelta e gestire due azioni sullo stesso tasto.
- **Costruisci:** Una schermata in cui ogni azione si riassegna a tastiera o gamepad; le scelte restano al prossimo avvio; un tasto già usato viene segnalato.
- **Come viene controllato:** La piattaforma riassegna un'azione, controlla che il tasto nuovo funzioni e il vecchio no, chiude e riapre.

### 11.6 Tappa 3: il contenuto

*300 minuti · progetto · esercizi: da un progetto vuoto*

- **Impari:** Riempire il gioco: livelli, storia, asset, suoni.
- **Costruisci:** Il gioco intero dall'inizio alla fine, con asset trovati e adattati da te e il registro completo.
- **Come viene controllato:** La piattaforma controlla asset, registro e crediti, e che il gioco si possa cominciare e portare a una schermata finale lungo il percorso che dichiari.

### 11.7 Tappa 4: rifinitura e collaudo

*240 minuti · progetto · esercizi: da un progetto vuoto; collauda*

- **Impari:** Far provare il gioco a qualcuno e correggere ciò che non capisce.
- **Costruisci:** Menu, impostazioni, effetti e suoni; l'elenco di collaudo eseguito; il gioco provato da almeno un'altra persona, con le segnalazioni scritte e le correzioni fatte.
- **Come viene controllato:** La piattaforma controlla menu, impostazioni salvate, elenco di collaudo, segnalazioni e storia delle correzioni in Git; misura le prestazioni.

### 11.8 Pubblicare e guardare avanti

*60 minuti · esercizi: costruisci, dato il risultato*

- **Impari:** Esportare, preparare la pagina, pubblicare; Guardare indietro: cosa è andato bene, cosa rifaresti in un altro modo; Cosa c'è oltre il corso e dove si impara: C#, multiplayer, telefoni, strumenti per l'editor, estensioni in C++.
- **Costruisci:** Il gioco esportato e il pacchetto per la pubblicazione; una pagina di bilancio; la tua scheda «Cosa so fare» completa, con la tua valutazione voce per voce.
- **Come viene controllato:** La piattaforma esegue il gioco esportato e controlla il pacchetto; la pubblicazione la confermi tu.

## Rami facoltativi

Si attivano uno alla volta, quando ti interessano, dopo la fase indicata. Le loro lezioni vengono dettagliate al momento dell'attivazione.

| Ramo | Ore | Dopo la fase | Contenuto |
|---|---|---|---|
| **Gioco di ruolo a turni** | 14 | 8 | Statistiche e formule, ordine dei turni, menu di battaglia, nemici e abilità descritti come dati, oggetti ed equipaggiamento, esperienza e livelli. Gioco: una serie di battaglie con un gruppo di tre personaggi. |
| **Roguelite d'arena** | 10 | 7 | Ondate bilanciate con i dati, potenziamenti che si combinano, riuso degli oggetti in memoria (object pooling) per centinaia di nemici, progressi che restano tra una partita e l'altra. Gioco: l'Arena della fase 7 portata a un gioco completo. |
| **Giochi di carte e da tavolo** | 12 | 6 | Trascinare con il mouse, mazzo mano e scarti come strutture dati, struttura a turni, effetti delle carte descritti come Resource, un avversario semplice. Gioco: un duello di carte contro il computer. |
| **Sparatutto in prima persona** | 12 | 10 | Armi a colpo istantaneo e a proiettile, rinculo e dispersione, munizioni e ricarica, nemici 3D che cercano riparo, costruzione di un livello. Gioco: un livello con tre armi. |
| **Avventura narrativa esplorabile** | 10 | 7 | Il motore dei dialoghi dentro un mondo in cui ci si muove: personaggi con cui parlare, missioni, scene d'intermezzo con AnimationPlayer. Gioco: un piccolo villaggio con tre missioni. |
| **Generazione procedurale** | 8 | 7 | Numeri casuali con seme, rumore (FastNoiseLite), stanze e corridoi generati, mappe a tessere generate dal codice. Gioco: un sotterraneo diverso a ogni partita. |
| **Multiplayer in rete locale** | 10 | 8 | L'API multiplayer di alto livello: collegare due istanze, chiamate remote, chi comanda cosa, MultiplayerSpawner e MultiplayerSynchronizer, una sala d'attesa. Gioco: un Pong e poi un'arena per due. |
| **Strumenti per l'editor** | 8 | 6 | Script @tool, EditorScript, un plugin con il suo pannello, proprietà personalizzate nell'Inspector. Strumento: un pannello che controlla e mostra la storia della tua visual novel. |
| **C# in Godot** | 9 | 8 | Godot .NET, differenze con GDScript, nodi segnali ed export in C#, far convivere le due lingue. Progetto: riscrivere in C# uno dei tuoi giochi piccoli. |
