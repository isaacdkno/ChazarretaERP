
-- ERP CHAZARRETA v1.0 - Esquema PostgreSQL + Datos Maestros
-- Copiar y ejecutar en Supabase SQL Editor

-- ==========================================
-- 1. LIMPIEZA DE ESTRUCTURA PREVIA
-- ==========================================
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS account_movements CASCADE;
DROP TABLE IF EXISTS gate_entries CASCADE;

-- ==========================================
-- 2. DEFINICIÓN DE TABLAS
-- ==========================================
CREATE TABLE price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    bonus_enabled BOOLEAN DEFAULT TRUE,
    bonus_threshold INTEGER DEFAULT 20,
    bonus_percentage INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    UNIQUE(product_id, price_list_id)
);

CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_list_id TEXT REFERENCES price_lists(id),
    balance DECIMAL(12,2) DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    status TEXT DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) DEFAULT 0,
    signature_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    bonus_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL
);

CREATE TABLE gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    product_name TEXT,
    quantity INTEGER,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE account_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    type TEXT,
    amount DECIMAL(12,2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. CARGA DE DATOS MAESTROS (SEEDING)
-- ==========================================

-- Listas de Precios
INSERT INTO price_lists (id, name, description) VALUES
('l1', 'Distribuidores', 'Precio para canales de distribución externos'),
('l2', 'Supermercados', 'Grandes superficies y cadenas'),
('l3', 'Sucursales', 'Venta directa en locales propios');

-- Productos
INSERT INTO products (id, name, brand, category, bonus_enabled) VALUES
('p1', 'Pan de Molde Blanco', 'La Fornarina', 'Panificados', true),
('p2', 'Pan de Molde Salvado', 'La Fornarina', 'Panificados', true),
('p3', 'Grisines Tradicionales', 'Villecco', 'Snacks', false),
('p4', 'Pepas de Membrillo', 'Villecco', 'Dulces', true);

-- Precios por Producto y Lista
INSERT INTO product_prices (product_id, price_list_id, price) VALUES
('p1', 'l1', 1080), ('p1', 'l2', 1150), ('p1', 'l3', 1200),
('p2', 'l1', 1215), ('p2', 'l2', 1280), ('p2', 'l3', 1350),
('p3', 'l1', 765),  ('p3', 'l2', 810),  ('p3', 'l3', 850),
('p4', 'l1', 990),  ('p4', 'l2', 1050), ('p4', 'l3', 1100);

-- Clientes Iniciales
INSERT INTO customers (id, name, price_list_id, balance, is_blocked) VALUES
('c1', 'Distribuidora Norte', 'l1', 45000, false),
('c2', 'Sucursal Centro', 'l3', 0, false),
('c3', 'Coto / Carrefour', 'l2', 120000, false);
