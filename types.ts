
export enum FoodType {
  HOT_MEALS = 'Hot Meals',
  PRODUCE = 'Produce',
  BAKERY = 'Bakery',
  DAIRY = 'Dairy',
  CANNED = 'Canned/Dry',
  PREPARED = 'Prepared Cold'
}

export type EstablishmentType = 'Restaurant' | 'Cafe' | 'Grocer' | 'Hotel' | 'Catering';
export type DestinationType = 'Shelter' | 'Food Bank' | 'Community Kitchen' | 'Low-Income Housing';

export interface LocationData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'surplus' | 'demand';
  establishmentType?: EstablishmentType | DestinationType;
  foodType: FoodType;
  quantity: number; // in servings or lbs
  urgency: 'low' | 'medium' | 'high' | 'critical';
  expiryMinutes?: number;
  managedBy: string;
  shelfLife?: string;
  co2Impact?: number;
  dishName?: string;
}

export interface LogisticsPlan {
  id: string;
  sourceId: string;
  destinationId: string;
  provider: 'UberDirect' | 'DoorDashDrive' | 'Volunteer' | 'Internal';
  estimatedCost: number;
  estimatedArrival: string;
  routeDistance: string;
  aiReasoning: string;
  matchingScore: number;
  quantityMoved: number;
  costPayer: 'Sender' | 'Receiver' | 'Split';
  senderCostShare?: number; // percentage (0-100)
  inspectionStatus: 'Pending' | 'Passed' | 'Failed';
  inspectionDetails: {
    tempChecked: boolean;
    sealed: boolean;
    specialistCertified: boolean;
  };
  routeGeometry?: [number, number][]; // Actual road path coordinates
  driverId?: string;
}

export interface Driver {
  id: string;
  name: string;
  provider: string;
  trustScore: number;
  certifications: string[];
  history: string[];
}
