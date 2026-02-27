import React from 'react';
import { Plane as Plant, Calendar, Ruler } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { MapPopupProps } from '../types';

export default function MapPopup({ tunnel, onClose }: MapPopupProps) {
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'harvesting':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 w-72">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{tunnel.name}</h3>
      </div>

      <div className="mb-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(tunnel.status)}`}>
          {tunnel.status.charAt(0).toUpperCase() + tunnel.status.slice(1)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <Plant className="h-4 w-4 mr-2" />
          <span className="font-medium">Crop:</span>
          <span className="ml-2">{tunnel.crop}</span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2" />
          <span className="font-medium">Last Inspection:</span>
          <span className="ml-2">
            {formatDistanceToNow(tunnel.lastInspection, { addSuffix: true })}
          </span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          <Ruler className="h-4 w-4 mr-2" />
          <span className="font-medium">Area:</span>
          <span className="ml-2">{tunnel.area}</span>
        </div>
      </div>
    </div>
  );
}