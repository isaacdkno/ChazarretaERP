
export enum UserRole {
  DISTRIBUTOR = 'DISTRIBUTOR',
  GATE = 'GATE',
  ORDER_CENTER = 'ORDER_CENTER',
  FACTORY = 'FACTORY',
  DISPATCH = 'DISPATCH',
  COLLECTION = 'COLLECTION',
  ADMIN = 'ADMIN'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  DISPATCHED = 'DISPATCHED',
  PAID_PARTIAL = 'PAID_PARTIAL',
  PAID_FULL = 'PAID_FULL',
  CANCELLED = 'CANCELLED'
}

export interface BonusConfig {
  threshold: number;
  percentage: number;
}

export interface Product {
  id: string;
  name: string;
  brand: 'La Fornarina' | 'Villecco';
  category: string;
  bonusEnabled: boolean;
  prices: { [priceListId: string]: number }; // Precios por lista
}

export interface PriceList {
  id: string;
  name: string;
  description: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  bonusQuantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  signatureUrl?: string;
  pdfUrl?: string;
}

export interface Customer {
  id: string;
  name: string;
  groupId: string;
  priceListId: string; // Lista de precios asignada
  balance: number;
  isBlocked: boolean;
}

export interface GateEntry {
  id: string;
  customerId: string;
  customerName: string;
  productName: string;
  quantity: number;
  reason: string;
  status: 'PENDING' | 'CONVERTED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  targetId: string;
  oldValue: string;
  newValue: string;
}
