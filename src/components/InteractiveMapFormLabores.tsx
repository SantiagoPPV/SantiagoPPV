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
  const [planeadas, setPlaneadas] = useState<Set<string>>(new Set());
const [realizadas, setRealizadas] = useState<Set<string>>(new Set());
  const [selectedPolygon, setSelectedPolygon] = useState<{ name: string; position: google.maps.LatLngLiteral } | null>(null);
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
  
const SECTOR_TUNNELS: Record<string, [number, number]> = {
  '1A': [1, 25], '1B': [1, 23], '1C': [1, 24], '1D': [1, 20], '1E': [1, 17], '1F': [1, 23],
  '2A': [1, 20], '2B': [1, 20], '2C': [1, 20], '2D': [1, 22], '2E': [1, 26],
  '3A': [1, 25], '3B': [1, 20], '3C': [1, 20],
  '4A': [1, 23], '4B': [1, 20], '4C': [1, 20],
  '5A': [1, 22], '5B': [1, 20], '5C': [1, 20],
  '6A': [1, 29], '6B': [15, 28], '6C': [1, 38], '6D': [1, 37],
  '7A': [1, 14], '7B': [1, 29], '7C': [1, 35], '7D': [1, 25], '7E': [1, 19],
  '8A': [1, 25], '8B': [1, 23], '8C': [1, 24], '8D': [1, 20], '8E': [1, 17], '8F': [1, 23],
};
 
useEffect(() => {
  const handler = (event: MessageEvent) => {
    // ✅ Actualizar polígonos
    if (event.data?.type === 'ACTUALIZAR_POLIGONOS_MAPA' && Array.isArray(event.data.secciones)) {
      setSelectedSections(new Set(event.data.secciones));
    }

    // ✅ Responder con cantidad de túneles para un sector
    if (event.data?.type === 'SOLICITAR_TUNELES_SECTOR' && typeof event.data.sector === 'string') {
      const sector = event.data.sector.trim();
      const [start, end] = SECTOR_TUNNELS[sector] || [0, 0];
      const cantidad = end >= start ? end - start + 1 : 0;

      window.parent.postMessage({
        type: 'RESPUESTA_TUNELES_SECTOR',
        sector,
        cantidad
      }, '*');
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
  // Cargar secciones seleccionadas desde Supabase
 useEffect(() => {
  if (!laborId) return;

  const loadSeccionesPlaneadasYCompletadas = async () => {
    // 1. Obtener la labor para conocer su nombre y tipo
    const { data: laborData, error: laborError } = await supabase
      .from('Labores Personal')
      .select('Seccion, "Nombre Labor"')
      .eq('id', laborId)
      .single();

    if (laborError || !laborData) {
      console.error('Error obteniendo labor:', laborError);
      return;
    }

    const nombreLabor = laborData['Nombre Labor'];
   const expandirTuneles = (secciones: string[]) => {
  const tuneles: string[] = [];
  for (const sec of secciones) {
    const match = sec.match(/^([1-8][A-F])$/); // si es solo sector
    if (match && SECTOR_TUNNELS[match[1]]) {
      const [start, end] = SECTOR_TUNNELS[match[1]];
      for (let i = start; i <= end; i++) {
        tuneles.push(`${match[1]} Tunel ${i}`);
      }
    } else {
      tuneles.push(sec); // ya viene como túnel completo
    }
  }
  return tuneles;
};

const planeadasRaw = (laborData.Seccion || '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

const planeadas = expandirTuneles(planeadasRaw);

    // 2. Obtener secciones realizadas desde Muestreos Labores
    const { data: muestreadasData, error: muestreadasError } = await supabase
      .from('Muestreos Labores')
      .select('Seccion')
      .eq('Nombre Labor', nombreLabor);

    if (muestreadasError) {
      console.error('Error obteniendo secciones muestreadas:', muestreadasError);
      return;
    }

    // 3. Extraer todas las secciones realizadas
    const realizadasRaw = muestreadasData
  .map((r) => r.Seccion || '')
  .flatMap((s) => s.split(','))
  .map((s) => s.trim())
  .filter(Boolean);

const realizadas = expandirTuneles(realizadasRaw);

    // 4. Separar en dos conjuntos
   setPlaneadas(new Set(planeadas));
setRealizadas(new Set(realizadas));
  };

  loadSeccionesPlaneadasYCompletadas();
}, [laborId]);

  // Comunicar selección al padre
  useEffect(() => {
    window.parent.postMessage({ type: 'SECCIONES_MAPA', secciones: Array.from(selectedSections) }, '*');
  }, [selectedSections]);

 const handlePolygonClick = (name: string) => {
  if (!planeadas.has(name)) return; // ❌ no permitir seleccionar no planeadas

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
  if (selectedSections.has(name)) return '#22c55e';  // verde: seleccionados
  if (realizadas.has(name)) return '#15803d';        // verde oscuro: realizados
  if (planeadas.has(name)) return '#f59e0b';         // naranja: planeados
  if (hoveredId === name) return '#b45309';          // hover: naranja oscuro
  return '#9CA3AF';                                  // gris por defecto
};


return (
    <div className="w-full h-screen">
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={mapCenter}
        zoom={17}
        onClick={() => {
          setInfoWindow(null); // ✅ cerrar InfoWindow al hacer clic fuera de un polígono
        }}
        options={mapOptions}
      >
        {geoJSONData?.features
  ?.filter((f: any) => {
    const name = f.properties?.name?.trim();
    return (
      f.geometry.type === 'Polygon' &&
      name &&
      (
        planeadas.has(name) ||
        realizadas.has(name) ||
        selectedSections.has(name)
      )
    );
  })
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
                onClick={() => handlePolygonClick(name)}
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