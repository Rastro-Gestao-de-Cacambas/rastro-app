export enum UserRole {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
}

export enum CustomerType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
}

export enum DumpsterStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  /** Caçamba com resíduos — aguardando viagem de descarte */
  WITH_RESIDUE = 'WITH_RESIDUE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

export enum WorkOrderType {
  DROP_OFF = 'DROP_OFF',
  PICK_UP = 'PICK_UP',
  EXCHANGE = 'EXCHANGE',
  DUMP = 'DUMP',
}

export enum WorkOrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DELIVERED = 'DELIVERED',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

export enum DriverStatus {
  AVAILABLE = 'AVAILABLE',
  ON_DUTY = 'ON_DUTY',
  OFF_DUTY = 'OFF_DUTY',
  INACTIVE = 'INACTIVE',
}

export enum CNHCategory {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  AB = 'AB',
  AC = 'AC',
  AD = 'AD',
  AE = 'AE',
}
