import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import PestSamplingForm from './PestSamplingForm';
import NutrientSamplingForm from './NutrientSamplingForm';
import IrrigationForm from './IrrigationForm';
import HarvestForm from './HarvestForm';
import LaborForm from './LaborForm';

type MainTab = 'pests' | 'riego' | 'nutricion' | 'harvest' | 'labor';

const MAIN_TABS = {
  pests: 'Plagas y Enfermedades',
  riego: 'Riego',
  nutricion: 'Nutrición',
  labor: 'Labores',
  harvest: 'Cosecha'
};

const SUB_TABS = {
  riego: [
    { id: 'aforos', label: 'Aforos' },
    { id: 'presiones', label: 'Presiones' },
    { id: 'probetas', label: 'Probetas' }
  ],
  nutricion: [
    { id: 'goteros', label: 'Goteros' },
    { id: 'exprimidos', label: 'Exprimidos' }
  ]
};

export default function SamplingLog() {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('pests');
  const [activeSubTab, setActiveSubTab] = useState<string>('');

  const handleMainTabClick = (tab: MainTab) => {
    setActiveMainTab(tab);
    if (tab === 'riego') {
      setActiveSubTab('aforos');
    } else if (tab === 'nutricion') {
      setActiveSubTab('goteros');
    } else {
      setActiveSubTab('');
    }
  };

  const getMainTabClass = (tab: MainTab) => `
    py-2 px-4 -mb-px ${
      activeMainTab === tab
        ? 'border-b-2 border-[#3B82F6] text-white'
        : 'text-[#A3A3A3] hover:text-white'
    }
  `;

  const getSubTabClass = (tab: string) => `
    py-2 px-4 -mb-px ${
      activeSubTab === tab
        ? 'border-b-2 border-[#3B82F6] text-white'
        : 'text-[#A3A3A3] hover:text-white'
    }
  `;

  const renderContent = () => {
    switch (activeMainTab) {
      case 'pests':
        return <PestSamplingForm />;
      case 'riego':
        return <IrrigationForm initialTab={activeSubTab} />;
      case 'nutricion':
        return <NutrientSamplingForm type={activeSubTab as 'goteros' | 'exprimidos'} />;
      case 'harvest':
        return <HarvestForm />;
      case 'labor':
        return <LaborForm />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-8">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Registro de Muestreo</h1>
          <p className="text-[#A3A3A3] text-lg">Complete los datos del muestreo</p>
        </div>

        <div className="mb-8">
          <div className="flex space-x-4 border-b border-[#2A2A2A] overflow-x-auto">
            {Object.entries(MAIN_TABS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleMainTabClick(key as MainTab)}
                className={getMainTabClass(key as MainTab)}
              >
                {label}
              </button>
            ))}
          </div>

          {(activeMainTab === 'riego' || activeMainTab === 'nutricion') && (
            <div className="flex space-x-4 mt-4">
              {SUB_TABS[activeMainTab].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveSubTab(id)}
                  className={getSubTabClass(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {renderContent()}
      </div>
    </div>
  );
}