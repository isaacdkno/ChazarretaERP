
export const MOCK_PRICE_LISTS: any[] = [
  { id: 'l1', name: 'Distribuidores', description: 'Precio para canales de distribución externos' },
  { id: 'l2', name: 'Supermercados', description: 'Grandes superficies y cadenas' },
  { id: 'l3', name: 'Sucursales', description: 'Venta directa en locales propios' },
];

export const MOCK_PRODUCTS: any[] = [
  { 
    id: 'p1', 
    name: 'Pan de Molde Blanco', 
    brand: 'La Fornarina', 
    category: 'Panificados', 
    bonusEnabled: true, 
    prices: { l1: 1080, l2: 1150, l3: 1200 } 
  },
  { 
    id: 'p2', 
    name: 'Pan de Molde Salvado', 
    brand: 'La Fornarina', 
    category: 'Panificados', 
    bonusEnabled: true, 
    prices: { l1: 1215, l2: 1280, l3: 1350 } 
  },
  { 
    id: 'p3', 
    name: 'Grisines Tradicionales', 
    brand: 'Villecco', 
    category: 'Snacks', 
    bonusEnabled: false, 
    prices: { l1: 765, l2: 810, l3: 850 } 
  },
  { 
    id: 'p4', 
    name: 'Pepas de Membrillo', 
    brand: 'Villecco', 
    category: 'Dulces', 
    bonusEnabled: true, 
    prices: { l1: 990, l2: 1050, l3: 1100 } 
  },
];

export const MOCK_CUSTOMERS: any[] = [
  { id: 'c1', name: 'Distribuidora Norte', groupId: 'g1', priceListId: 'l1', balance: 45000, isBlocked: false },
  { id: 'c2', name: 'Sucursal Centro', groupId: 'g2', priceListId: 'l3', balance: 0, isBlocked: false },
  { id: 'c3', name: 'Coto / Carrefour', groupId: 'g3', priceListId: 'l2', balance: 120000, isBlocked: false },
];
