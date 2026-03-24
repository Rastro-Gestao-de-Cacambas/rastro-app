import {
  DeliveryType,
  UserRole,
  DumpsterStatus,
  WorkOrderType,
  WorkOrderStatus,
  CustomerType,
  VehicleStatus,
  DriverStatus,
  CNHCategory,
} from './enums';

export interface User {
  id: string;
  email?: string;
  username?: string;
  name: string;
  cpf?: string;
  role: UserRole;
  isActive?: boolean;
  empresaId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Driver {
  id: string;
  nomeCompleto: string;
  cpf: string;
  telefone?: string;
  email?: string;
  senhaHash: string;
  numeroCNH?: string;
  categoriaCNH?: string;
  validadeCNH?: Date;
  status: DriverStatus;
  ativo: boolean;
  veiculoPadraoId?: string;
  empresaId?: string;
  createdAt: Date;
  updatedAt: Date;
  veiculoPadrao?: Vehicle;
  workOrders?: WorkOrder[];
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  type?: CustomerType;
  createdAt: Date;
  updatedAt: Date;
  jobSites?: JobSite[];
  contacts?: Contact[];
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
}

export interface JobSite {
  id: string;
  customerId: string;
  name?: string;
  address: string;
  neighborhood?: string;
  reference?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
}

export interface VehicleType {
  id: string;
  name: string;
  empresaId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehicle {
  id: string;
  placa: string;
  vehicleTypeId: string;
  vehicleType?: VehicleType;
  marca?: string;
  modelo?: string;
  ano?: number;
  renavam?: string;
  observacoes?: string;
  possuiMunck: boolean;
  status: VehicleStatus;
  temRastreador: boolean;
  codigoRastreador?: string;
  empresaId?: string;
  createdAt: Date;
  updatedAt: Date;
  workOrders?: WorkOrder[];
  drivers?: Driver[];
}

export interface Yard {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dumpster {
  id: string;
  code: string;
  capacityM3: number;
  status: DumpsterStatus;
  currentJobSiteId?: string;
  lastLat?: number;
  lastLng?: number;
  lastAccuracy?: number;
  lastLocationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  currentJobSite?: JobSite;
  workOrders?: WorkOrder[];
}

export interface Delivery {
  id: string;
  type: DeliveryType;
  dumpsterId: string;
  jobSiteId: string;
  driverId: string;
  occurredAt: Date;
  latitude: number;
  longitude: number;
  accuracy?: number;
  photoUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  dumpster?: Dumpster;
  jobSite?: JobSite;
  driver?: Driver;
}

export interface WorkOrder {
  id: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  sequence: number;
  scheduledAt?: Date;
  returnDueDate?: Date;
  isIndeterminate: boolean;
  observations?: string | null;
  driverId: string;
  vehicleId: string;
  dumpsterId: string;
  jobSiteId?: string;
  yardId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
  driver?: Driver;
  vehicle?: Vehicle;
  dumpster?: Dumpster;
  jobSite?: JobSite;
  yard?: Yard;
  proofs?: WorkOrderProof[];
}

export interface WorkOrderProof {
  id: string;
  workOrderId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  photoUrl?: string;
  notes?: string;
  createdAt: Date;
  workOrder?: WorkOrder;
}
