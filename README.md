
# ERP Chazarreta v1.0 🥖🍪

Sistema de gestión integral a medida para la **Fábrica Chazarreta**, optimizado para el manejo de las marcas *La Fornarina* y *Villecco*.

## 🚀 Módulos Implementados
- **Centro de Pedidos**: Control total de validación, carga manual de pedidos y gestión de catálogo.
- **Matriz de Precios Multi-Lista**: Precios diferenciados para Distribuidores, Supermercados y Sucursales.
- **Bonificaciones Inteligentes**: Reglas configurables de "Mercadería Sin Cargo" (ej: 10% extra a partir de 20 unidades).
- **Logística y Despacho**: Captura de firma digital en tablet/móvil y confirmación de carga física.
- **Tesorería y Cobranzas**: Gestión de cuentas corrientes, bloqueo de clientes y modos de pago (FIFO/Manual).
- **Auditoría**: Registro detallado de cada cambio crítico en el sistema.

## 🔄 Guía de Sincronización (Cómo actualizar)
Cada vez que el Ingeniero IA realice cambios en el código, seguí estos pasos para mantener tu GitHub al día:

1. **Recibir Cambios**: Copiá el contenido de los archivos modificados desde el chat.
2. **Actualizar Local**: Pegá el código en tus archivos locales dentro de la carpeta del proyecto.
3. **Enviar a GitHub**:
   ```bash
   # 1. Preparar los archivos
   git add .
   
   # 2. Crear el punto de restauración
   git commit -m "Update: Descripción del cambio"
   
   # 3. Subir a la nube
   git push origin main
   ```

## 🛠️ Tecnologías
- **Frontend**: React, Tailwind CSS, Lucide React.
- **Backend/DB**: Supabase (PostgreSQL).
- **Deployment**: Vercel.

---
Desarrollado para Fábrica Chazarreta.
