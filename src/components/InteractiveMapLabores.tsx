import React, { useEffect, useState } from 'react';
import { GoogleMap, Polygon, InfoWindow } from '@react-google-maps/api';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

const mapCenter = { lat: 20.7066066, lng: -103.9314381 };
const mapOptions = {
  mapTypeId: 'satellite',
  zoom: 17,
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
};

export default function InteractiveMapLabores() {
  const [geoJSONData, setGeoJSONData] = useState<any | null>(null);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [infoWindow, setInfoWindow] = useState<{ name: string; position: google.maps.LatLngLiteral } | null>(null);
  const [tipo, setTipo] = useState<string>(''); // Ej: TUNELES, CAMINOS, PERIFERIA o combinados
  const [laborId, setLaborId] = useState<number | null>(null);
  const [selectedTunnel, setSelectedTunnel] = useState<string | null>(null);

  // Obtener tipo y laborId desde el hash
  useEffect(() => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(query);
    const tipoParam = params.get('tipo');
    const laborIdParam = params.get('laborId');

    if (tipoParam) setTipo(tipoParam.toUpperCase());
    if (laborIdParam) setLaborId(parseInt(laborIdParam));
  }, []);

  // Cargar GeoJSON
  useEffect(() => {
    fetch('/tunnels.json')
      .then(res => res.json())
      .then(data => setGeoJSONData(data))
      .catch(err => console.error('Error loading GeoJSON:', err));
  }, []);
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'ACTUALIZAR_POLIGONOS_MAPA' && Array.isArray(event.data.secciones)) {
      setSelectedSections(new Set(event.data.secciones));
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
  // Cargar secciones seleccionadas desde Supabase
  useEffect(() => {
    if (!laborId) return;
    const loadInitialSecciones = async () => {
      const { data, error } = await supabase
        .from('Labores Personal')
        .select('Seccion')
        .eq('id', laborId)
        .single();

      if (error) {
        console.error('Error fetching labor sections:', error);
        return;
      }

      const secciones = data?.Seccion?.split(',').map(s => s.trim()).filter(Boolean) || [];
      setSelectedSections(new Set(secciones));
    };

    loadInitialSecciones();
  }, [laborId]);

  // Comunicar selección al padre
  useEffect(() => {
    window.parent.postMessage({ type: 'SECCIONES_MAPA', secciones: Array.from(selectedSections) }, '*');
  }, [selectedSections]);

  const handlePolygonClick = (name: string) => {
    setSelectedSections(prev => {
      const newSet = new Set(prev);
      newSet.has(name) ? newSet.delete(name) : newSet.add(name);
      return newSet;
    });

    const match = geoJSONData?.features.find((f: any) => f.properties?.name === name);
    if (match?.geometry?.coordinates) {
      const coords = match.geometry.coordinates[0];
      const [lng, lat] = coords[0];
      setInfoWindow({ name, position: { lat, lng } });
    }
  };

  const convertCoords = (coords: number[][][]): google.maps.LatLngLiteral[] => {
    return coords[0].map(([lng, lat]) => ({ lat, lng }));
  };

  const shouldShowFeature = (name: string): boolean => {
    const tipos = tipo.split(',').map(t => t.trim().toUpperCase());
    const upper = name.toUpperCase();
    const isTunel = /^[1-8][A-F] TUNEL \d+$/.test(upper);
    const isCamino = upper.startsWith('CAMINO');
    const isPeriferia = upper.startsWith('PERIFERIA');

    return (
      (isTunel && tipos.includes('TUNELES')) ||
      (isCamino && tipos.includes('CAMINOS')) ||
      (isPeriferia && tipos.includes('PERIFERIA'))
    );
  };

  const getColor = (name: string): string => {
    if (selectedSections.has(name)) return '#22c55e';     // verde (seleccionado)
    if (hoveredId === name) return '#b45309';              // naranja oscuro
    return '#f59e0b';                                      // naranja base
  };

    return (
    <div className="w-full h-screen">
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={mapCenter}
        zoom={17}
        onClick={() => {
          setInfoWindow(null); // ✅ cerrar InfoWindow al dar clic fuera
        }}
        options={mapOptions}
      >
        {geoJSONData?.features
          ?.filter((f: any) => f.geometry.type === 'Polygon' && shouldShowFeature(f.properties?.name))
          .map((feature: any) => {
            const name = feature.properties.name;
            const coords = convertCoords(feature.geometry.coordinates);

            return (
              <Polygon
                key={feature.id}
                paths={coords}
                options={{
                  fillColor: getColor(name),
                  fillOpacity: 0.6,
                  strokeColor: getColor(name),
                  strokeOpacity: 1,
                  strokeWeight: 2,
                }}
                onClick={(e) => {
                  if (e.domEvent.shiftKey) {
                    const match = geoJSONData?.features.find((f: any) => f.properties?.name === name);
                    if (match?.geometry?.coordinates) {
                      const coords = match.geometry.coordinates[0];
                      const [lng, lat] = coords[0];
                      setInfoWindow({
                        name,
                        position: { lat, lng },
                      });
                    }
                  } else {
                    setInfoWindow(null); // 🔸 cierra ventana si clic sin Shift
                    handlePolygonClick(name);
                  }
                }}
                onMouseOver={() => setHoveredId(name)}
                onMouseOut={() => setHoveredId(null)}
              />
            );
          })}

        {infoWindow && (
          <InfoWindow
            position={infoWindow.position}
            onCloseClick={() => setInfoWindow(null)}
            options={{
              pixelOffset: new google.maps.Size(0, -30),
            }}
          >
            <div className="bg-black text-white px-2 py-1 rounded text-sm font-medium">
              {infoWindow.name}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}