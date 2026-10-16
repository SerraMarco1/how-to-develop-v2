# Sicurezza

## Segnalare un problema di sicurezza

Se trovi un problema di sicurezza (per esempio un modo per far eseguire codice a una lezione fuori dal suo progetto, o
per far arrivare istruzioni alla fabbrica), **non aprire una issue pubblica**: usa «Report a vulnerability» nella scheda
Security di questo repository. È un canale privato verso il proprietario.

## Come è protetto il progetto

La descrizione completa è in [docs/architettura.md](docs/architettura.md#sicurezza-le-regole). In breve:

- **Nessuna chiave nel repository.** Le chiavi dei modelli AI stanno nei segreti di GitHub (fabbrica) o cifrate sul PC
  con la protezione di Windows (aula). Il codice toglie le chiavi da ogni traccia salvata; GitHub blocca i push che ne
  contengono una.
- **Il codice lo cambia solo il proprietario.** Il ramo `main` accetta modifiche solo dal proprietario; le azioni usate
  nei workflow sono fissate per impronta; le prove proposte da chi non collabora partono solo con approvazione; il token
  dei workflow ha di base solo permessi di lettura.
- **La fabbrica non prende ordini dall'esterno.** Legge il piano del corso, la documentazione ufficiale di Godot a una
  revisione fissata, e le segnalazioni scritte dal proprietario. Le issue di altri vengono ignorate.
- **Il codice delle lezioni è controllato due volte**, in fabbrica e di nuovo nell'aula prima di eseguirlo: niente
  comandi di sistema, niente rete, niente file fuori dal progetto, niente codice caricato a runtime. Nel cloud, Godot
  gira come un utente separato senza accesso ai file e all'ambiente della fabbrica.
- **Ogni file scaricato dall'aula ha la sua impronta** SHA-256 nel catalogo, letto a una revisione precisa del ramo
  `corso`. Godot si scarica dal sito ufficiale e si controlla con l'impronta SHA-512 pubblicata.
- **La finestra dell'aula è isolata**: sandbox, niente Node.js, politica dei contenuti che non carica niente da
  internet, testo delle lezioni senza HTML. L'eseguibile accetta solo il proprio codice, controllato all'avvio.

## Limiti dichiarati

- Il controllo del codice GDScript è una rete di protezione, non una gabbia: Godot non offre un modo per eseguire codice
  in isolamento completo. Per questo le lezioni arrivano solo dalla fabbrica, che scrive con fonti fissate.
- L'installatore non è firmato con un certificato a pagamento: Windows SmartScreen lo segnala la prima volta.
  Scaricalo solo dalla pagina Releases di questo repository.
