interface TankVisualizerProps {
  level: number;     // Porcentaje (0-100)
  capacity: number;  // Por ahora no lo usamos
  tankId: number;    // ID único del tanque
}

const TankVisualizer = ({ level = 0, tankId }: TankVisualizerProps) => {
  const clampedLevel = Math.min(100, Math.max(0, level));
  const topPosition = `calc(100% - ${clampedLevel}% - 1%)`;

  // Umbrales por tanque (puedes personalizar más si lo deseas)
  const thresholds: Record<number, { low: number; medium: number }> = {
    9: { low: 20, medium: 40 }, // Tanque ácido (más estricto)
    default: { low: 20, medium: 40 }, // Umbrales estándar
  };

  // Obtener los umbrales según el ID o usar el default
  const { low, medium } = thresholds[tankId] || thresholds.default;

  // Colores según umbral por tanque
  let topColor = '#29ABE2'; // Azul por defecto
  let bottomColor = '#0000FF';

  if (clampedLevel > medium) {
    topColor = '#29ABE2';     // Azul - Nivel alto
    bottomColor = '#0000FF';
  } else if (clampedLevel >= low) {
    topColor = '#FFFF00';     // Amarillo - Nivel medio
    bottomColor = '#FFD700';
  } else {
    topColor = '#FF0000';     // Rojo - Nivel bajo
    bottomColor = '#8B0000';
  }

  return (
    <div className="relative w-40 h-64 border-2 border-gray-600 border-t-0 rounded-b-lg overflow-hidden">
      {/* Líquido con animación */}
      <div className="absolute w-full h-full overflow-hidden">
        <svg
          className="absolute w-[300%] h-full animate-waves"
          style={{ top: topPosition }}
          viewBox="0 0 200 100"
        >
          <defs>
            <linearGradient id={`waterGradient-${tankId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0" stopColor={topColor} />
              <stop offset="1" stopColor={bottomColor} />
            </linearGradient>
          </defs>
          <path
            fill={`url(#waterGradient-${tankId})`}
            d="M 0,0 v 100 h 200 v -100 
              c -10,0 -15,5 -25,5 c -10,0 -15,-5 -25,-5
              c -10,0 -15,5 -25,5 c -10,0 -15,-5 -25,-5
              c -10,0 -15,5 -25,5 c -10,0 -15,-5 -25,-5
              c -10,0 -15,5 -25,5 c -10,0 -15,-5 -25,-5"
          />
        </svg>
      </div>

      {/* Porcentaje visible */}
      <div className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold pointer-events-none">
        {clampedLevel.toFixed(0)}%
      </div>

      {/* Indicadores de nivel */}
      <div className="absolute right-0 bg-gray-600 h-1 w-4 bottom-[25%]" />
      <div className="absolute right-0 bg-gray-600 h-1 w-4 bottom-[50%]" />
      <div className="absolute right-0 bg-gray-600 h-1 w-4 bottom-[75%]" />
    </div>
  );
};

export default TankVisualizer;