# Come è fatta la piattaforma (versione 2)

> Scritta il 15 ottobre 2026, quando la piattaforma è stata ricostruita. La versione 1 era un sito di sviluppo avviato da
> un file `.bat`: il generatore girava solo a PC acceso, le pagine mescolavano lo studio con il funzionamento della
> macchina, e ogni guasto andava ripreso a mano. Questa versione separa le due cose.

## Le due parti

| | La **fabbrica** | L'**aula** |
|---|---|---|
| Cosa fa | Scrive le lezioni con i modelli AI gratuiti e le verifica in Godot | Ti fa studiare: lezioni, esercizi, tutor, ripasso, «Cosa so fare» |
| Dove gira | Su GitHub Actions, un giro dopo l'altro, anche a PC spento | Sul tuo PC, come programma Windows |
| Cosa legge | Il piano del corso, la documentazione ufficiale di Godot, il proprio lavoro salvato | Le lezioni pubblicate dalla fabbrica |
| Cosa scrive | Il ramo `corso` del repository: lezioni pronte, cantieri, tracce | Un database sul tuo PC con i tuoi progressi |
| Chiavi AI | Nei segreti del repository | Cifrate sul tuo PC (Windows le protegge con il tuo account) |

Le due parti non si parlano direttamente: la fabbrica pubblica, l'aula scarica.

## Il repository

- Ramo `main`: il codice. Ci scrive solo il proprietario (regola «Proteggi main»: niente cancellazione, niente riscrittura
  della storia, nessuna modifica se non dal proprietario: nemmeno la fabbrica può cambiare il proprio codice).
- Ramo `corso`: i dati della fabbrica. Ci scrive solo la fabbrica.

```
main
  motori/godot/      il pacchetto del motore: piano del corso, istruzioni per i modelli, base di verifica, immagini
  condiviso/         il codice usato da fabbrica e aula: formato delle lezioni, Godot, controlli di sicurezza
  fabbrica/          il generatore
  aula/              il programma Windows
  strumenti/         piano.ts: controlla il piano del corso e scrive docs/piano-del-corso.md
  docs/              questo documento, il piano del corso leggibile, la guida per chi studia
  .github/workflows/ fabbrica (si rilancia da sola), controlli (a ogni modifica), rilascio dell'aula, prova di uno scrittore

corso
  catalogo.json      le lezioni pubblicate, ciascuna con l'impronta SHA-256 del suo file
  lezioni/           una lezione per file (teoria, esercizi, test, progetto di riferimento)
  media/             immagini, asset e indice della documentazione, con il nome uguale alla loro impronta
  cantieri/          il lavoro a metà di ogni lezione
  risposte/          le risposte dei modelli già pagate e non ancora usate
  tracce/            ogni passaggio della scrittura, riuscito o no, con i dati completi
  stato/             fermi dei fornitori, richieste contate, scrittori approvati, corso fermo e perché
  importate/         le lezioni arrivate dalla versione 1, in attesa di essere ricontrollate in Godot
  prove/scrittori/   il rapporto di ogni prova di scrittura di un modello nuovo
```

## Come lavora la fabbrica

Un giro alla volta. Alla fine di ogni giro la fabbrica **si rilancia da sola** (job «rilancio» di
`.github/workflows/fabbrica.yml`): aspetta quanto serve (fino a quando un fornitore torna disponibile, al massimo
15 minuti; 45 se il corso è fermo o finito, per leggere comunque le segnalazioni) e avvia il giro successivo.
Il motivo: l'orario di GitHub (`schedule`) dalla pubblicazione del repository non ha mai avviato un giro, e GitHub
stesso dice che può ritardarlo o saltarlo; resta nel file solo come riserva. Il rilancio non avvia un giro se ce n'è già
uno in coda (un «Run workflow» fatto a mano, una prova di scrittore): continua quello. Annullare un giro (Cancel run)
ferma la fabbrica; Run workflow la fa ripartire.

A ogni giro:

1. Scarica `main` e `corso`, prepara Godot 4.7.2 (impronta SHA-512 controllata) e l'indice della documentazione.
2. Prende la prima lezione del piano non ancora pubblicata. Il corso va in ordine: una lezione parte solo dal gioco
   com'era alla fine della precedente.
3. Fa **un passo alla volta**: una richiesta a un modello, oppure un controllo in Godot, oppure la pubblicazione.
4. **Dopo ogni passo salva e spinge** il ramo `corso`. Se la macchina si spegne a metà, si perde al massimo il passo in corso.
5. Ogni risposta di un modello viene salvata **prima** di essere usata (`risposte/`). Se il giro si interrompe dopo che
   la risposta è arrivata, al giro dopo la stessa richiesta non viene rifatta: si usa la risposta già pagata.
6. Se nessun modello può rispondere (sovraccarico, richieste finite) il giro scrive perché e quando si riprova, ed esce.
   Il giro successivo riparte da lì.
7. Se un pezzo non supera i controlli dopo le correzioni previste, la lezione si ferma: il corso aspetta un intervento,
   la fabbrica apre una segnalazione nel repository (che ti arriva per email) e l'aula lo mostra.

Il lavoro di una lezione è quello della versione 1, che funzionava: teoria, pratica in una richiesta, ogni esercizio
controllato in Godot (deve fallire prima del lavoro e passare dopo), correzioni mirate, revisione, pubblicazione.

Dal 17-19 ottobre ogni esercizio passa anche da quattro controlli nati da lavori giusti che risultavano sbagliati:

| Controllo | Cosa fa | Il caso vero |
|---|---|---|
| **Variante lecita** | Le verifiche girano su una copia della soluzione con dimezzati i valori iniziali (variabili e costanti numeriche) che il testo dell'esercizio non dice: devono passare anche lì | 1.4: la verifica teneva premuto «giù» per tre secondi; a 150 pixel al secondo, la velocità scelta da chi studiava, il sottomarino non arrivava al fondale |
| **Stabilità** | Le verifiche girano due volte sulla soluzione: devono passare entrambe | 1.11: la stessa soluzione passava o no a caso (il gioco mette le stelle in punti casuali) |
| **Variante letterale** | Gli script che la soluzione cambia ma che il testo non nomina tornano com'erano prima del lavoro: le verifiche devono passare anche così | 1.9: la soluzione cambiava anche `rock.gd` senza dirlo; il `rock.gd` di chi studiava rimetteva la roccia in un punto a caso e nessun lavoro fatto come diceva la consegna passava, nemmeno incollando lo script della soluzione |
| **Cose non spiegate** | Le funzioni che le righe nuove della soluzione chiamano devono comparire nella teoria di questa lezione, nelle lezioni prima, nella consegna o nel progetto di partenza (passi e suggerimenti non contano: una riga da ricopiare non è una spiegazione) | 1.9: la teoria creava le stelle con `Sprite2D.new()`, un passo faceva scrivere `instantiate()` senza spiegarlo |

Un problema trovato torna al modello con i dati precisi (i valori cambiati, le righe nascoste, i controlli falliti).
La variante letterale è un problema vero: la consegna deve dire tutto ciò che serve. Gli altri sono «minori»: se dopo
le correzioni previste resta solo uno di quelli, l'esercizio esce lo stesso, con un avviso nella lezione, perché è
giusto e toglierlo farebbe più danno.

Le istruzioni per i modelli chiedono anche verifiche scritte per reggere: mettere il nodo in un punto noto prima di
misurare un movimento, portarlo oltre un limite invece di aspettare che ci arrivi, scrivere nel messaggio il valore
misurato («deve fermarsi a y = 560 (è a y = 530.0)»).

Prima di scrivere lezioni nuove, a ogni giro la fabbrica: ricontrolla in Godot le lezioni arrivate dalla versione 1
(`importate/`; quelle che non passano vengono riscritte), gestisce le segnalazioni aperte, poi completa il ripasso delle
lezioni pubblicate senza (in quel momento il modello del ripasso era sovraccarico, o mancava la sua chiave). Una lezione
così esce in una versione nuova in cui cambia solo il ripasso; l'aula la scarica da sola e i tuoi progressi restano,
perché sono legati alla lezione e non alla versione. Se il modello del ripasso è fermo non si chiede niente; dopo tre
risposte inutilizzabili per la stessa lezione si smette, per non spendere richieste all'infinito.

Poi ricontrolla gli **esercizi delle lezioni pubblicate** con quei quattro controlli (`robustezza.ts`; le lezioni uscite
prima non ci erano passate: il 17-19 ottobre 12 verifiche su 55 bocciavano la variante lecita, 1 la propria soluzione a
caso, 3 esercizi avevano modifiche nascoste che facevano fallire le verifiche e 8 usavano funzioni mai spiegate). Un
esercizio con problemi torna a un modello che corregge **verifiche e testi** (consegna, passi, suggerimenti): la
soluzione resta identica, perché le lezioni successive partono da lì; se il problema è solo nelle verifiche, cambia
solo quello. La correzione deve ripassare tutti i controlli in Godot; allora la lezione esce in una versione nuova e
l'avviso sull'esercizio sparisce. Ogni esercizio ha al massimo tre tentativi (i primi due con il modello del ritocco, il
terzo con uno scrittore); se il modello che serve è fermo si riprova al giro dopo. Il registro è in `stato/verifiche.json`.

Infine fa i video «Il risultato atteso» che mancano agli esercizi delle lezioni pubblicate (vedi sotto).

### I video «Il risultato atteso»

Fino al 19 ottobre la teoria aveva dei video che riprendevano la scena principale così com'era (nella fase 1 il cesto,
mezzo fuori dallo schermo) e non mostravano ciò di cui parlava la lezione: «Cinque stelle create all'avvio» (1.9) non
mostrava stelle, perché le stelle, figlie del cesto che sta a y = 600, finivano a y = 700–1070 sotto uno schermo alto 648;
nella 1.2 la stella che cade si vede solo avviando `star.tscn` con F6, e il video riprendeva il cesto. Nessuno guardava
cosa mostravano. Sono stati tolti, e quelli già pubblicati non si mostrano.

Dalla sera del 19 ottobre ogni esercizio **guidato** e **«Rifai uguale»** (imita) ha un video che mostra cosa deve
succedere quando chi studia avvia il gioco dopo aver fatto l'esercizio. Sta nell'esercizio, sotto la consegna, con
scritto come avviarlo («Avvia il gioco con F5», «Apri star.tscn e premi F6»).

- **Il copione** lo scrive il modello del ritocco (Flash-Lite, 500 richieste al giorno; nessuna richiesta Flash):
  la scena da avviare, i tasti simulati, i **soggetti** (quali nodi, quanti, in che intervallo, cosa devono fare:
  esserci, muoversi, comparire, sparire, cambiare colore o dimensione, mostrare un testo) e le scritte, una alla volta e
  ognuna legata a un soggetto (`motori/godot/prompts/video-copione.md`). Può rispondere che il video non si fa (il
  risultato si legge solo nel pannello Output, o il gioco resta uguale a prima).
- **La registrazione**: Godot avvia la soluzione con la base `motori/godot/harness/htd_video.gd`, nella finestra del
  gioco così com'è (niente camera spostata: il video è un riferimento da confrontare), con sopra la scritta, un riquadro
  giallo con un'etichetta intorno ai soggetti e il tasto premuto. Casualità fissata, 30 fotogrammi al secondo.
- **I controlli**, prima di pubblicare (`condiviso/src/godot/video.ts`), tutti senza modelli:
  1. il copione è possibile: la scena c'è (anche una che non è la principale: si avvia con F6, e l'aula lo scrive), le
     azioni sono della Input Map, i file dei soggetti esistono, le scritte stanno negli intervalli dei loro soggetti e
     non si sovrappongono (con due insieme se ne vede una sola);
  2. durante la registrazione stessa Godot misura a ogni fotogramma ogni soggetto: un nodo «si vede» se almeno l'80% del
     suo rettangolo è dentro lo schermo, non è nascosto né trasparente; deve vedersi (e muoversi, cambiare…) per almeno
     l'80% del suo intervallo;
  3. nei fotogrammi veri del video, dove Godot dice che c'è un soggetto, i pixel devono essere diversi dallo sfondo che ha
     intorno (prende un nodo coperto da un altro, una texture che non si carica, un video tutto di un colore);
  4. lo stesso copione gira sul progetto com'era **prima** dell'esercizio (senza finestra, in meno di un secondo): se
     passa anche lì, il video non mostra il risultato dell'esercizio e si scarta. È la regola delle verifiche (falliscono
     prima, passano dopo): i vecchi video sarebbero stati scartati tutti qui.
- Se un controllo fallisce, le misure precise tornano al modello («trovati fino a 5, visibili al massimo 0; «Star» a
  (662, 700), fuori dallo schermo; lo schermo va da (0, 0) a (1152, 648)»), fino a tre tentativi. Poi l'esercizio resta
  senza video; se i nodi c'erano ma fuori dallo schermo, la traccia lo dice con un passaggio a parte («il risultato
  dell'esercizio non si vede nello schermo»): è un difetto dell'esercizio, non del video.
- **Quando**: a ogni giro, prima delle lezioni nuove, per le lezioni pubblicate senza il video (anche quella appena
  uscita: la pubblicazione non aspetta mai un video). Una lezione con video nuovi esce in una versione nuova in cui
  cambiano solo i video. Il registro è in `stato/video.json`. Un video vale finché non cambiano la soluzione del suo
  esercizio o il progetto di partenza (l'impronta è salvata con il copione); se cambiano, si rifà.
- **Costo**: da 1 a 3 richieste Flash-Lite per esercizio con video (circa 1,2 per lezione), una volta sola.
- **Il primo giro vero** (19 ottobre, 34 esercizi in 20 minuti): 10 video, 23 «niente video», 1 risultato invisibile.
  Guardati i fotogrammi: 8 video buoni; uno con tre scritte nello stesso intervallo (se ne vedeva una), uno con il
  riquadro solo sul titolo. Molti «niente» erano giusti (esercizi che riordinano il codice: il gioco resta uguale; le
  stelle figlie del cesto, sotto lo schermo, in 1.9, 1.10, 1.11 e 2.2), altri colpa delle regole: una scena diversa
  dalla principale doveva essere nominata nella consegna (così restavano senza video la stella della 1.7 e i menu della
  fase 3), un effetto di mezzo secondo non si poteva mostrare, il rimbalzo di un Tween non si poteva misurare. Con le
  regole 2 (`REGOLE` in `lezione/video.ts`) quei casi si riprovano una volta, e i video che non le rispettano si rifanno.

### Chi scrive

| Ruolo | Modelli | Perché |
|---|---|---|
| Scrittore (teoria, pratica, correzioni dalla seconda in poi) | Gemini Flash (tre «secchi» da 20 richieste al giorno) e i modelli che hanno superato la prova di scrittura | Il risultato lo giudicano Godot e il revisore, ma uno scrittore debole consuma richieste in correzioni |
| Revisore | Gli stessi, mai un modello non approvato; se possibile diverso da chi ha scritto | Giudica i fatti della teoria: un problema conta solo se dimostrato con una frase vera della documentazione |
| Ritocco (prima correzione di un pezzo bocciato, copioni dei video) | Gemini Flash-Lite (500 richieste al giorno), poi gli altri | Il risultato lo giudica Godot: qui basta un modello veloce |
| Ripasso (domande di previsione) | Flash-Lite, Groq | Le risposte giuste non le scrive il modello: le calcola Godot eseguendo il codice |

Le richieste si contano come le conta Google: il giorno di Gemini va da mezzanotte a mezzanotte in California, e i
rifiuti per sovraccarico contano anche loro. Un fornitore che rifiuta due volte riposa (almeno 10 minuti) e nel riposo
nessuno lo interpella; per ogni lezione c'è un tetto di risposte al giorno, perché una lezione difficile non consumi
tutto il giorno.

### La prova di uno scrittore

Un modello nuovo (OpenRouter, NVIDIA) scrive lezioni solo dopo una prova, lanciata a mano: Actions → «Prova di uno
scrittore» → Run workflow, scegliendo il modello (la sua chiave dev'essere tra i segreti).

- In una **copia** del ramo `corso` il modello riscrive da solo le ultime due lezioni pubblicate, con tutti i controlli
  di sempre. Il corso vero non viene toccato; nella prova il modello non fa mai da revisore del proprio lavoro.
- La supera solo se scrive **entrambe** le lezioni fino in fondo **senza ripieghi**: nessun esercizio tolto, nessuna
  lezione fermata. Allora entra tra gli scrittori approvati (`stato/fabbrica.json`) e da quel momento scrive alla pari
  con Gemini.
- Il rapporto (esito, correzioni, richieste, il racconto di ogni passo) resta in `prove/scrittori/`.
- La prova spende richieste vere: quelle del modello in prova e poche di Gemini per la revisione, contate come sempre.

### Le segnalazioni

Nell'aula, il pulsante «Segnala un problema» apre nel browser la pagina di GitHub con il modulo già compilato
(lezione e punto); scrivi cosa non va e premi Invia. L'aula non ha nessuna chiave per scrivere nel repository.
Al giro dopo la fabbrica legge **solo le segnalazioni aperte dal proprietario**: un revisore controlla il punto; se
l'errore c'è, il pezzo viene corretto e ricontrollato in Godot come durante la scrittura e la lezione esce in una
versione nuova. La risposta arriva nella segnalazione stessa (e quindi per email).

### Quando il corso si ferma

Se una lezione non si riesce a scrivere (un pezzo non supera i controlli dopo correzioni e riscrittura, o nessun modello
rispetta il formato), la fabbrica apre una segnalazione con il motivo e il percorso del racconto completo
(`tracce/<lezione>/registro.jsonl`) e non scrive le lezioni successive: ognuna parte dal gioco com'era alla fine della
precedente. L'aula mostra che il corso è fermo. Per ripartire: Actions → Fabbrica → Run workflow con «riprova».

## Come lavora l'aula

- Scarica il catalogo dal ramo `corso` a una revisione precisa, poi le lezioni nuove. Ogni file deve avere l'impronta
  scritta nel catalogo, altrimenti viene scartato.
- Prima di eseguire qualunque codice di una lezione in Godot (soluzioni, verifiche, progetti di partenza) lo controlla
  con le stesse regole di sicurezza della fabbrica: niente comandi di sistema, niente rete, niente file fuori dal progetto.
- Le verifiche girano su una copia del tuo progetto, con un Godot di servizio scaricato dal sito ufficiale e controllato.
  Quando qualcosa non passa, la base di verifica cerca la causa più comune: lo script con il nome della scena
  (`rock.gd` per `rock.tscn`) scritto ma non attaccato a nessun suo nodo. Se la trova, l'aula la mostra come «Causa
  probabile» sopra i controlli.
- Dopo una verifica non superata l'analisi del codice (il «correttore») riceve il conto dei controlli falliti e la
  causa trovata. Se risponde che il lavoro supera le verifiche quando non è così, deve riscrivere; se insiste, la sua
  risposta non viene mostrata.
- Una verifica che controlla il gioco in esecuzione e fallisce si **ripete una volta** (aula 2.0.3): se la seconda passa,
  il lavoro è superato e l'aula dice che quella verifica dà esiti diversi da una volta all'altra; se fallisce in un
  altro modo, lo dice, perché quei controlli non sono una guida sicura.
- Correttore e tutor ricevono (dall'aula 2.0.3) il **codice delle verifiche** e le **differenze fra i tuoi script e
  quelli della soluzione**, che non mostrano: servono a trovare la causa vera di un controllo fallito (un `+` che manca,
  una variabile al posto di un'altra, un altro file che la soluzione cambia) e a spiegarla con file e riga. Con
  controlli falliti ragionano di più e il tutor ha un promemoria accanto alla domanda: il 18 ottobre, senza, rispose con
  un elenco di cause generiche; con, trovò la roccia che si rimetteva in un punto a caso. La richiesta è tenuta corta
  perché ci stia gpt-oss-120b su Groq (8.000 token al minuto), l'unico dei modelli dell'aula che quel giorno trovò la
  causa: solo i file che l'esercizio cambia, niente stile né documentazione (`token.ts` chiede meno token di risposta
  quando la domanda è lunga).
- Il tutor ha una **conversazione per esercizio** (e una per la lezione in generale), e in cima al pannello dice di
  quale si sta parlando: il 17 ottobre, con un'unica chat per lezione, rispose sul sottomarino a una domanda sul rover.
  Vede la cartella dell'ultima verifica, non solo quella proposta.
- La finestra non apre pagine esterne e non carica niente da internet: i link si aprono nel browser, solo verso siti noti.
- Negli esercizi guidati e «Rifai uguale» mostra il video «Il risultato atteso» (dall'aula 2.0.4), con scritto come
  avviare la scena. I vecchi video della teoria non si mostrano.
- I tuoi dati (progressi, tentativi, chat con il tutor) restano sul PC, con una copia di sicurezza al giorno (le ultime 14).
- Si installa per il solo utente, senza permessi di amministratore, e si aggiorna da sola dalle release del repository.

## Sicurezza: le regole

| Rischio | Difesa |
|---|---|
| Chiavi AI che finiscono in pubblico | Solo nei segreti di GitHub; il codice toglie ogni chiave da tracce e messaggi; GitHub blocca i push che contengono chiavi |
| Qualcuno modifica il codice | Solo il proprietario scrive su `main`; le prove proposte da altri partono solo con approvazione; azioni esterne solo di GitHub e fissate per impronta |
| Qualcuno detta istruzioni alla fabbrica | La fabbrica legge solo il piano, la documentazione ufficiale a una revisione fissata e le segnalazioni scritte dal proprietario |
| Codice delle lezioni che danneggia il PC | Controllo di sicurezza sul codice in fabbrica e di nuovo in aula; percorsi solo dentro il progetto; impronte di ogni file |
| Codice delle lezioni che legge le chiavi della fabbrica | Nel cloud Godot gira come un utente a parte (`htdgodot`), con un ambiente vuoto: non vede i file né le variabili della fabbrica. Dopo ogni esecuzione si chiude ogni suo processo; la cartella in cui Godot lavora viene preparata tutta prima e poi la fabbrica non ci scrive più (il video esce in una cartella a parte) |
| Lezione alterata durante il download | Impronta SHA-256 di ogni file nel catalogo, letto a una revisione precisa del ramo |
| Godot alterato | Impronta SHA-512 ufficiale scritta nel codice |
| Pagina dell'aula che esegue codice | Finestra isolata (sandbox, niente Node), politica dei contenuti rigida, markdown senza HTML |
| Programma dell'aula alterato sul disco | Codice solo da `app.asar`, controllato con la sua impronta all'avvio; l'eseguibile non accetta ELECTRON_RUN_AS_NODE, NODE_OPTIONS né --inspect |

Il controllo di sicurezza sul codice GDScript è una **rete di protezione, non una gabbia**: blocca le strade note per
uscire dal progetto (comandi di sistema, rete, file fuori dal progetto, codice caricato a runtime), ma Godot non ha un
modo per eseguire codice in isolamento completo. Per questo nel cloud Godot gira anche come utente separato, e le
lezioni vengono scritte solo dalla fabbrica, che legge solo fonti fissate.
