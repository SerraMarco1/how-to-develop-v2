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

Prima di scrivere lezioni nuove, a ogni giro la fabbrica: ricontrolla in Godot le lezioni arrivate dalla versione 1
(`importate/`; quelle che non passano vengono riscritte), poi gestisce le segnalazioni aperte.

### Chi scrive

| Ruolo | Modelli | Perché |
|---|---|---|
| Scrittore (teoria, pratica, correzioni dalla seconda in poi) | Gemini Flash (tre «secchi» da 20 richieste al giorno) e i modelli che hanno superato la prova di scrittura | Il risultato lo giudicano Godot e il revisore, ma uno scrittore debole consuma richieste in correzioni |
| Revisore | Gli stessi, mai un modello non approvato; se possibile diverso da chi ha scritto | Giudica i fatti della teoria: un problema conta solo se dimostrato con una frase vera della documentazione |
| Ritocco (prima correzione di un pezzo bocciato) | Gemini Flash-Lite (500 richieste al giorno), poi gli altri | Il risultato lo giudica Godot: qui basta un modello veloce |
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
- La finestra non apre pagine esterne e non carica niente da internet: i link si aprono nel browser, solo verso siti noti.
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
