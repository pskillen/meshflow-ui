/** Shared Leaflet divIcon marker CSS for map-container maps. */
export const MAP_NODE_MARKER_CSS = `
  .map-container .leaflet-tile-pane { z-index: 1; }
  .map-container .leaflet-overlay-pane { z-index: 400; }
  .map-container .leaflet-marker-pane { z-index: 600; }
  .map-container .leaflet-tooltip-pane { z-index: 650; }
  .custom-node-marker { background: transparent; border: none; }
  .marker-container { position: relative; text-align: center; }
  .marker-pin {
    width: 35px; height: 35px; border-radius: 50% 50% 50% 0;
    position: absolute; transform: rotate(-45deg);
    left: 50%; top: 50%; margin: -2.5px 0 0 -17.5px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .marker-text {
    position: absolute; width: 40px; left: 60%; transform: translateX(-50%);
    top: 5px; text-align: center; color: white; font-weight: bold; font-size: 12px;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
  }
  .traceroute-unknown-label {
    font-size: 11px; font-family: monospace;
    background: rgba(255,255,255,0.9); border: 1px dashed #999; padding: 2px 6px;
  }
`;
