export interface NumericRange {
  min: number | null;
  max: number | null;
}

export interface FilterState {
  // Multi-select arrays
  pumpClass: string[];
  application: string[];
  impellerType: string[];
  installationConfiguration: string[];
  otherTraits: string[];
  powerSource: string[];
  wettedMaterials: string[];
  poles: string[];
  brand: string[];

  // Numeric ranges
  powerRange: NumericRange;
  currentRange: NumericRange;
  voltageRange: NumericRange;
  inletSizeRange: NumericRange;
  outletSizeRange: NumericRange;
  temperatureRange: NumericRange;

  // Legacy fields (keep for backward compatibility)
  phases: string[];
  model: string;
}

export const initialFilters: FilterState = {
  pumpClass: [],
  application: [],
  impellerType: [],
  installationConfiguration: [],
  otherTraits: [],
  powerSource: [],
  wettedMaterials: [],
  poles: [],
  brand: [],
  powerRange: { min: null, max: null },
  currentRange: { min: null, max: null },
  voltageRange: { min: null, max: null },
  inletSizeRange: { min: null, max: null },
  outletSizeRange: { min: null, max: null },
  temperatureRange: { min: null, max: null },
  phases: [],
  model: ''
};

// Hierarchical filter options (Pump Class — "What kind of pump is it?")
export const PUMP_CLASS_OPTIONS = {
  Centrifugal: [
    'End Suction',
    'Horizontal Multistage',
    'Vertical Multistage',
    'Split Case',
    'Vertical Turbine',
    'Mixed Flow',
    'Axial Flow',
    'Jet Pump',
    'Regenerative / Peripheral',
    'Circulator (Wet Rotor)'
  ],
  'Positive Displacement': [
    'Diaphragm',
    'Piston',
    'Progressive Cavity (Helical Rotor)',
    'Gear',
    'Lobe',
    'Rotary Vane',
    'Peristaltic (Hose)',
    'Flexible Impeller'
  ],
  'Submersible Sewage & Drainage': [
    'Sewage (Solids Handling)',
    'Grinder',
    'Cutter',
    'Drainage',
    'Slurry'
  ]
};

// Application — "What job is it sold for?"
export const APPLICATION_OPTIONS = [
  'Stormwater',
  'Sewage & Wastewater',
  'Greywater / Effluent',
  'Dewatering (Construction & Mining)',
  'Irrigation',
  'Cold Water Supply',
  'Rainwater / Tank Supply',
  'Water Transfer',
  'Pressure Boosting',
  'Hot & Chilled Water Circulation',
  'Bore Water Supply',
  'Fire — AS2941 Certified Systems',
  'Firefighting — General / Rural'
];

// Impeller Type — "What is inside it?"
export const IMPELLER_TYPE_OPTIONS = [
  'N/A — No Impeller (PD pumps)',
  'Closed',
  'Semi-Open',
  'Open',
  'Vortex (Recessed)',
  'Single Channel',
  'Multi-Channel',
  'Screw (Screw-Centrifugal)',
  'Axial (Propeller)',
  'Mixed Flow',
  'Peripheral (Turbine)',
  'Flexible Vane'
];

// Installation Configuration — "How / where is it installed?"
export const INSTALLATION_CONFIG_OPTIONS = [
  'Surface-Mounted',
  'Submersible',
  'Borehole',
  'Inline',
  'Close-Coupled',
  'Long-Coupled / Baseplate',
  'Portable / Trolley',
  'Single Pump',
  'Dual Pump',
  'Triplex'
];

// Other Traits — "What extra capabilities does it have?"
export const OTHER_TRAITS_OPTIONS = [
  'Self-Priming',
  'Dry-Run Capable',
  'VFD Compatible',
  'Automatic Operation (Float / Built-in Controller)',
  'Built-in Thermal Protection',
  'Hazardous Area — Class 1 Zone 2',
  'AS/NZS 4020 Approved (Drinking Water)',
  'WaterMark Certified'
];

// Power Source — "What powers it?" (rename of Phases)
export const POWER_SOURCE_OPTIONS = [
  '1 Phase (230 V)',
  '3 Phase (415 V)',
  'DC (Solar)',
  'Petrol Engine',
  'Diesel Engine'
];

// Wetted Materials — "What is it made of?"
export const WETTED_MATERIALS_OPTIONS = [
  'Cast Iron',
  '304 Stainless Steel',
  '316 Stainless Steel',
  'Thermoplastic / Composite',
  'Bronze',
  'Brass'
];

// Legacy (kept for backward compatibility with un-migrated data)
export const PHASE_OPTIONS = ['1 Phase', '3 Phase', 'DC'];

export const POLE_OPTIONS = ['2', '4', '6', '8'];
