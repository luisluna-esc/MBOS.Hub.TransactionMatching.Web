# TransactionMatching (frontend)

Angular 20 + Tailwind 4. Sale de la base común de ClockMetrics/FundTrack: login con refresh token,
layout con menú por rol, administración (usuarios, roles, auditoría), tema claro/oscuro, i18n
(es/en/pt), atajos de teclado y los componentes de `shared/`. El backend está en
`MBOS.Hub.TransactionMatching`.

**Qué hace:** coteja el extracto del banco (BMSC) con el Mayor de ASSINET de la misma cuenta y
arma la conciliación (hojas INGRESO y EGRESO, con lo que falta registrar en ASSINET o en el banco),
igual que el Excel de control que se hacía a mano.

```bash
npm install
npm start          # http://localhost:4200, apunta al backend en http://localhost:5162/api
npm run build      # producción: /api lo resuelve nginx (nginx.conf)
```

## Dónde va cada cosa

| Carpeta | Qué tiene |
|---|---|
| `src/app/core` | Sesión, interceptor, `ApiService`, menú, tema, i18n, toasts, diálogos, atajos |
| `src/app/shared` | Componentes (tabla, filtros, inputs, diálogos, gráficas...), `ListPage` y `FormDialog` |
| `src/app/layout/shell` | Barra lateral y encabezado |
| `src/app/features` | Pantallas: `reconciliation` (nueva, historial, revisión, cuentas), `auth`, `admin`, `placeholder`, `style-guide` |
| `src/styles/theme.scss` | Único lugar de los colores (tokens) |
| `public/i18n` | Textos en es, en y pt |

## Agregar una pantalla de lista

El modelo es `features/admin/roles`: una lista que extiende `ListPage<T>` (usa la plantilla
`shared/list-page/list-page.html`) y un diálogo que extiende `FormDialog`. Después:

1. La ruta en `app.routes.ts` (sale de `MENU_ROUTES`, que muestra la pantalla provisional).
2. El menú en el backend (`menu` y `menu_role`); el texto sale de `translation_key` (ej. `nav.xxx`).
3. Los textos en los tres archivos de `public/i18n`.

## Pantallas de la conciliación (`features/reconciliation`)

| Ruta | Qué hace |
|---|---|
| `/reconciliations/new` | Subir el extracto del banco y el Mayor de ASSINET; al terminar abre la revisión |
| `/reconciliations` | Historial: una fila por cuenta y mes con lo cotejado y lo que falta |
| `/reconciliations/:id` | Revisión: saldos, Ingresos/Egresos, filtros por estado, confirmar, deshacer, emparejar a mano, observaciones, cerrar y descargar el Excel |
| `/catalogs/bank-accounts` | Nombre de cada cuenta (se crean solas al subir el primer extracto) |

## Logos

`public/img/transaction-matching-{azul,blanco,negro}.png` (logo completo: azul en tema claro,
blanco en oscuro y en el login) y `transaction-matching-icono-*.png` (menú colapsado; también el
`favicon.ico`). El de MBOS (`MBOS-*.png`) queda en el login como logo de la institución.

## Pendiente

- Planillas: un débito del banco que en ASSINET está en varias líneas (la hoja "Reporte de Pagos"
  del extracto trae el detalle). Hoy se empareja a mano una por una.
