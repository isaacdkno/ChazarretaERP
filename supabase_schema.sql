
-- ERP CHAZARRETA v1.1 - Esquema PostgreSQL Completo
-- Copiar y ejecutar en Supabase SQL Editor (Borrará datos previos)

-- ==========================================
-- 1. LIMPIEZA DE ESTRUCTURA PREVIA
-- ==========================================
DROP TABLE IF EXISTS credit_note_items CASCADE;
DROP TABLE IF EXISTS credit_notes CASCADE;
DROP TABLE IF EXISTS payment_receipts CASCADE;
DROP TABLE IF EXISTS cash_sessions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS price_update_jobs CASCADE;
DROP TABLE IF EXISTS archived_price_lists CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS gate_entries CASCADE;

-- ==========================================
-- 2. DEFINICIÓN DE TABLAS
-- ==========================================

-- ==========================================
-- MIGRACIÓN NO DESTRUCTIVA (Ejecutar solo esto si ya tenés datos en producción):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS cuit TEXT;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
-- ==========================================

-- Usuarios del sistema
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    password_hash TEXT,
    customer_id TEXT,
    address TEXT,
    phone TEXT,
    cuit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listas de Precios
CREATE TABLE price_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Productos
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    barcode TEXT,
    bonus_enabled BOOLEAN DEFAULT TRUE,
    bonus_threshold INTEGER DEFAULT 20,
    bonus_percentage INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Precios por Producto y Lista
CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    UNIQUE(product_id, price_list_id)
);

-- Historial de Precios
CREATE TABLE price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trabajos de actualización de precios programados
CREATE TABLE price_update_jobs (
    id TEXT PRIMARY KEY,
    price_list_id TEXT REFERENCES price_lists(id) ON DELETE CASCADE,
    category TEXT,
    brand TEXT,
    operation TEXT NOT NULL, -- 'PERCENTAGE' | 'FIXED'
    value DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'COMPLETED' | 'CANCELLED'
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Historial de Listas de Precios (Copias de Seguridad)
CREATE TABLE archived_price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_list_id TEXT REFERENCES price_lists(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    prices_snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clientes
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_list_id TEXT REFERENCES price_lists(id),
    balance DECIMAL(12,2) DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    credit_limit DECIMAL(12,2) DEFAULT NULL,
    address TEXT,
    phone TEXT,
    cuit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comandas / Pedidos
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    status TEXT DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) DEFAULT 0,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    signature_url TEXT,
    delivery_date TIMESTAMP WITH TIME ZONE,
    is_correction BOOLEAN DEFAULT FALSE,
    replaced_order_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items de Comanda
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    bonus_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL
);

-- Notas de Crédito
CREATE TABLE credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    total_amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items de Nota de Crédito
CREATE TABLE credit_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID REFERENCES credit_notes(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL
);

-- Comprobantes de Pago / Recibos
CREATE TABLE payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    amount DECIMAL(12,2) NOT NULL,
    cash_amount DECIMAL(12,2) DEFAULT 0,
    transfer_amount DECIMAL(12,2) DEFAULT 0,
    iva_boletas_amount DECIMAL(12,2) DEFAULT 0,
    payment_mode TEXT, -- 'FIFO' | 'MANUAL'
    order_ids JSONB, -- Array de IDs de comandas afectadas
    collected_by TEXT,
    details JSONB, -- Detalle de imputación por comanda
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingresos de Portería
CREATE TABLE gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT,
    status TEXT DEFAULT 'PENDING', -- 'PENDING' | 'VALIDATED' | 'CONVERTED'
    items JSONB, -- Detalle de productos ingresados
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logs de Auditoría
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id TEXT,
    action TEXT,
    target_id TEXT,
    old_value TEXT,
    new_value TEXT
);

-- Sesiones de Caja
CREATE TABLE cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    opened_by TEXT NOT NULL,
    closed_by TEXT,
    initial_cash DECIMAL(12,2) DEFAULT 0,
    final_cash_reported DECIMAL(12,2),
    expected_cash DECIMAL(12,2),
    total_cash_payments DECIMAL(12,2) DEFAULT 0,
    total_transfer_payments DECIMAL(12,2) DEFAULT 0,
    total_iva_boletas_payments DECIMAL(12,2) DEFAULT 0,
    notes TEXT
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
