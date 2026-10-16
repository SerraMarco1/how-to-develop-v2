# How to Develop

Un corso per imparare a fare videogiochi con **Godot 4.7** partendo da zero, scritto e verificato da una «fabbrica»
automatica e studiato in un programma Windows, l'«aula».

- **La fabbrica** gira su GitHub Actions ogni 15 minuti, anche a PC spento. Scrive le lezioni del
  [piano del corso](docs/piano-del-corso.md) con modelli AI gratuiti, esegue ogni esercizio in Godot (deve fallire prima
  del lavoro e passare dopo), le fa rivedere e le pubblica nel ramo `corso`.
- **L'aula** è il programma per studiare: lezioni, esercizi controllati in Godot sul tuo progetto, tutor, ripasso,
  «Cosa so fare». Scarica le lezioni pubblicate e controlla l'impronta di ogni file.

Come è fatta e perché: [docs/architettura.md](docs/architettura.md). Come si usa: [docs/guida.md](docs/guida.md).

## Installare l'aula

Dalla pagina [Releases](https://github.com/SerraMarco1/how-to-develop-v2/releases) scarica
`How-to-Develop-<versione>-installa.exe` e avvialo. Si installa per il solo utente, senza permessi di amministratore, e
poi si aggiorna da sola.

Il programma non è firmato con un certificato a pagamento: la prima volta Windows SmartScreen mostra «Windows ha
protetto il PC». Si procede con «Ulteriori informazioni» → «Esegui comunque», solo se il file viene da questa pagina.

## Sviluppo

Serve Node.js 24.

```bash
npm ci
```

| Comando | Cosa fa |
|---|---|
| `npm run tipi` | Controlla i tipi di tutto il codice |
| `npm run prove` | Le prove: sicurezza, e la catena di scrittura completa con il Godot vero e un fornitore finto (scarica Godot e la documentazione la prima volta) |
| `npm run piano` | Controlla il piano del corso e rigenera `docs/piano-del-corso.md` |
| `npm run avvia --workspace aula` | Avvia l'aula dai sorgenti |
| `node aula/strumenti/prova.mjs <cartella del ramo corso>` | La prova completa dell'aula, dentro Electron, con un finto GitHub |
| `npm run installatore --workspace aula` | Costruisce l'installatore Windows in `aula/rilascio/` |
| `node aula/strumenti/prova-installata.mjs` | Prova il programma costruito: parte dalle sue risorse, finestra isolata, protezioni dell'eseguibile, rifiuto di un `app.asar` alterato |

La fabbrica in locale (senza spingere niente): `HTD_DATI=<copia del ramo corso> HTD_SENZA_PUSH=1 npx tsx fabbrica/src/giro.ts`,
con le chiavi dei modelli nelle variabili d'ambiente (`GEMINI_API_KEY`, …).

## Sicurezza

Vedi [SECURITY.md](SECURITY.md).
