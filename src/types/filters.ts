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
  phases: string[];
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
  model: string;
}

export const initialFilters: FilterState = {
  pumpClass: [],
  application: [],
  impellerType: [],
  installationConfiguration: [],
  otherTraits: [],
  phases: [],
  poles: [],
  brand: [],
  powerRange: { min: null, max: null },
  currentRange: { min: null, max: null },
  voltageRange: { min: null, max: null },
  inletSizeRange: { min: null, max: null },
  outletSizeRange: { min: null, max: null },
  temperatureRange: { min: null, max: null },
  model: ''
};

// Hierarchical filter options
export const PUMP_CLASS_OPTIONS = {
  Centrifugal: [
    'End Suction',
    'Horizontal Multistage',
    'Vertical Multistage',
    'Split Case',
    'Vertical Turbine',
    'Mixed Flow',
    'Axial Flow',
    'Self-Priming',
    'Jet Pump'
  ],
  'Positive Displacement': [
    'Diaphragm',
    'Piston',
    'Progressive Cavity',
    'Gear',
    'Lobe',
    'Rotary Vane'
  ],
  'Submersible Sewage & Drainage': [
    'Vortex',
    'Grinder',
    'Cutter',
    'Drainage',
    'Slurry'
  ],
  'Solar / DC': ['Solar Submersible', 'Solar Surface Mount']
};

export const APPLICATION_OPTIONS = [
  'Stormwater',
  'Sewage',
  'Irrigation',
  'Cold Water Supply',
  'Pressure Boosting',
  'Borehole Supply',
  'Fire (AS2941)'
];

export const IMPELLER_TYPE_OPTIONS = [
  'Closed',
  'Semi-Open',
  'Open',
  'Vortex',
  'Channel',
  'Screw',
  'Axial Flow',
  'Mixed Flow'
];

export const INSTALLATION_CONFIG_OPTIONS = [
  'Single Pump',
  'Dual Pump',
  'Triplex',
  'Inline',
  'Submersible',
  'Surface-Mounted',
  'Borehole'
];

export const OTHER_TRAITS_OPTIONS = [
  'Self-Priming',
  'Dry-Run Capable',
  'VFD Compatible',
  'Class 1 Zone 2 Rated',
  'AS4020 (Drinking Water) Approved'
];

export const PHASE_OPTIONS = ['1 Phase', '3 Phase', 'DC'];

export const POLE_OPTIONS = ['2', '4', '6', '8'];
