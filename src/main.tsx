import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import 'maplibre-gl/dist/maplibre-gl.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

createRoot(document.getElementById("root")!).render(<App />);
