
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
  bonusThreshold?: number; 
  bonusPercentage?: number;
  prices: { [priceListId: string]: number };
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
  priceListId: string;
  balance: number;
  isBlocked: boolean;
}

export interface GateEntryItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
}

export interface GateEntry {
  id: string;
  customerId: string;
  customerName: string;
  items: GateEntryItem[];
  status: 'PENDING' | 'CONVERTED';
  createdAt: string;
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

export interface PaymentReceipt {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  cashAmount: number;
  transferAmount: number;
  paymentMode: 'FIFO' | 'MANUAL';
  orderIds: string[];
  createdAt: string;
}
