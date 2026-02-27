import { MarkerProps } from '@react-google-maps/api';

export interface TunnelData {
  id: string;
  name: string;
  status: 'active' | 'maintenance' | 'harvesting';
  lastInspection: Date;
  crop: string;
  area: string;
  coordinates: google.maps.LatLngLiteral[];
}

export interface MapPopupProps {
  tunnel: TunnelData;
  onClose: () => void;
  position: google.maps.LatLngLiteral;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'Point';
    coordinates: number[][] | number[][][];
  };
  properties: {
    name: string;
    type?: 'valve' | 'sensor';
    fill: string;
    stroke: string;
    'fill-opacity': number;
    'stroke-opacity': number;
    'stroke-width': number;
  };
  id: string;
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface NxtAgroData {
  ce_sustrato: number;
  riego: number;
  riego_acumulado: number;
  drenaje: number;
  drenaje_acumulado: number;
  porcentaje_drenaje: number;
  ph_drenaje: number;
  timestamp: string;
}