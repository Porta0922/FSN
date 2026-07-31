# ⚽ Fútbol Sin Nivel (FSN)

Sistema de gestión para el equipo **Fútbol Sin Nivel**. Control de partidos, encuentros 7v7, asistencias, goles, pagos, fotos, votación MVP y más.

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Estilos:** Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Deploy:** Vercel (con cron job mensual de generación de partidos)

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
# Generá CRON_SECRET con: openssl rand -hex 32

# 4. Iniciar la app
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

> **Importante:** después de un `git pull`, aplicá las migraciones nuevas con `supabase db push` (o `supabase migration up` para local). En producción, ejecutá `supabase db push` o aplicá los archivos en el SQL Editor de Supabase.

### Primer usuario

1. Registrarse en `/register`
2. Ir a Supabase Studio en [http://localhost:54323](http://localhost:54323)
3. SQL Editor → ejecutar:
   ```sql
   INSERT INTO profile_roles (profile_id, role_id)
   SELECT p.id, r.id FROM profiles p, roles r
   WHERE r.name = 'super_admin';
   ```

## Migraciones

```
supabase/migrations/
├── 00001_initial_schema.sql   # Tablas base, roles, RLS, is_admin/is_super_admin
├── 00002_fixes.sql            # Correcciones de políticas y schema
├── 00003_monthly_stats_mvp_photos.sql  # Stats mensuales, MVP doble (2 votos, solo presentes), fotos (máx 3), bucket avatars, puntos MVP configurables
├── 00004_mvp_deadline_score.sql        # Cierre automático de votación MVP (plazo en horas), marcador home/away en matches
└── 00005_encuentros.sql       # Encuentros 7v7 dentro de un partido (equipos y goles por jugador), stats suman goles de encuentros
```

## Estructura

```
src/
├── app/
│   ├── login/             # Inicio de sesión + "olvidé mi contraseña"
│   ├── register/          # Registro
│   ├── reset-password/    # Nueva contraseña (link del email de recuperación)
│   ├── auth/confirm/      # Confirmación de email
│   ├── dashboard/         # Resumen del equipo, acciones rápidas, "Mi perfil", tabla MVP
│   ├── matches/           # Lista de partidos
│   ├── matches/new/       # Alta manual de partido
│   ├── matches/[id]/      # Detalle: asistencias, encuentros 7v7, goles, pagos, MVP, multas, gastos
│   ├── players/           # Jugadores del equipo
│   ├── players/[id]/      # Perfil editable (foto, apodo, posición) + historial de asistencia y deudas
│   ├── payments/          # Pagos y comprobantes
│   ├── stats/             # Tabla de goleadores mensual con exportación CSV
│   ├── mvp/               # Votación MVP (2 votos, solo presentes, cierre automático)
│   ├── photos/            # Galería de fotos (todos suben, máx 3 por partido)
│   ├── admin/             # Panel: generar partidos por mes, config de equipo, roles
│   └── api/cron/generate-matches/  # Cron mensual de generación de partidos
├── components/            # Componentes compartidos
├── lib/                   # Utilidades, constantes y clientes Supabase (client/server/admin)
└── types/                 # Tipos TypeScript
```

## Features

- **Partidos automáticos por mes** — el admin elige mes/año y se generan según el día de la semana configurado (cron el 1º de cada mes)
- **Encuentros 7v7** — dentro de cada partido se cargan los mini partidos de 10 min: equipos A/B, goles por jugador. El resultado general del partido se calcula **por encuentros ganados**
- **Asistencias** — confirmar / declinar / no-show (genera multa automática)
- **Historial de asistencia por jugador** — cumplimiento, racha actual y partidos en deuda
- **Goles** — carga por partido y por encuentro (afecta la tabla de goleadores)
- **Pagos** — cuota por partido con comprobante y aprobación del admin
- **Multas** — por no-show sin aviso, con seguimiento de pago
- **Votación MVP** — 2 MVPs por partido, solo presentes votan a presentes, sin auto-voto, con **cierre automático** configurable en horas y tabla general anual con puntos
- **Recuperación de contraseña** — flujo completo con email de Supabase
- **Perfil editable** — foto de perfil, apodo, teléfono, posición
- **Galería de fotos** — todos suben (máx. 3 por partido por jugador), solo el dueño borra
- **Roles** — super_admin, admin, jugador
- **Configuración del equipo** — día de partido, hora, costo, ubicación, duración, % de multa, puntos MVP y plazo de votación (todo desde el panel admin)

## Deploy

1. Conectar el repo a [Vercel](https://vercel.com).
2. Configurar en Vercel → Settings → Environment Variables las variables de **producción** de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `CRON_SECRET` (mismo valor que en `.env.local`)
3. El cron del primer día de cada mes se configura en `vercel.json`. **No incluye headers**: Vercel envía automáticamente `Authorization: Bearer $CRON_SECRET` y la ruta `/api/cron/generate-matches` valida ese header (o un usuario admin autenticado).
4. En Supabase, habilitar el template de email **"Reset password"** apuntando a `NEXT_PUBLIC_SITE_URL/reset-password`.

## Verificación

```bash
npm run lint
npx tsc --noEmit
npm run build
```
