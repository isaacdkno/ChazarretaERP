
export enum UserRole {
  DISTRIBUTOR = 'DISTRIBUIDOR',
  GATE = 'PORTERIA',
  ORDER_CENTER = 'CENTRO_PEDIDOS',
  FACTORY = 'PRODUCCION',
  DISPATCH = 'DESPACHO',
  COLLECTION = 'COBRANZA',
  MANAGER = 'GERENTE',
  ADMIN = 'ADMINISTRADOR'
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isApproved: boolean;
  createdAt: string;
  address?: string;
  phone?: string;
  cuit?: string;
  customerId?: string;
  passwordHash?: string;
}

export interface CurrentUser {
  id?: string;
  name: string;
  role: UserRole;
  email?: string;
  customerId?: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  DISPATCHED = 'DISPATCHED',
  PAID_PARTIAL = 'PAID_PARTIAL',
  PAID_FULL = 'PAID_FULL',
  CANCELLED = 'CANCELLED'
}

export const OrderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'PENDIENTE',
  [OrderStatus.VALIDATED]: 'VALIDADO',
  [OrderStatus.DISPATCHED]: 'DESPACHADO',
  [OrderStatus.PAID_PARTIAL]: 'PAGO PARCIAL',
  [OrderStatus.PAID_FULL]: 'PAGADO',
  [OrderStatus.CANCELLED]: 'CANCELADO'
};

export const OrderStatusColors: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'bg-amber-50 text-amber-600 border-amber-100',
  [OrderStatus.VALIDATED]: 'bg-blue-50 text-blue-600 border-blue-100',
  [OrderStatus.DISPATCHED]: 'bg-green-50 text-green-600 border-green-100',
  [OrderStatus.PAID_PARTIAL]: 'bg-teal-50 text-teal-600 border-teal-100',
  [OrderStatus.PAID_FULL]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  [OrderStatus.CANCELLED]: 'bg-red-50 text-red-600 border-red-100'
};

export interface BonusConfig {
  threshold: number;
  percentage: number;
}

export interface Product {
  id: string;
  name: string;
  brand: 'La Fornarina' | 'Villecco';
  category: string;
  barcode?: string;
  bonusEnabled: boolean;
  bonusThreshold?: number; 
  bonusPercentage?: number;
  prices: { [priceListId: string]: number };
}

export interface PriceList {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: string;
  priceListId: string;
  productId: string;
  price: number;
  effectiveDate: string;
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
  paidAmount: number;
  createdAt: string;
  signatureUrl?: string;
  pdfUrl?: string;
  replacedOrderId?: string;
  isCorrection?: boolean;
  deliveryDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  groupId: string;
  priceListId: string;
  balance: number;
  isBlocked: boolean;
  creditLimit?: number;
  address?: string;
  phone?: string;
  cuit?: string;
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
  status: 'PENDING' | 'VALIDATED' | 'CONVERTED';
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
  ivaBoletasAmount?: number;
  paymentMode: 'FIFO' | 'MANUAL';
  orderIds: string[];
  collectedBy: string;
  details?: { orderId: string, amountApplied: number, remainingBefore: number, remainingAfter: number }[];
  createdAt: string;
}

export interface CreditNoteItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreditNote {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  items: CreditNoteItem[];
  totalAmount: number;
  reason: string;
  createdAt: string;
}

export interface PriceUpdateJob {
  id: string;
  priceListId: string;
  category?: string;
  brand?: string;
  operation: 'PERCENTAGE' | 'FIXED';
  value: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  scheduledFor: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  initialCash: number;
  finalCashReported?: number;
  expectedCash?: number;
  totalCashPayments: number;
  totalTransferPayments: number;
  totalIvaBoletasPayments?: number;
  notes?: string;
}
