import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./stile.css";

// Gli errori di disegno finiscono nella console con il punto preciso in cui sono nati (servono a capire un guasto).
const registra = (errore: unknown, info: { componentStack?: string }) => console.error(`${errore instanceof Error ? errore.message : String(errore)}${info.componentStack ?? ""}`);

createRoot(document.getElementById("radice")!, { onCaughtError: registra, onUncaughtError: registra }).render(<App />);
