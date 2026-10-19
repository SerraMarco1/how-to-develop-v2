# Guida

Come si usa la piattaforma, per chi studia e per chi la tiene in piedi (la stessa persona: il proprietario del
repository).

## Studiare

### La prima volta

1. Installa l'aula dalla pagina [Releases](https://github.com/SerraMarco1/how-to-develop-v2/releases) (vedi il
   [README](../README.md#installare-laula) per l'avviso di SmartScreen).
2. Apri **Impostazioni**:
   - **Dati della versione 1**: se sul PC c'è la versione 1, importa progressi, tentativi, chat con il tutor e scheda.
     Si fa una volta sola.
   - **Cartella dei progetti**: la cartella dove tieni i progetti Godot degli esercizi.
   - **Chiavi del tutor**: almeno una tra Groq, Mistral e Gemini (tutte gratuite; il link porta alla pagina dove
     crearla). Le chiavi restano sul PC, cifrate da Windows con il tuo account.

### Ogni giorno

- **Oggi** dice cosa studiare adesso, quante lezioni pronte hai davanti e cosa sta facendo la fabbrica.
- **Corso** è l'elenco di tutte le lezioni, nell'ordine del piano. Si apre una lezione alla volta: la successiva si
  sblocca quando completi quella prima.
- In una **lezione**: la teoria, poi gli esercizi e il test finale. Per ogni esercizio:
  - negli esercizi guidati e in quelli «Rifai uguale» c'è il video **Il risultato atteso**: cosa deve succedere quando
    avvii il gioco (con F5, o con F6 sulla scena che dice la didascalia) dopo aver fatto l'esercizio. Il riquadro
    giallo indica ciò di cui parla la scritta; confrontalo con il tuo gioco;
  - prepara il progetto di partenza (se serve) e lavora in Godot;
  - premi **Verifica**: l'aula esegue il tuo progetto in un Godot di servizio e controlla il risultato (se fallisce,
    lo riprova una volta da sola: alcune verifiche davano esiti diversi da una volta all'altra);
  - se sei bloccato: **Un suggerimento**, poi **Chiedi al tutor**, e solo alla fine **Soluzione**. Il tutor ha una
    conversazione per ogni esercizio: in cima al pannello c'è scritto di quale state parlando, e sotto la chat lo cambi.
    Vede la consegna, l'ultima verifica, il codice delle verifiche e i tuoi file.
- **Ripasso** ti ripropone le lezioni già fatte a intervalli crescenti, con domande di previsione (leggi il codice,
  scrivi il risultato).
- **Cosa so fare** elenca le cose che il corso promette di insegnare, con quello che l'aula ha misurato e la tua
  valutazione. Si scarica in Markdown o JSON: è il documento da dare a un assistente AI insieme all'idea di un gioco.

### Un errore in una lezione

Passando con il mouse su una parte della lezione compare **Segnala un errore**: si apre la pagina di GitHub con lezione e punto già
scritti. Spiega cosa non va e premi **Invia** (devi aver fatto l'accesso a GitHub con il tuo account). Al giro dopo la
fabbrica controlla; se l'errore c'è, la lezione esce corretta e la risposta arriva nella segnalazione (e per email).

## Tenere in piedi la fabbrica

La fabbrica non chiede niente finché funziona. Lavora da sola, un giro dopo l'altro (alla fine di ogni giro avvia il
successivo); lo stato si vede nell'aula (pagina Oggi)
e, nel dettaglio, nella scheda **Actions** del repository.

- **Fermarla**: nella scheda Actions apri il giro in corso della «Fabbrica» e premi **Cancel workflow**. Non si rilancia.
- **Farla ripartire** (dopo averla fermata, o se per un guasto di GitHub si fosse interrotta): **Actions → Fabbrica →
  Run workflow**. Da lì continua da sola.

### Le chiavi

Nel repository: **Settings → Secrets and variables → Actions → New repository secret**.

| Segreto | Serve | Dove si crea |
|---|---|---|
| `GEMINI_API_KEY` | Indispensabile: scrive, rivede, corregge | [Google AI Studio](https://aistudio.google.com/apikey) |
| `OPENROUTER_API_KEY` | Facoltativo: un altro scrittore, dopo la prova | [OpenRouter](https://openrouter.ai/settings/keys) |
| `NVIDIA_API_KEY` | Facoltativo: un altro scrittore, dopo la prova | [NVIDIA build](https://build.nvidia.com/) |
| `GROQ_API_KEY` | Facoltativo: domande di ripasso e piccole correzioni | [Groq](https://console.groq.com/keys) |

Il progetto Google della chiave Gemini **non deve avere la fatturazione attiva**: senza fatturazione Google non può
addebitare niente, e quando le richieste del giorno finiscono la fabbrica aspetta il giorno dopo (le 09:00 italiane).

### Un modello nuovo

Dopo aver aggiunto la chiave di OpenRouter o di NVIDIA: **Actions → Prova di uno scrittore → Run workflow**, scegli il
modello. Il modello riscrive due lezioni già pubblicate in una copia del corso; se le scrive fino in fondo senza
ripieghi, da quel momento scrive lezioni insieme a Gemini. Il rapporto resta nel ramo `corso`, in `prove/scrittori/`.
La prova usa richieste vere (poche di Gemini, per la revisione).

### Quando il corso si ferma

Se una lezione non si riesce a scrivere, la fabbrica apre una segnalazione con il motivo (ti arriva per email) e non
scrive le lezioni successive, perché ognuna parte dal gioco com'era alla fine della precedente. Nella segnalazione c'è
il percorso del racconto completo, passo per passo. Quando la causa è sistemata: **Actions → Fabbrica → Run workflow**
con **riprova** attivo.

### Un aggiornamento dell'aula

Si cambia la versione in `aula/package.json`, si salva su `main` e si crea l'etichetta corrispondente
(`git tag aula-v2.0.1 && git push origin aula-v2.0.1`). GitHub costruisce l'installatore e lo pubblica tra le Release.
L'aula installata se ne accorge e lo dice; premendo **Aggiorna** lo scarica (controllandone l'impronta) e lo installa
al riavvio.
