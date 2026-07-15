import {
  UserRole,
  DumpsterStatus,
  WorkOrderType,
  WorkOrderStatus,
  WorkOrderDumpsterRole,
  CustomerType,
  VehicleStatus,
  WorkOrderCancellationReason,
  DriverStatus,
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
  capacityValue: number;
  capacityUnit: string;
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

export interface WorkOrder {
  id: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  sequence: number;
  scheduledAt?: Date;
  returnDueDate?: Date;
  observations?: string | null;
  driverId: string;
  vehicleId: string;
  /** @deprecated substituído por workOrderDumpsters; mantido só para leitura histórica. */
  dumpsterId?: string | null;
  /** @deprecated substituído por workOrderDumpsters; mantido só para leitura histórica. */
  exchangeDumpsterId?: string | null;
  /** Troca em duas etapas: 1 = entregar nova(s), 2 = retirar antiga(s) */
  exchangeLeg?: number | null;
  jobSiteId?: string;
  yardId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  canceledAt?: Date | null;
  cancellationReason?: WorkOrderCancellationReason | null;
  cancellationNotes?: string | null;
  canceledByRole?: UserRole | null;
  canceledById?: string | null;
  archivedAt?: Date | null;
  updatedAt: Date;
  driver?: Driver;
  vehicle?: Vehicle;
  /** @deprecated ver workOrderDumpsters */
  dumpster?: Dumpster;
  /** @deprecated ver workOrderDumpsters */
  exchangeDumpster?: Dumpster;
  jobSite?: JobSite;
  yard?: Yard;
  proofs?: WorkOrderProof[];
  workOrderDumpsters?: WorkOrderDumpster[];
}

/**
 * Uma caixa (caçamba) dentro de um pedido.
 */
export interface WorkOrderDumpster {
  id: string;
  workOrderId: string;
  /** Nula = não atribuída pelo admin; motorista declara antes de iniciar/concluir. */
  dumpsterId?: string | null;
  dumpster?: Dumpster | null;
  role: WorkOrderDumpsterRole;
  /** Ordem de exibição da caixa dentro do pedido. */
  position: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkOrderProof {
  id: string;
  workOrderId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  notes?: string;
  createdAt: Date;
  workOrder?: WorkOrder;
}
