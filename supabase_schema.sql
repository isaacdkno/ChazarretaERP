
-- ERP CHAZARRETA v1.0 - Esquema PostgreSQL Completo
-- Copiar y ejecutar en Supabase SQL Editor

-- 1. Limpiar estructura previa
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS account_movements CASCADE;
DROP TABLE IF EXISTS gate_entries CASCADE;

-- 2. Definición de Tablas Maestras
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

-- 3. Definición de Tablas Transaccionales
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT REFERENCES customers(id),
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

-- 4. Soporte Logístico y Financiero
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
    type TEXT, -- 'DEBIT' (deuda) o 'CREDIT' (pago)
    amount DECIMAL(12,2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
