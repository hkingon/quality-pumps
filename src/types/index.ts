import { Icons } from '@/components/icons';
import { FlowUnit, HeadUnit } from '@/lib/units';

export interface NavItem {
  title: string;
  url: string;
  disabled?: boolean;
  external?: boolean;
  shortcut?: [string, string];
  icon?: keyof typeof Icons;
  label?: string;
  description?: string;
  isActive?: boolean;
  items?: NavItem[];
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

export interface FooterItem {
  title: string;
  items: {
    title: string;
    href: string;
    external?: boolean;
  }[];
}

export type MainNavItem = NavItemWithOptionalChildren;

export type SidebarNavItem = NavItemWithChildren;

// new additions
// lib/types.ts

interface MotorPowerPoint {
  kw: number;
  flow: number;
}

interface EfficiencyPoint {
  eff: string;
  flow: string;
}

export interface PumpData {
  id: string;
  maxHead: number;
  maxFlow: number;
  name?: string;
  oldSpeed?: number;
  newSpeed?: number;
  npshRequired?: any[];
  pvsq?: { head: number; flow: number }[];
  motor_power?: MotorPowerPoint[];
  efficiency?: EfficiencyPoint[];
  manualBepFlow?: number | null;

  baseRpm?: number;
  baseHz?: number;
  currentRpm?: number;
  currentHz?: number;
  speedAdjustmentEnabled?: boolean;
}

export interface SystemCurveComponent {
  id: string;
  name: string;
  staticHead: number; // For discharge: static head. For suction: static pressure
  operatingFlow: number;
  operatingHead: number; // Friction loss at operating flow
  flowUnit?: FlowUnit;
  headUnit?: HeadUnit;
  isFrictionIncluded?: boolean; // If true, operatingHead includes friction. If false, it might just be static... typically this is always friction+static or just friction?
  // Actually, per requirements: "Static Heads and operating heads are all added together".
  // The calculator returns "Total Head Loss" (friction).
  // The input has "Static Head" and "Operating Head" (Total at flow).
  // So a component has a Static Head and a Friction Head (calculated from Operating Head - Static Head).
  length?: number;
  diameter?: number;
  nominalSize?: string;
  material?: string;
  cValue?: number;
}

export interface SystemCurveData {
  id: string;
  name?: string;
  staticHead: number; // Legacy/Total
  operatingFlow: number; // Legacy/Total
  operatingHead: number; // Legacy/Total
  type?: 'discharge' | 'suction';
  components?: SystemCurveComponent[];
}

export interface SavedPump {
  id: string;
  name: string;
  maxHead: number;
  maxFlow: number;
  oldSpeed?: number;
  newSpeed?: number;
  npshRequired?: any[];
  headUnit: HeadUnit;
  flowUnit: FlowUnit;
  pvsq?: { head: number; flow: number }[];
  motorPower?: MotorPowerPoint[];
  efficiency?: EfficiencyPoint[];

  brand?: string;
  type?: string;
  model?: string;
  configuration?: string;
  kw?: number;
  voltage?: number;
  amps?: number;
  phases?: number;
  inlet?: number;
  outlet?: number;
  maxTemp?: number;
  is_public?: boolean;
  manualBepFlow?: number | null;
  rpm?: number | null;
  hz?: number | null;

  pumpClass?: string;
  application?: string;
  impellerType?: string;
  otherTraits?: string[];
  minTemp?: number;
  poles?: number;
}

export interface PumpCurvePoint {
  flow: number;
  head: number;
}

export type SegmentedPumpCurve = {
  start: PumpCurvePoint[]; // first ⅓ of the curve (dotted)
  middle: PumpCurvePoint[]; // middle ⅓ of the curve (solid)
  end: PumpCurvePoint[]; // last ⅓ of the curve (dotted)
};

export interface SystemCurvePoint {
  flow: number;
  head: number;
}

export interface AEPValues {
  '63.2%': number;
  '50%': number;
  '20%': number;
  '10%': number;
  '5%': number;
  '2%': number;
  '1%': number;
}

export interface DurationData {
  durationInMin: number;
  aepValues: AEPValues;
}

export interface LocationData {
  label: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  data: {
    [duration: string]: DurationData;
  };
}

export type LocationsData = LocationData[];

export interface SuctionCurveData {
  id: string;
  name?: string;
  operatingNpsha: number;
  staticPressure: number;
  operatingFlow: number;
  frictionLoss?: number;
  velocityHead?: number;
  components?: SystemCurveComponent[];
}

export interface SuctionCurvePoint {
  flow: number;
  head: number;
}
