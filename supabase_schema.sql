
-- ERP CHAZARRETA v1.0 - Database Schema

-- 1. Tablas Maestras
CREATE TABLE price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand TEXT CHECK (brand IN ('La Fornarina', 'Villecco')),
    category TEXT,
    bonus_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,
    price DECIMAL(12,2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, price_list_id)
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price_list_id UUID REFERENCES price_lists(id),
    balance DECIMAL(12,2) DEFAULT 0,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Movimientos y Comandas
CREATE TYPE order_status AS ENUM ('PENDING', 'VALIDATED', 'DISPATCHED', 'PAID_PARTIAL', 'PAID_FULL', 'CANCELLED');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    status order_status DEFAULT 'PENDING',
    total_amount DECIMAL(12,2) DEFAULT 0,
    signature_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dispatched_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    bonus_quantity INTEGER DEFAULT 0,
    unit_price DECIMAL(12,2) NOT NULL
);

-- 3. Cuentas Corrientes (CC)
CREATE TABLE account_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    order_id UUID REFERENCES orders(id),
    type TEXT CHECK (type IN ('DEBIT', 'CREDIT')),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Auditoría
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id TEXT,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Portería (Cambios/Vencidos)
CREATE TABLE gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    product_name TEXT,
    quantity INTEGER,
    reason TEXT,
    status TEXT DEFAULT 'PENDING', -- PENDING, PROCESSED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Trigger para actualizar balance de CC automáticamente
CREATE OR REPLACE FUNCTION update_customer_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.type = 'DEBIT') THEN
            UPDATE customers SET balance = balance + NEW.amount WHERE id = NEW.customer_id;
        ELSE
            UPDATE customers SET balance = balance - NEW.amount WHERE id = NEW.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_balance
AFTER INSERT ON account_movements
FOR EACH ROW EXECUTE FUNCTION update_customer_balance();

-- 7. RLS (Seguridad de Fila) - Ejemplo básico
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON customers FOR SELECT USING (true);
