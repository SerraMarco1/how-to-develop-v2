# Pacchetto motore: Godot

Tutto ciò che è specifico di Godot. Il resto della piattaforma non conosce i dettagli del motore: li legge da qui.
La fabbrica lo legge dal ramo `main`; l'aula lo installa accanto al programma (cartella `motore` tra le risorse), in
sola lettura.

| File | A cosa serve |
|---|---|
| `engine.json` | La versione del corso (4.7.2), gli indirizzi del Godot di servizio con la loro impronta SHA-512 ufficiale, la revisione fissata della documentazione |
| `corso/` | Il piano del corso, scritto a mano: `00-piano.json` più un file per fase. `npm run piano` lo controlla e scrive `docs/piano-del-corso.md` |
| `stile-di-casa.md` | Convenzioni del corso, inserite in ogni richiesta di scrittura, revisione e correzione |
| `prompts/*.md` | Le istruzioni per i modelli (teoria, pratica, correzioni, revisione, ripasso, tutor, correttore, segnalazioni…), con segnaposto `{{nome}}` |
| `harness/htd_test.gd` | Base degli script di verifica: esegue i controlli nel progetto e stampa `HTD_RESULT` |
| `harness/htd_video.gd` | Base del video «Il risultato atteso»: avvia la scena del copione, simula i tasti, disegna scritte e riquadri, misura a ogni fotogramma se i soggetti si vedono e stampa `HTD_VIDEO` |
| `immagini/` | Schermate VERE dell'editor con `catalogo.json`: le uniche immagini che una lezione può mostrare. `etichette-editor.json` raccoglie i testi dell'interfaccia letti da Godot |
| `nomi-sbagliati.json` | Nomi dell'interfaccia che in questa versione di Godot non esistono: se una lezione li usa viene rimandata in correzione |
| `impostazioni-editor.json` | Le impostazioni dell'editor che una verifica può leggere |
| `esempi/`, `ricette.json`, `suggerimenti.json`, `assets/` | Gli esercizi di esempio mostrati ai modelli, i pezzi di scena verificati, i suggerimenti per gli errori tipici, gli asset del corso |

Per migliorare la qualità delle lezioni di solito basta modificare `stile-di-casa.md` o i file in `prompts/`, senza
toccare il codice.

I nomi dell'interfaccia scritti in `stile-di-casa.md` vanno presi dalle schermate in `immagini/`, non dalla memoria né
dalla documentazione: in alcuni punti la documentazione è più vecchia dell'editor.

Cambiare la versione di Godot o della documentazione vuol dire cambiare `engine.json` (indirizzi e impronte copiati dalla
pagina ufficiale della release): la fabbrica scarica il nuovo Godot e rifiuta di usarlo se l'impronta non torna.
