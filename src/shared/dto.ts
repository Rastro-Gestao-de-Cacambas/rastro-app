import {
  DeliveryType,
  UserRole,
  WorkOrderType,
  WorkOrderStatus,
  CustomerType,
  DumpsterStatus,
  VehicleStatus,
  DriverStatus,
  CNHCategory,
} from './enums';

export interface LoginDto {
  cpf: string;
  password: string;
}

export interface DriverAuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    name: string;
    cpf: string;
    role: string;
    empresaId?: string | null;
  };
}

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email?: string;
    name: string;
    cpf?: string;
    role: UserRole;
    empresaId?: string | null;
  };
}

export interface CreateDeliveryDto {
  type: DeliveryType;
  dumpsterId: string;
  jobSiteId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  photoUrl?: string;
  notes?: string;
}

export interface UpdateDeliveryDto {
  notes?: string;
  photoUrl?: string;
}

export interface CreateDumpsterDto {
  code: string;
  capacityM3: number;
  status?: DumpsterStatus;
}

export interface CreateJobSiteDto {
  customerId: string;
  address: string;
  neighborhood?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  reference?: string;
  notes?: string;
}

export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  type?: CustomerType;
}

export interface CreateContactDto {
  customerId: string;
  name: string;
  role?: string;
  phone?: string;
  whatsapp?: string;
}

export interface CreateDriverDto {
  nomeCompleto: string;
  cpf: string;
  telefone?: string;
  email: string;
  senha: string;
  numeroCNH?: string;
  categoriaCNH?: CNHCategory | string;
  validadeCNH?: Date | string;
  status?: DriverStatus;
  ativo?: boolean;
  veiculoPadraoId?: string;
  empresaId?: string;
}

export interface CreateUserDto {
  email: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface ResetPasswordDto {
  newPassword: string;
}

export interface CreateVehicleDto {
  placa: string;
  vehicleTypeId: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  renavam?: string;
  observacoes?: string;
  possuiMunck?: boolean;
  status?: VehicleStatus;
  temRastreador?: boolean;
  codigoRastreador?: string;
  empresaId?: string;
}

export interface CreateYardDto {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateWorkOrderDto {
  type: WorkOrderType;
  driverId: string;
  vehicleId: string;
  dumpsterId: string;
  jobSiteId?: string;
  yardId?: string;
  scheduledAt?: Date;
  returnDueDate?: Date;
  isIndeterminate?: boolean;
  observations?: string;
}

export interface UpdateWorkOrderDto {
  type?: WorkOrderType;
  driverId?: string;
  vehicleId?: string;
  dumpsterId?: string;
  jobSiteId?: string;
  yardId?: string;
  scheduledAt?: Date;
  returnDueDate?: Date;
  isIndeterminate?: boolean;
  observations?: string | null;
}

export interface ReorderWorkOrdersDto {
  driverId: string;
  orders: Array<{
    id: string;
    sequence: number;
  }>;
}

export interface CompleteWorkOrderDto {
  lat: number;
  lng: number;
  accuracy?: number;
  notes?: string;
}
