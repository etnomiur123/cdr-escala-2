export type Naipe = 'Vocalista' | 'Guitarra' | 'Viola';

export type CellFlagColor = 'none' | 'green' | 'yellow' | 'red';

export type AvailabilityResponse = 'yes' | 'no' | 'if-needed';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  naipe: Naipe | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface Client {
  id: string;
  name: string;
  createdAt: number;
  membersConfigured?: boolean;
}

export interface MonthPlan {
  id: string;
  clientId: string;
  year: number;
  month: number;
  label: string;
  availabilityRequested: boolean;
  createdAt: number;
}

export interface ScheduleSlot {
  id: string;
  date: string;
  dayOfWeek: string;
  time: string;
  assignments: {
    Vocalista: string | null;
    Guitarra: string | null;
    Viola: string | null;
  };
  flags: {
    Vocalista: CellFlagColor;
    Guitarra: CellFlagColor;
    Viola: CellFlagColor;
  };
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Member {
  id: string;
  name: string;
  naipe: Naipe;
  email?: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AvailabilityByUser {
  uid: string;
  responses: Record<string, AvailabilityResponse>;
  updatedAt: number;
}

export type MonthAvailabilityState =
  | 'Por requisitar'
  | 'Vazio'
  | 'Parcialmente preenchidas'
  | 'Totalmente preenchidas';

export interface MonthSummary {
  month: MonthPlan;
  status: MonthAvailabilityState;
  slotsCount: number;
  respondedSlotsCount: number;
}
