import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, Polygon, InfoWindow, Marker } from '@react-google-maps/api';
import { createClient } from '@supabase/supabase-js';
import { getISOWeek } from 'date-fns';
import type { TunnelData, GeoJSONData, NxtAgroData } from '../types';
import { useSearchParams } from 'react-router-dom';
import { OverlayView } from '@react-google-maps/api';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);



  // ... el resto de tu estado y lógica
const mapOptions = {
  mapTypeId: 'satellite',
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
};

const PEST_OPTIONS = [
  'Trips',
  'Gusano Soldado',
  'Chinche Lygus',
  'Corynespora',
  'Botritis',
  'Roya'
];

const PEST_THRESHOLDS = {
  'Trips': {
    low: { max: 0.99, color: '#22c55e', label: 'Bajo' },
    moderate: { max: 1.99, color: '#eab308', label: 'Moderado' },
    high: { max: Infinity, color: '#ef4444', label: 'Alto' }
  },
  'Gusano Soldado': {
    low: { max: 0.49, color: '#22c55e', label: 'Bajo' },
    moderate: { max: 1.49, color: '#eab308', label: 'Moderado' },
    high: { max: Infinity, color: '#ef4444', label: 'Alto' }
  },
  'Chinche Lygus': {
    low: { max: 0, color: '#22c55e', label: 'Bajo' },
    moderate: { max: 1, color: '#eab308', label: 'Moderado' },
    high: { max: Infinity, color: '#ef4444', label: 'Alto' }
  },
  'Corynespora': {
    low: { max: 2, color: '#22c55e', label: 'Bajo' },
    moderate: { max: 4, color: '#eab308', label: 'Moderado' },
    high: { max: Infinity, color: '#ef4444', label: 'Alto' }
  },
  'Roya': {
    low: { max: 2, color: '#22c55e', label: 'Bajo' },
    moderate: { max: 4, color: '#eab308', label: 'Moderado' },
    high: { max: Infinity, color: '#ef4444', label: 'Alto' }
  },
  'Botritis': {
    low: { max: 2, color: '#22c55e', label: 'Bajo' },
    moderate: { max: 5, color: '#eab308', label: 'Moderado' },
    high: { max: Infinity, color: '#ef4444', label: 'Alto' }
  }
};

const PRESSURE_THRESHOLDS = {
  normal: { min: 1.4, max: 2.0, color: '#22c55e', label: 'Normal' },
  warning: { min: 1.2, max: 2.2, color: '#eab308', label: 'Precaución' },
  critical: { color: '#ef4444', label: 'Crítico' }
};

const SAMPLING_TYPES = {
  Pressures: 'Presiones/Nxt Agro',
  labor: 'Labores',
  pests: 'Plagas y Enfermedades',
  nutrients: 'Nutrición',
  irrigation: 'Aforos',
  harvest: 'Cosecha',
  probetas: 'Probetas'
};

const SAMPLING_TABLES = {
  'Plagas y Enfermedades': 'Muestreo Plagas y Enfermedades',
  'Labores': 'Muestreos Labores',
  'Nutrición': 'Muestreos Nutricion',
  'Riego': 'Muestreos Riego',
  'Cosecha': 'Muestreos Cosecha',
  'Probetas': 'Muestreos Probetas',
  'Aforos': 'Muestreos Aforos Riego'
};

type SamplingType = 'Pressures' | 'pests' | 'nutrients' | 'irrigation' | 'harvest' | 'packaging' | 'labor' | 'probetas';

interface NutrientData {
  ce: number;
  ph: number;
  no3: number;
  ca: number;
  k: number;
  na: number;
}
 
interface TunnelMetrics {
  value?: number;
  details: string;
  nutrientData?: NutrientData;
  harvestDays?: number;
}

interface MarkerData {
  position: google.maps.LatLngLiteral;
  name: string;
  type: 'valve' | 'sensor';
  sector?: string;
}

interface ValveData {
  sector: string;
  pressure: number | null;
}

const getNutrientSeverity = (data: NutrientData): { color: string; details: string[] } => {
  const details: string[] = [];
  let status: 'green' | 'yellow' | 'red' = 'green';

  // C.E.
  const ce = data.ce;
  if (ce < 1.1 || ce > 2.5) {
    status = 'red';
    details.push(`C.E.: ${ce.toFixed(2)} (Crítico)`);
  } else if ((ce >= 1.1 && ce < 1.5) || (ce > 2.0 && ce <= 2.5)) {
    if (status !== 'red') status = 'yellow';
    details.push(`C.E.: ${ce.toFixed(2)} (Precaución)`);
  } else {
    details.push(`C.E.: ${ce.toFixed(2)} (Normal)`);
  }

  // pH
  const ph = data.ph;
  if (ph < 4.5 || ph > 6.7) {
    status = 'red';
    details.push(`pH: ${ph.toFixed(2)} (Crítico)`);
  } else if ((ph >= 4.5 && ph < 5.0) || (ph > 6.3 && ph <= 6.7)) {
    if (status !== 'red') status = 'yellow';
    details.push(`pH: ${ph.toFixed(2)} (Precaución)`);
  } else {
    details.push(`pH: ${ph.toFixed(2)} (Normal)`);
  }

  // Na
  const na = data.na;
  if (na > 120) {
    status = 'red';
    details.push(`Na: ${na.toFixed(2)} (Crítico)`);
  } else if (na >= 100 && na <= 120) {
    if (status !== 'red') status = 'yellow';
    details.push(`Na: ${na.toFixed(2)} (Precaución)`);
  } else {
    details.push(`Na: ${na.toFixed(2)} (Normal)`);
  }

  // Otros sin semáforo
  details.push(`NO3: ${data.no3.toFixed(2)}`);
  details.push(`Ca: ${data.ca.toFixed(2)}`);
  details.push(`K: ${data.k.toFixed(2)}`);

  const colors = {
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    gray: '#6B7280'
  };

  return {
    color: colors[status],
    details
  };
};

const getHarvestDaysColor = (days: number | undefined, sector: string): string => {
  if (typeof days !== 'number') return '#6B7280';

  const isEarlySector = /^[12][A-F]$/i.test(sector);
  const lateSector = /^[3-8][A-F]$/i.test(sector);
  const month = new Date().getMonth(); // 0 = enero, 11 = diciembre

  let thresholds: { green: number[]; yellow: number[]; red: number };

  if (month === 10 || month === 11 || month === 0) {
    // Noviembre, diciembre, enero
    thresholds = isEarlySector
      ? { green: [0, 11], yellow: [12, 13], red: 14 }
      : { green: [0, 9], yellow: [10, 11], red: 12 };
  } else {
    // Resto del año
    thresholds = isEarlySector
      ? { green: [0, 9], yellow: [10, 11], red: 12 }
      : { green: [0, 6], yellow: [7, 7], red: 8 };
  }

  // Paleta de colores
  const palette = {
    green: [
      '#14532d', // verde oscuro
      '#166534',
      '#22c55e', // normal
    ],
    yellow: [
      '#a16207', // oscuro
      '#eab308', // normal
    ],
    red: [
      '#dc2626', // rojo claro
      '#b91c1c', // rojo intenso
      '#7f1d1d', // muy rojo
    ]
  };

  if (days >= thresholds.green[0] && days <= thresholds.green[1]) {
    const diff = days - thresholds.green[0];
    return palette.green[Math.min(diff, palette.green.length - 1)];
  }

  if (days >= thresholds.yellow[0] && days <= thresholds.yellow[1]) {
    const diff = days - thresholds.yellow[0];
    return palette.yellow[Math.min(diff, palette.yellow.length - 1)];
  }

  if (days >= thresholds.red) {
    const diff = days - thresholds.red;
    return palette.red[Math.min(diff, palette.red.length - 1)];
  }

  return '#6B7280'; // fallback
};

export default function InteractiveMap() {
  const [selectedTunnel, setSelectedTunnel] = useState<TunnelData | null>(null);
  const [hoveredTunnel, setHoveredTunnel] = useState<string | null>(null);
  const [infoWindowPosition, setInfoWindowPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [samplingType, setSamplingType] = useState<SamplingType>('Pressures');
  const [selectedPest, setSelectedPest] = useState<string>(PEST_OPTIONS[0]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [tunnelMetrics, setTunnelMetrics] = useState<Record<string, TunnelMetrics>>({});
  const [geoJSONData, setGeoJSONData] = useState<GeoJSONData | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
  const [nxtAgroData, setNxtAgroData] = useState<NxtAgroData | null>(null);
  const [valveData, setValveData] = useState<Record<string, ValveData>>({});
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availablePestDates, setAvailablePestDates] = useState<string[]>([]);
  const [selectedPestDate, setSelectedPestDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(true);
  const [availableNutrientDates, setAvailableNutrientDates] = useState<string[]>([]);
  const [selectedNutrientDate, setSelectedNutrientDate] = useState<string>('');
  const [nutrientSubType, setNutrientSubType] = useState<'Goteros' | 'Exprimidos'>('Goteros');
  const [completedTunnels, setCompletedTunnels] = useState<Set<string>>(new Set());
  const [availableLabors, setAvailableLabors] = useState<string[]>([]);
  const [selectedLaborFilter, setSelectedLaborFilter] = useState<string>('');
  const [plannedLabors, setPlannedLabors] = useState<
    { nombre: string; fechaInicio: string; fechaFin: string }[]
  >([]);
  const [laborOptions, setLaborOptions] = useState<string[]>([]);
  const [showAllPestValues, setShowAllPestValues] = useState(false);
  const [searchParams] = useSearchParams();
const lat = parseFloat(searchParams.get('lat') || '20.7066066'); // 📍 La Peña (por defecto)
const lng = parseFloat(searchParams.get('lng') || '-103.9314381');
const mapCenter = { lat, lng };
function getIrrigationColor(caudal: number, sector: string): string {
  const isBiloxi = sector.startsWith('1') || sector.startsWith('2');

  if (isBiloxi) {
    if (caudal >= 14 && caudal <= 16) return '#22c55e';
    if ((caudal >= 12 && caudal < 14) || (caudal > 16 && caudal <= 18)) return '#eab308';
    return '#ef4444';
  } else {
    if (caudal >= 19 && caudal <= 21) return '#22c55e';
    if ((caudal >= 17 && caudal < 19) || (caudal > 21 && caudal <= 23)) return '#eab308';
    return '#ef4444';
  }
}

  useEffect(() => {
    fetchGeoJSONData();
    fetchAvailableWeeks();
  }, [samplingType]);

  useEffect(() => {
    if (!selectedMarker?.type || selectedMarker.type !== 'sensor' || !selectedMarker.sector) return;

    const channel = supabase
      .channel('nxtagro-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Nxt Agro API',
          filter: `Sector=eq.${selectedMarker.sector}`
        },
        () => {
          fetchNxtAgroData(selectedMarker.sector!);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMarker]);
  
  // Suscripción en tiempo real a cambios en los datos de túneles
useEffect(() => {
 if (
  !selectedWeek ||
  (samplingType === 'pests' && (!selectedPestDate || selectedPestDate.trim() === ''))
) {
  return;
}

  let tableName = SAMPLING_TABLES[SAMPLING_TYPES[samplingType]];
  let filter = `Semana=eq.${selectedWeek}`;

  if (samplingType === 'pests') {
    tableName = 'Muestreo Plagas y Enfermedades';
    filter = `and(Semana.eq.${selectedWeek},Plaga.eq.${selectedPest},Fecha.eq.${selectedPestDate})`;
  }

  const channel = supabase
    .channel('tunnel-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName,
        filter
      },
      () => {
        fetchTunnelMetrics();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [samplingType, selectedPest, selectedWeek, selectedPestDate]);

// Carga de labores planeadas
// Carga de labores activas sin fechas
useEffect(() => {
  if (samplingType === 'labor') {
    fetchAvailableLabors(); // ← Ya está definida correctamente
  }
}, [samplingType]);
  useEffect(() => {
  if (samplingType === 'labor' && selectedLaborFilter) {
    fetchCompletedTunnels();
  }
}, [samplingType, selectedLaborFilter]);

// Fetch de datos según el tipo de muestreo y semana seleccionada
useEffect(() => {
  if (!selectedWeek) return;

  fetchTunnelMetrics();

  switch (samplingType) {
    case 'pests':
      fetchAvailablePestDates(selectedWeek);
      break;
    case 'Pressures':
      fetchAvailableDates(selectedWeek);
      break;
    case 'nutrients':
      fetchAvailableNutrientDates(selectedWeek);
      break;
    case 'labor':
      fetchTunnelMetrics();
      break;
  }
}, [samplingType, selectedPest, selectedWeek, selectedPestDate, nutrientSubType]);

// Fetch inicial si se selecciona un marcador tipo sensor
useEffect(() => {
  if (selectedMarker?.type === 'sensor' && selectedMarker.sector) {
    fetchNxtAgroData(selectedMarker.sector);
  }
}, [selectedMarker]);
  
  // Actualización periódica de métricas y datos de sensores
useEffect(() => {
  const interval = setInterval(() => {
    if (selectedWeek) {
      fetchTunnelMetrics();
    }

    if (selectedMarker?.type === 'sensor' && selectedMarker.sector) {
      fetchNxtAgroData(selectedMarker.sector);
    }
  }, 60000); // Cada 60 segundos

  return () => clearInterval(interval);
}, [selectedWeek, selectedMarker]);
 const fetchPlannedLabors = async () => {
  try {
    const { data, error } = await supabase
      .from('Labores Personal')
      .select('"Nombre Labor", "Fecha Inicio", "Fecha Fin", "Seccion"')
      .eq('Activo', true);

    if (error) throw error;

    const result = data.map(l => ({
      nombre: l['Nombre Labor'],
      fechaInicio: l['Fecha Inicio'],
      fechaFin: l['Fecha Fin'],
      secciones: l.Seccion ? l.Seccion.split(',').map(s => s.trim().toUpperCase()) : []
    }));

    setPlannedLabors(result);
  } catch (error) {
    console.error('Error al cargar labores planeadas:', error);
    setPlannedLabors([]);
  }
};
useEffect(() => {
  const fetchActiveLabors = async () => {
    try {
      const { data, error } = await supabase
        .from('Labores Personal')
        .select('"Nombre Labor"')
        .eq('Activo', true);

      if (error) throw error;

      const uniqueLabors = [...new Set(data.map(row => row['Nombre Labor']))]
        .sort((a, b) => a.localeCompare(b)); // ✅ Ordenar alfabéticamente

      setLaborOptions(uniqueLabors);

      if (!selectedLaborFilter || !uniqueLabors.includes(selectedLaborFilter)) {
        setSelectedLaborFilter(uniqueLabors[0] ?? '');
      }
    } catch (error) {
      console.error('Error fetching active labors:', error);
      toast.error('No se pudieron cargar las labores activas');
    }
  };

  fetchActiveLabors();
  fetchPlannedLabors();
}, []);
// Carga de semanas disponibles (excepto para labores)
useEffect(() => {
  const loadWeeks = async () => {
    if (samplingType === 'labor') {
      setSelectedWeek('');
      return;
    }

    await fetchAvailableWeeks();
  };

  loadWeeks();
}, [samplingType]);

// Carga de fechas disponibles solo para presiones
useEffect(() => {
  if (selectedWeek && samplingType === 'Pressures') {
    fetchAvailableDates(selectedWeek);
  }
}, [selectedWeek, samplingType]);

// Carga de presiones para la fecha seleccionada
useEffect(() => {
  if (selectedWeek && selectedDate && samplingType === 'Pressures') {
    fetchValvePressures();
  }
}, [selectedDate, selectedWeek, samplingType]);

// Carga del archivo GeoJSON
const fetchGeoJSONData = async () => {
  try {
    const response = await fetch('/tunnels.json');
    const data = await response.json();
    setGeoJSONData(data);
  } catch (error) {
    console.error('Error loading GeoJSON data:', error);
  }
};

// Carga de labores disponibles
const fetchAvailableLabors = async () => {
  try {
    const { data, error } = await supabase
      .from('Labores Personal')
      .select('"Nombre Labor", Tipo')
      .eq('Activo', true);

    if (error) throw error;

    const filtered = data
      .filter(l => l.Tipo && l.Tipo.toUpperCase() !== 'N/A')
      .map(l => l['Nombre Labor']);

    const uniqueLabors = [...new Set(filtered)].sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    setAvailableLabors(uniqueLabors);

    if (!selectedLaborFilter || !uniqueLabors.includes(selectedLaborFilter)) {
      setSelectedLaborFilter(uniqueLabors[0] ?? '');
    }
  } catch (error) {
    console.error('Error fetching labor options:', error);
    setAvailableLabors([]);
  }
};
 // Cargar semanas disponibles para el tipo de muestreo actual
const fetchAvailableWeeks = async () => {
  try {
    let tableName: string | undefined;

    if (samplingType === 'Pressures') {
      tableName = 'Muestreos Presiones';
    } else {
      tableName = SAMPLING_TABLES[SAMPLING_TYPES[samplingType]];
    }

    if (!tableName) return;

    const { data, error } = await supabase
      .from(tableName)
      .select('Semana')
      .not('Semana', 'is', null);

    if (error) throw error;

    if (data && data.length > 0) {
      const uniqueWeeks = [...new Set(data.map(row => row.Semana.toString()))]
        .sort((a, b) => parseInt(b) - parseInt(a));

      setAvailableWeeks(uniqueWeeks);

     if (!selectedWeek || !uniqueWeeks.includes(selectedWeek)) {
  setSelectedWeek(uniqueWeeks[0] ?? '');
}
    } else {
      setAvailableWeeks([]);
      setSelectedWeek('');
    }
  } catch (error) {
    console.error('Error fetching weeks:', error);
    setAvailableWeeks([]);
    setSelectedWeek('');
  }
};

// Cargar fechas disponibles para presiones, según la semana
const fetchAvailableDates = async (week: string) => {
  try {
    const { data, error } = await supabase
      .from('Muestreos Presiones')
      .select('Fecha')
      .eq('Semana', parseInt(week))
      .order('Fecha', { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      const uniqueDates = [...new Set(data.map(row => row.Fecha))];
      setAvailableDates(uniqueDates);
      setSelectedDate(uniqueDates[0]);
    } else {
      setAvailableDates([]);
      setSelectedDate('');
    }
  } catch (error) {
    console.error('Error fetching available dates:', error);
    setAvailableDates([]);
    setSelectedDate('');
  }
};

const fetchCompletedTunnels = async () => {
  try {
    const { data, error } = await supabase
      .from('Muestreos Labores')
      .select('Seccion, "Nombre Labor"');

    if (error) throw error;

    const secciones = new Set<string>();

    data?.forEach(record => {
      const matchesFilter = !selectedLaborFilter || record['Nombre Labor'] === selectedLaborFilter;
      if (!matchesFilter || !record.Seccion) return;

      record.Seccion.split(',').forEach(p => secciones.add(p.trim()));
    });

    setCompletedTunnels(secciones); // ✅ Ahora contiene los nombres completos de polígonos
  } catch (error) {
    console.error('Error fetching completed tunnels:', error);
    setCompletedTunnels(new Set());
  }
};

// Cargar fechas disponibles para muestreo de plagas en una semana específica
const fetchAvailablePestDates = async (week: string) => {
  const parsedWeek = parseInt(week);
  if (isNaN(parsedWeek)) return;

  try {
    const { data, error } = await supabase
      .from('Muestreo Plagas y Enfermedades')
      .select('Fecha')
      .eq('Semana', parsedWeek)
      .order('Fecha', { ascending: true });

    if (error) throw error;

    const uniqueDates = [...new Set(data.map(row => row.Fecha))];

    setAvailablePestDates(uniqueDates);
    if (!uniqueDates.includes(selectedPestDate)) {
      setSelectedPestDate(uniqueDates[0] || '');
    }
  } catch (error) {
    console.error('Error fetching pest dates:', error);
    setAvailablePestDates([]);
    setSelectedPestDate('');
  }
};
const fetchAvailableNutrientDates = async (week: string) => {
  const parsedWeek = parseInt(week);
  if (isNaN(parsedWeek)) return;

  try {
    const { data, error } = await supabase
      .from('Muestreos Nutricion')
      .select('Fecha')
      .eq('Semana', parsedWeek)
      .eq('Tipo', nutrientSubType);

    if (error) throw error;

    const dates = data ? [...new Set(data.map(row => row.Fecha))] : [];

    setAvailableNutrientDates(dates);

    if (!dates.includes(selectedNutrientDate)) {
      setSelectedNutrientDate(dates[0] ?? '');
    }
  } catch (error) {
    console.error('Error fetching nutrient dates:', error);
    setAvailableNutrientDates([]);
    setSelectedNutrientDate('');
  }
};


const fetchTunnelMetrics = async () => {
  if (!selectedWeek) return;

  if (samplingType === 'labor') {
    // No hay métricas específicas, solo se usan para colorear túneles completados
    setTunnelMetrics({});
    return;
  }
  

  try {
    const metrics: Record<string, TunnelMetrics> = {};

    if (samplingType === 'probetas') {
      const { data, error } = await supabase
        .from('Muestreos Probetas')
        .select('Sector, Mililitros')
        .eq('Semana', parseInt(selectedWeek));

      if (error) throw error;

      data?.forEach(record => {
        const key = `Sector ${record.Sector}`;
        metrics[key] = {
          value: record.Mililitros,
          details: `Mililitros: ${record.Mililitros}`
        };
      });
    }  else if (samplingType === 'pests') {
  if (!selectedPestDate || selectedPestDate.trim() === '') return;

  const { data, error } = await supabase
    .from('Muestreo Plagas y Enfermedades')
    .select('Sector, Tunel, Cantidad')
    .eq('Semana', parseInt(selectedWeek))
    .eq('Plaga', selectedPest)
    .eq('Fecha', selectedPestDate);

  if (error) throw error;

  const grouped: Record<string, number[]> = {};

  data?.forEach(row => {
    const key = `${row.Sector} Tunel ${row.Tunel}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row.Cantidad);
  });

  for (const key in grouped) {
    const values = grouped[key];
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    metrics[key] = {
      value: avg,
      details: `Cantidad promedio: ${avg.toFixed(2)}`
    };
  }
}
   else if (samplingType === 'harvest') {
  // ── Optimizado: usa vista materializada via RPC ──
  const { data, error } = await supabase.rpc('get_harvest_days_per_tunnel');

  if (error) throw error;

  data?.forEach((row: { sector: string; tunel: number; dias_desde_corte: number; ultima_fecha: string; variedad: string }) => {
    const key = `${row.sector} Tunel ${row.tunel}`;
    metrics[key] = {
      harvestDays: row.dias_desde_corte,
      details: `Días desde última cosecha: ${row.dias_desde_corte}\nÚltimo corte: ${row.ultima_fecha}\nVariedad: ${row.variedad}`
    };
  });
} else if (samplingType === 'nutrients') {
      const { data, error } = await supabase
        .from('Muestreos Nutricion')
        .select('Sector, Tunel, "C.E.", pH, NO3, Ca, K, Na')
        .eq('Semana', parseInt(selectedWeek))
        .eq('Tipo', nutrientSubType);

      if (error) throw error;

      const groupedData = data?.reduce((acc, row) => {
        const key = `${row.Sector} Tunel ${row.Tunel}`;
        acc[key] ||= { ce: [], ph: [], no3: [], ca: [], k: [], na: [] };
        acc[key].ce.push(row['C.E.']);
        acc[key].ph.push(row.pH);
        acc[key].no3.push(row.NO3);
        acc[key].ca.push(row.Ca);
        acc[key].k.push(row.K);
        acc[key].na.push(row.Na);
        return acc;
      }, {} as Record<string, { ce: number[]; ph: number[]; no3: number[]; ca: number[]; k: number[]; na: number[] }>);

      for (const [key, values] of Object.entries(groupedData)) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

        const avgData: NutrientData = {
          ce: avg(values.ce),
          ph: avg(values.ph),
          no3: avg(values.no3),
          ca: avg(values.ca),
          k: avg(values.k),
          na: avg(values.na)
        };

        const { color, details } = getNutrientSeverity(avgData);
        metrics[key] = {
          value: avgData.ce,
          details: details.join('\n'),
          nutrientData: avgData
        };
      }
      
    } else if (samplingType === 'irrigation') {
      const { data, error } = await supabase
        .from('Muestreos Aforos Riego')
        .select('Sector, Tunel, CaudalGotero')
        .eq('Semana', parseInt(selectedWeek));

      if (error) throw error;

      data?.forEach(row => {
        const key = `${row.Sector} Tunel ${row.Tunel}`;
        metrics[key] = {
          value: row.CaudalGotero,
          details: `Caudal por gotero: ${row.CaudalGotero} ml/s`
        };
      });
    }

    setTunnelMetrics(metrics);
  } catch (error) {
    console.error('Error fetching tunnel metrics:', error);
  }
};
 const fetchNxtAgroData = async (sector: string) => {
  try {
    const { data, error } = await supabase
      .from('Nxt Agro API')
      .select('*')
      .eq('Sector', sector)
      .order('Timestamp', { ascending: false })
      .limit(1);

    if (error) throw error;
    setNxtAgroData(data?.[0] ?? null);
  } catch (error) {
    console.error('Error fetching NxtAgro data:', error);
  }
};

  const fetchValvePressures = async () => {
  if (!selectedWeek) return;

  try {
    const { data, error } = await supabase
      .from('Muestreos Presiones')
      .select('Sector, Presion')
      .eq('Semana', parseInt(selectedWeek))
      .eq('Fecha', selectedDate)
      .order('Fecha', { ascending: false });

    if (error) throw error;

    const pressureData: Record<string, ValveData> = {};
    
    data?.forEach(row => {
      const sector = row.Sector?.toUpperCase().trim();
      if (sector && !pressureData[sector]) {
        pressureData[sector] = {
          sector,
          pressure: row.Presion
        };
      }
    });

    setValveData(pressureData);
  } catch (error) {
    console.error('Error fetching valve pressures:', error);
  }
};

  const getValveColor = (feature: any): string => {
  if (feature.properties.type !== 'valve' || samplingType !== 'Pressures') {
    return '#388e3c';
  }

  const sectorMatch = feature.properties.name.match(/Válvula\s+(\w+)/);
  if (!sectorMatch) return '#6B7280';

  const sector = sectorMatch[1];
  const data = valveData[sector];

  if (!data || data.pressure === null) return '#6B7280';

  const pressure = data.pressure;
  if (pressure < 1.2 || pressure > 2.2) return '#ef4444';
  if (pressure < 1.4 || pressure > 2.0) return '#eab308';
  return '#22c55e';
};

const getPolygonColor = (feature: any): string => {
  const featureId = feature.id;
  const featureName = feature.properties.name;

// === LABORES ===
if (samplingType === 'labor') {
  if (completedTunnels.has(featureName)) {
    return '#22c55e'; // Verde
  }

  const [sector, , tunel] = featureName.split(' '); // e.g. "1A Tunel 4"

   const matchingPlan = plannedLabors.find(
    plan => plan.nombre?.toUpperCase() === selectedLaborFilter?.toUpperCase()
  );

  if (matchingPlan) {
    const isTunnelInPlan = matchingPlan.secciones?.includes(featureName.toUpperCase());

    const today = new Date();
    const start = new Date(matchingPlan.fechaInicio);
    const end = new Date(matchingPlan.fechaFin);

    if (isTunnelInPlan && today >= start && today <= end) return '#eab308'; // Naranja
    if (isTunnelInPlan && today > end) return '#ef4444'; // Rojo
  }

  return '#6B7280'; // Gris si no está completado ni planeado
}

  // === PROBETAS (solo sectores) ===
  if (samplingType === 'probetas' && featureId?.startsWith?.('sector_')) {
    const sectorKey = `Sector ${featureId.split('_')[1].toUpperCase()}`;
    return tunnelMetrics[sectorKey] ? '#388e3c' : '#6B7280';
  }

  // === IRRIGACIÓN ===
 if (samplingType === 'irrigation') {
  const name = featureName;
  const [sector, , tunelStr] = name.split(' ');
  const key = `${sector} Tunel ${tunelStr}`;
  const metric = tunnelMetrics[key];

  if (!metric || metric.value === undefined) return '#6B7280';
  return getIrrigationColor(metric.value, sector);
}

  const metrics = tunnelMetrics[featureName];
  if (!metrics) return '#6B7280';

  // === PRESIONES ===
  if (samplingType === 'Pressures' && metrics.value !== undefined) {
    const value = metrics.value;
    if (value >= PRESSURE_THRESHOLDS.normal.min && value <= PRESSURE_THRESHOLDS.normal.max) {
      return PRESSURE_THRESHOLDS.normal.color;
    }
    if (value >= PRESSURE_THRESHOLDS.warning.min && value <= PRESSURE_THRESHOLDS.warning.max) {
      return PRESSURE_THRESHOLDS.warning.color;
    }
    return PRESSURE_THRESHOLDS.critical.color;
  }

  // === COSECHA ===
  if (samplingType === 'harvest') {
    const sector = featureName.split(' ')[0];
    return getHarvestDaysColor(metrics.harvestDays, sector);
  }

  // === NUTRICIÓN ===
  if (samplingType === 'nutrients' && metrics.nutrientData) {
    return getNutrientSeverity(metrics.nutrientData).color;
  }

  // === PLAGAS Y ENFERMEDADES ===
  if (metrics.value === undefined) return '#6B7280';

  const thresholds = PEST_THRESHOLDS[selectedPest as keyof typeof PEST_THRESHOLDS];
  if (metrics.value <= thresholds.low.max) return thresholds.low.color;
  if (metrics.value <= thresholds.moderate.max) return thresholds.moderate.color;
  return thresholds.high.color;
};

const handlePolygonClick = useCallback((tunnel: TunnelData) => {
  setSelectedTunnel(tunnel);

  const bounds = new google.maps.LatLngBounds();
  tunnel.coordinates.forEach(coord => bounds.extend(coord));

  setInfoWindowPosition(bounds.getCenter().toJSON());
}, []);

const getLegendItems = () => {
  if (samplingType === 'nutrients') return [];

  if (samplingType === 'irrigation') {
    return [
      { color: '#6B7280', label: 'Sin datos' },
      { color: '#22c55e', label: 'Normal (14-16 ml/s Biloxi · 19-21 ml/s Otros)' },
      { color: '#eab308', label: 'Precaución (12-14 / 16-18 Biloxi · 17-19 / 21-23 Otros)' },
      { color: '#ef4444', label: 'Crítico (<12 / >18 Biloxi · <17 / >23 Otros)' }
    ];
  }
    

  if (samplingType === 'Pressures') {
    return [
      { color: '#6B7280', label: 'Sin datos' },
      { color: PRESSURE_THRESHOLDS.normal.color, label: 'Normal (1.4 - 2.0)' },
      { color: PRESSURE_THRESHOLDS.warning.color, label: 'Precaución (1.2 - 1.4 o 2.0 - 2.2)' },
      { color: PRESSURE_THRESHOLDS.critical.color, label: 'Crítico (< 1.2 o > 2.2)' }
    ];
  }
if (samplingType === 'irrigation') {
  return [
    { color: '#6B7280', label: 'Sin datos' },
    {
      color: '#22c55e',
      label: 'Biloxi: 14–16 ml/s · Otros: 19–21 ml/s'
    },
    {
      color: '#eab308',
      label: 'Biloxi: 12–14 o 16–18 ml/s · Otros: 17–19 o 21–23 ml/s'
    },
    {
      color: '#ef4444',
      label: 'Biloxi: <12 o >18 ml/s · Otros: <17 o >23 ml/s'
    }
  ];
}
  if (samplingType === 'harvest') {
    return [
      { color: '#6B7280', label: 'No cosechado' },
      { color: '#22c55e', label: 'Cosecha menor a 7 días' },
      { color: '#eab308', label: 'Cosecha entre 8 y 9 días' },
      { color: '#ef4444', label: 'Cosecha entre 10 y 11 días' },
      { color: '#991b1b', label: 'Cosecha mayor a 11 días' }
    ];
  }

  if (samplingType === 'probetas') {
    return [
      { color: '#6B7280', label: 'Sin datos' },
      { color: '#388e3c', label: 'Con datos' }
    ];
  }

  if (samplingType === 'labor') {
    return [
      { color: '#6B7280', label: 'Sin datos' },
      { color: '#22c55e', label: 'Sección Completada' }
    ];
  }

  const thresholds = PEST_THRESHOLDS[selectedPest as keyof typeof PEST_THRESHOLDS];
  return [
    { color: '#6B7280', label: 'Sin datos' },
    { color: thresholds.low.color, label: `${thresholds.low.label} (≤ ${thresholds.low.max})` },
    { color: thresholds.moderate.color, label: `${thresholds.moderate.label} (${thresholds.low.max} - ${thresholds.moderate.max})` },
    { color: thresholds.high.color, label: `${thresholds.high.label} (> ${thresholds.moderate.max})` }
  ];
};

const handleMarkerClick = (marker: MarkerData) => {
  const sectorName = marker.name.split(' ').pop()?.toUpperCase() ?? '';
  setSelectedMarker({
    ...marker,
    sector: marker.type === 'sensor' ? sectorName : sectorName
  });
};

const convertGeoJSONCoordinates = (coordinates: number[][][]): google.maps.LatLngLiteral[] => {
  return coordinates[0].map(([lng, lat]) => ({ lat, lng }));
};
const shouldRenderFeature = (feature: any) => {
  const isPoint = feature.geometry.type === 'Point';
  const isPolygon = feature.geometry.type === 'Polygon';
  const isSector = typeof feature.id === 'string' && feature.id.startsWith('sector_');

  if (samplingType === 'probetas') {
    return isSector;
  }

  // 👉 FILTRO PERSONALIZADO PARA LABORES
 if (samplingType === 'labor') {
  if (!isPolygon || isSector) return false;

  const featureName = feature.properties.name?.toUpperCase() || '';

  // Mostrar todos los caminos
  if (featureName.startsWith('Camino')) return true;

  // Mostrar todas las periferias
  if (featureName.startsWith('Periferia')) return true;

  const laborPlan = plannedLabors.find(
    plan => plan.nombre?.toUpperCase() === selectedLaborFilter?.toUpperCase()
  );

  if (!laborPlan || !laborPlan.secciones?.length) return false;

  return laborPlan.secciones.some(seccion =>
    featureName.startsWith(seccion)
  );
}

  // Otros tipos de muestreo conservan su comportamiento actual
   switch (samplingType) {
    case 'pests':
      if (!isPolygon || isSector) return false;
      const name = feature.properties.name?.toUpperCase() || '';
      return /^[1-8][A-F]\s+TUNEL\s+\d+$/i.test(name);
    case 'nutrients':
    case 'harvest':
   case 'harvest': {
  if (!isPolygon || isSector) return false;
  const name = feature.properties.name?.toUpperCase() || '';
  return /^[1-8][A-F]\s+TUNEL\s+\d+$/i.test(name); // Solo túneles
}
    case 'Pressures':
      return isPoint;
    default:
      return true;
  }
};

return (
  <div className="relative w-full h-[calc(100vh-4rem)]">
    <div className="absolute top-4 left-4 z-20 text-white">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="mb-2 bg-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#2A2A2A] transition"
      >
        {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
      </button>

      {showFilters && (
        <div className="bg-[#1A1A1A] bg-opacity-90 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Filtros de Visualización</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Muestreo</label>
              <select
                value={samplingType}
                onChange={(e) => setSamplingType(e.target.value as SamplingType)}
                className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
              >
                {Object.entries(SAMPLING_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {samplingType === 'labor' && (
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Labor</label>
                <select
                  value={selectedLaborFilter}
                  onChange={(e) => setSelectedLaborFilter(e.target.value)}
                  className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
                >
                  {availableLabors.map(labor => (
                    <option key={labor} value={labor}>{labor}</option>
                  ))}
                </select>
              </div>
            )}
 
            {samplingType === 'pests' && (
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Plaga</label>
                <select
                  value={selectedPest}
                  onChange={(e) => setSelectedPest(e.target.value)}
                  className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
                >
                  {PEST_OPTIONS.map(pest => (
                    <option key={pest} value={pest}>{pest}</option>
                  ))}
                </select>
              </div>
            )}
     {samplingType !== 'labor' && samplingType !== 'harvest' && (
  <div>
    <label className="block text-sm font-medium mb-2">Semana</label>
    <select
      value={selectedWeek}
      onChange={(e) => setSelectedWeek(e.target.value)}
      className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
      disabled={availableWeeks.length === 0}
    >
      {availableWeeks.length === 0 ? (
        <option value="">No hay datos disponibles</option>
      ) : (
        availableWeeks.map(week => (
          <option key={week} value={week}>
            Semana {week}
          </option>
        ))
      )}
    </select>
  </div>
)}
 
{samplingType === 'pests' && (
  <div>
    <label className="block text-sm font-medium mb-2">Fecha</label>
    <select
      value={selectedPestDate}
      onChange={(e) => setSelectedPestDate(e.target.value)}
      className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
      disabled={availablePestDates.length === 0}
    >
      {availablePestDates.length === 0 ? (
        <option value="">No hay fechas disponibles</option>
      ) : (
        availablePestDates.map(date => (
          <option key={date} value={date}>
            {new Date(`${date}T06:00:00Z`).toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'America/Mexico_City'
            })}
          </option>
        ))
      )}
    </select>
  </div>
)}

{samplingType === 'nutrients' && (
  <>
    <div>
      <label className="block text-sm font-medium mb-2">Tipo de Muestreo</label>
      <select
        value={nutrientSubType}
        onChange={(e) => setNutrientSubType(e.target.value as 'Goteros' | 'Exprimidos')}
        className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
      >
        <option value="Goteros">Goteros</option>
        <option value="Exprimidos">Exprimidos</option>
      </select>
    </div>

    <div className="mt-6 border-t border-[#404040] pt-4 text-xs text-white space-y-1">
      <h3 className="font-semibold text-sm mb-2">Referencias</h3>
      <p><strong>C.E.:</strong> Verde 1.5–2.0 · Amarillo 1.1–1.5 / 2.0–2.5 · Rojo &lt;1.1 / &gt;2.5</p>
      <p><strong>pH:</strong> Verde 5.0–6.3 · Amarillo 4.5–5.0 / 6.3–6.7 · Rojo &lt;4.5 / &gt;6.7</p>
      <p><strong>Na:</strong> Verde &lt;100 · Amarillo 100–120 · Rojo &gt;120</p>
    </div>
  </>
)}
        {samplingType === 'Pressures' && (
  <div>
    <label className="block text-sm font-medium mb-2">Fecha</label>
    <select
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
      className="w-full bg-[#2A2A2A] border border-[#404040] rounded-lg px-4 py-2 text-white"
      disabled={availableDates.length === 0}
    >
      {availableDates.length === 0 ? (
        <option value="">No hay fechas disponibles</option>
      ) : (
        availableDates.map(date => (
          <option key={date} value={date}>
            {new Date(date + 'T06:00:00Z').toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              timeZone: 'America/Mexico_City'
            })}
          </option>
        ))
      )}
    </select>
  </div>
)} 

{getLegendItems().length > 0 && (
  <div className="pt-4 border-t border-[#404040]">
    {samplingType !== 'nutrients' && (
      <h3 className="text-lg font-medium mb-3">Leyenda</h3>
    )}
    <div className="space-y-2">
      {getLegendItems().map((item, index) => (
        <div key={index} className="flex items-center">
          <div
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: item.color }}
          ></div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  </div>
)}
      </div>
    </div>
  )}
</div>
{samplingType === 'pests' && (
  <div className="absolute top-4 right-4 z-20">
    <button
      onClick={() => setShowAllPestValues(prev => !prev)}
      className="bg-black bg-opacity-80 text-white px-3 py-2 rounded-md text-xs hover:bg-opacity-100 transition"
    >
      {showAllPestValues ? 'Ocultar valores' : 'Mostrar valores'}
    </button>
  </div>
)}
<GoogleMap
  mapContainerClassName="w-full h-full"
  options={{
    ...mapOptions,
    gestureHandling: 'greedy',
    zoomControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl: false
  }}
  onClick={() => {
    setSelectedTunnel(null);
    setInfoWindowPosition(null);
  }}
  onLoad={(map) => {
    // ✅ Establece centro inicial solo una vez
    map.setCenter({ lat: 20.7066066, lng: -103.9314381 }); // usa tus coordenadas reales
    map.setZoom(17); // opcional: ajusta nivel de zoom inicial
  }}
>
 {geoJSONData?.features.filter(shouldRenderFeature).map((feature) => {
  if (feature.geometry.type === 'Point') {
    const [lng, lat] = feature.geometry.coordinates as number[];
    const position = { lat, lng };
    const isValve = feature.properties.type === 'valve';
    const markerColor = isValve ? getValveColor(feature) : '#B6CCA1';

    return (
      <Marker
        key={feature.id}
        position={position}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColor,
          fillOpacity: 0.9,
          strokeColor: markerColor,
          strokeWeight: 2,
          scale: 8,
        }}
        onClick={() =>
          handleMarkerClick({
            position,
            name: feature.properties.name,
            type: feature.properties.type || 'valve',
            sector: feature.properties.name.split(' ').pop()
          })
        }
      />
    );
  }

  return null;
})}
{geoJSONData?.features.filter(shouldRenderFeature).map((feature) => {
  if (feature.geometry.type === 'Polygon') {
    const coordinates = convertGeoJSONCoordinates(feature.geometry.coordinates as number[][][]);

    const polygonColor = getPolygonColor(feature);

    return (
      <Polygon
        key={feature.id}
        paths={coordinates}
        options={{
          fillColor: polygonColor,
          fillOpacity: hoveredTunnel === feature.id ? 0.8 : 0.5,
          strokeColor: polygonColor,
          strokeOpacity: 1,
          strokeWeight: hoveredTunnel === feature.id ? 3 : 2,
        }}
        onClick={() =>
  handlePolygonClick({
    name: feature.properties.name,
    coordinates: convertGeoJSONCoordinates(feature.geometry.coordinates as number[][][])
  })
}
        onMouseOver={() => setHoveredTunnel(feature.id)}
        onMouseOut={() => setHoveredTunnel(null)}
      />
    );
  }

  return null;
})}

{selectedTunnel && infoWindowPosition && (
  <InfoWindow
    position={infoWindowPosition}
    onCloseClick={() => {
      setSelectedTunnel(null);
      setInfoWindowPosition(null);
    }}
  >
    <div className="bg-black text-white rounded-lg p-4 text-xs min-w-[220px]">
      <h3 className="text-base font-semibold mb-2">{selectedTunnel.name}</h3>
      
      {tunnelMetrics[selectedTunnel.name] ? (
  <>
    {(() => {
      const { value, details } = tunnelMetrics[selectedTunnel.name];
      const [sector, , tunelStr] = selectedTunnel.name.split(' ');
      const caudal = value;

      if (samplingType === 'aforos' && caudal !== undefined) {
        const isBiloxi = sector.startsWith('1') || sector.startsWith('2');
        let status = '';
        let textColor = '';

        if (isBiloxi) {
          if (caudal >= 14 && caudal <= 16) {
            status = 'Normal';
            textColor = 'text-green-400';
          } else if ((caudal >= 12 && caudal < 14) || (caudal > 16 && caudal <= 18)) {
            status = 'Precaución';
            textColor = 'text-yellow-400';
          } else {
            status = 'Crítico';
            textColor = 'text-red-400';
          }
        } else {
          if (caudal >= 19 && caudal <= 21) {
            status = 'Normal';
            textColor = 'text-green-400';
          } else if ((caudal >= 17 && caudal < 19) || (caudal > 21 && caudal <= 23)) {
            status = 'Precaución';
            textColor = 'text-yellow-400';
          } else {
            status = 'Crítico';
            textColor = 'text-red-400';
          }
        }

        return (
          <>
            <div className="flex justify-between mb-0.5">
              <span className="font-semibold">Caudal por gotero</span>
              <span className={`font-mono ${textColor}`}>
                {caudal} ml/s ({status})
              </span>
            </div>
          </>
        );
      }

      // fallback (nutrientes, plagas, etc.)
      return details.split('\n').map((line, index) => {
        const [label, valuePart] = line.split(':');
        let value = valuePart?.trim() ?? '';
        let textColor = 'text-white';

        if (value.includes('(Normal)')) textColor = 'text-green-400';
        else if (value.includes('(Precaución)')) textColor = 'text-yellow-400';
        else if (value.includes('(Crítico)')) textColor = 'text-red-400';

        return (
          <div key={index} className="flex justify-between mb-0.5">
            <span className="font-semibold">{label.trim()}</span>
            <span className={`${textColor} font-mono`}>{value}</span>
          </div>
        );
      });
    })()}
  </>
) : (
  <p className="text-white"></p>
)}
    </div>
  </InfoWindow>
)} 
{selectedMarker && (
  <InfoWindow
    position={selectedMarker.position}
    onCloseClick={() => setSelectedMarker(null)}
  >
    <div className="bg-[#1A1A1A] text-white rounded-lg p-4 min-w-[200px]">
      <h3 className="text-lg font-semibold mb-2">{selectedMarker.name}</h3>

      {selectedMarker.type === 'sensor' && nxtAgroData ? (
        <div className="space-y-2 text-sm">
          <p>Última actualización: {nxtAgroData["Timestamp"] ?? '—'}</p>
          <p>Humedad Sustrato: {nxtAgroData["Humedad Sustrato"] ?? '—'}%</p>
          <p>C.E. Sustrato: {nxtAgroData["C.E. Sustrato"] ?? '—'} mS/cm</p>
          <p>Riego: {nxtAgroData["Riego"] ?? '—'} ml</p>
          <p>Riego Acum.: {nxtAgroData["Riego Acumulado"] ?? '—'} ml</p>
          <p>Dren Acumulado: {nxtAgroData["Dren Acumulado"] ?? '—'} ml</p>
          <p>% Dren Acumulado: {nxtAgroData["% Dren Acumulado"] ?? '—'}%</p>
          <p>Drenaje: {nxtAgroData["Dren"] ?? '—'} ml</p>
          <p>% Dren por Riego: {nxtAgroData["% Dren"] ?? '—'}%</p>
        </div>
      ) : selectedMarker.type === 'valve' && selectedMarker.sector ? (
        <p className="text-sm">
          Presión: {valveData[selectedMarker.sector]?.pressure ?? 'Sin datos'} bar
        </p>
      ) : (
        <p className="text-sm">{selectedMarker.name}</p>
      )}
    </div>
  </InfoWindow>
)}
{samplingType === 'pests' &&
 showAllPestValues &&
 geoJSONData &&
 Object.entries(tunnelMetrics).map(([name, metric]) => {
   if (metric.value === undefined) return null;

   const feature = geoJSONData.features.find(
     f => f.properties?.name === name
   );

   if (!feature || feature.geometry.type !== 'Polygon') return null;

   const coords = convertGeoJSONCoordinates(
     feature.geometry.coordinates as number[][][]
   );

   const bounds = new google.maps.LatLngBounds();
   coords.forEach(c => bounds.extend(c));

   const position = bounds.getCenter().toJSON();

   return (
     <OverlayView
       key={`pest-value-${name}`}
       position={position}
       mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
     >
       <div
         className="
           bg-black text-white text-[11px]
           px-2 py-1 rounded-md
           font-mono leading-none
           pointer-events-none
           shadow-md
         "
       >
         {metric.value.toFixed(2)}
       </div>
     </OverlayView>
   );
 })}
</GoogleMap>
</div> // cierre de div del contenedor principal
);
}