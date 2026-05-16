import { useState, useEffect } from 'react';

export interface MapLayersState {
  vehicles: boolean;
  drivers: boolean;
  routes: boolean;
  zones: boolean;
  batches: boolean;
  alerts: boolean;
  facilities: boolean;
  warehouses: boolean;
}

const defaultLayers: MapLayersState = {
  vehicles: true,
  drivers: true,
  routes: true,
  zones: true,
  batches: true,
  alerts: true,
  facilities: true,
  warehouses: true,
};

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayersState>(() => {
    try {
      const saved = localStorage.getItem('routeserve_map_layers');
      return saved ? { ...defaultLayers, ...JSON.parse(saved) } : defaultLayers;
    } catch {
      return defaultLayers;
    }
  });

  useEffect(() => {
    localStorage.setItem('routeserve_map_layers', JSON.stringify(layers));
  }, [layers]);

  const toggleLayer = (key: keyof MapLayersState) => {
    setLayers(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const setLayer = (key: keyof MapLayersState, value: boolean) => {
    setLayers(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return { layers, toggleLayer, setLayer };
}
