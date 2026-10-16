import { Component, type ReactNode } from "react";

/**
 * Se una pagina va in errore mentre si disegna, al suo posto compare un messaggio con il modo di uscirne, invece di
 * una finestra vuota. Le altre sezioni restano utilizzabili.
 */
export class Rete extends Component<{ children: ReactNode; chiave: string }, { errore: string | null }> {
  override state = { errore: null as string | null };

  static getDerivedStateFromError(errore: unknown) {
    return { errore: errore instanceof Error ? errore.message : String(errore) };
  }

  override componentDidUpdate(precedenti: { chiave: string }) {
    if (precedenti.chiave !== this.props.chiave && this.state.errore) this.setState({ errore: null });
  }

  override render() {
    if (!this.state.errore) return this.props.children;
    return (
      <div className="pagina">
        <h1>Questa pagina non si è aperta</h1>
        <p>Qualcosa è andato storto nel disegnarla. Le altre sezioni funzionano: torna a <a href="#/oggi">Oggi</a> o al <a href="#/corso">Corso</a>.</p>
        <pre className="dettaglio">{this.state.errore}</pre>
      </div>
    );
  }
}
