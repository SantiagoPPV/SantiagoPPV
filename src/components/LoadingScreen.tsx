import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-xl font-medium">Cargando aplicación...</p>
      </div>
    </div>
  );
}