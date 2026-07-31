# ⚽ Fútbol Sin Nivel (FSN)

Sistema de gestión para el equipo **Fútbol Sin Nivel**. Control de partidos, asistencias, goles, pagos, fotos y más.

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Estilos:** Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deploy:** Vercel (con cron job mensual)

## Requisitos

- Node.js 20+
- Docker Desktop (para desarrollo local con Supabase)
- npm

## Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar Supabase local
supabase start

# 3. Copiar variables de entorno
# Tomar los valores que muestra "supabase start" y crear .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000
#   CRON_SECRET=<secreto aleatorio para proteger el cron>

# 4. Iniciar la app
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

> **Nota:** después de un `git pull`, aplicá las migraciones nuevas con `supabase db push` (o `supabase migration up` para local). En producción, ejecutá `supabase db push` o aplicá los archivos en el SQL Editor.

### Primer usuario

1. Registrarse en `/register`
2. Ir a Supabase Studio en [http://localhost:54323](http://localhost:54323)
3. SQL Editor → ejecutar:
   ```sql
   INSERT INTO profile_roles (profile_id, role_id)
   SELECT p.id, r.id FROM profiles p, roles r
   WHERE r.name = 'super_admin';
   ```

## Estructura

```
src/
├── app/           # Páginas (App Router)
│   ├── login/     # Inicio de sesión
│   ├── register/  # Registro
│   ├── dashboard/ # Resumen del equipo
│   ├── matches/   # Partidos y detalle
│   ├── players/   # Jugadores y stats
│   ├── payments/  # Pagos y comprobantes
│   ├── stats/     # Tabla de goleadores
│   ├── mvp/       # Votación MVP
│   ├── photos/    # Galería de fotos
│   └── admin/     # Panel de administración
├── components/    # Componentes compartidos
├── lib/           # Utilidades y clientes Supabase
└── types/         # Tipos TypeScript
```

## Features

- Partidos semanales automáticos (cada lunes)
- Asistencias: confirmar / declinar / no-show
- Carga de goles con asistencias
- Pago de cancha con comprobante y aprobación
- Multas por no-show sin aviso
- Votación MVP por partido
- Estadísticas: goleadores, asistencias, presencias
- Galería de fotos por partido
- Roles: super_admin, admin, jugador
- Costo fijo: Gs. 180.000/hora (configurable)

## Deploy

Conectar repo a [Vercel](https://vercel.com). Las variables de entorno de Supabase (las de producción, no las locales) se configuran en Vercel. El cron job del primer día de cada mes se activa automáticamente via `vercel.json` y envía el header `Authorization: Bearer <CRON_SECRET>` (configurá `CRON_SECRET` como variable de entorno en Vercel).
