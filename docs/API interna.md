# API interna

La API de negocio usa **tRPC 11** en `/api/trpc`; el router TypeScript exportado como `AppRouter` en `server/routers.ts`, junto con los esquemas Zod allí declarados, es la fuente tipada de verdad. No se publica un OpenAPI REST independiente. Las llamadas tRPC viajan mediante el cliente de lote HTTP del frontend. Todas las consultas de negocio requieren una sesión salvo `auth.me`; las mutaciones verifican el encabezado same-origin `X-Empleos-Request: 1` y rechazan `Sec-Fetch-Site: cross-site`.

## Sesión y salud

- `GET /api/health` y `GET /health`: comprueban conexión y `SELECT 1`; responden 200 con estado `ok` o 503 con estado de base `unavailable`.
- `/api/oauth/callback` (GET): callback del OAuth de Manus. El inicio de login lo orquesta el cliente con el flujo OAuth de la plataforma; no existe una contraseña ni un endpoint de registro público local.
- `auth.me` (query): devuelve la sesión actual o `null`.
- `auth.logout` (mutation): elimina la cookie de sesión.
- `GET /api/platform/config.js`: whitelist dinámica de configuración pública; no contiene claves de servidor.

## Procedimientos tRPC

| Router.procedure                                                                                                       | Autorización       | Función                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `jobs.list`, `jobs.facets`, `jobs.detail`                                                                              | Sesión             | Búsqueda, facetas y ficha de oferta chilena. `jobs.list` acepta filtros, orden y paginación; incluye datos guardados del usuario actual. |
| `jobs.create`, `jobs.update`, `jobs.archive`                                                                           | Administrador      | Alta/edición administrativa y archivo de oferta.                                                                                         |
| `saved.list`, `saved.toggle`, `saved.note`, `saved.update`                                                             | Sesión             | Favoritos, notas privadas, etiquetas y descarte reversible.                                                                              |
| `searches.list`, `searches.create`, `searches.update`, `searches.execute`, `searches.delete`                           | Sesión             | Búsquedas persistentes con filtros y orden exactos por propietario.                                                                      |
| `candidates.list`, `candidates.detail`, `candidates.create`, `candidates.update`, `candidates.delete`                  | Sesión + propiedad | CRUD de perfiles; consentimiento explícito al crear, aislamiento por usuario y confirmación opcional de listas completas de formación/licencias. |
| `candidates.uploadCv`, `candidates.correctCvText`, `candidates.deleteCv`                                               | Sesión + propiedad | Procesamiento PDF/DOCX temporal, revisión/corrección manual y borrado de versión.                                                        |
| `candidates.matches`                                                                                                   | Sesión + propiedad | Coincidencias explicables de un perfil y filtros adicionales; la salida distingue `eligible`, `not_eligible` e `insufficient`.           |
| `administration.jobs`, `administration.restoreJob`, `administration.exportJobs`                                        | Administrador      | Consulta, recuperación y exportación de ofertas, incluidos estados administrativos.                                                      |
| `administration.importPreview`, `administration.importCommit`, `administration.imports`, `administration.importErrors` | Administrador      | Prevalidación, confirmación e historial por lote/filas.                                                                                  |
| `administration.sources`, `administration.sourceStatus`                                                                | Administrador      | Catálogo/estado almacenado; no inicia sincronización externa.                                                                            |
| `administration.atsBoards`                                                                                              | Administrador      | Lista hasta 500 boards de empresa registrados, con verificación y conexión separados.                                                   |
| `administration.saveAtsBoard`                                                                                           | Administrador      | Crea o edita empresa, proveedor ATS, board, país CL y evidencia de sede; permite activar/desactivar el registro local con `active`, pero `connectionStatus` permanece siempre `not_connected`. |
| `administration.weights`, `administration.updateWeights`                                                               | Administrador      | Pesos configurables del motor; deben sumar 100.                                                                                          |

La previsualización/confirmación de importación valida las filas en backend. Cada fila confirmada agrupa Job, skills, ocurrencia, auditoría y resultado en una transacción; un lote puede conservar sus filas válidas y registrar errores de otras filas. `atsBoards` y `saveAtsBoard` no realizan llamadas a proveedores.

Las longitudes, enums, límites de registros, valores de país y formatos se validan en Zod antes de entrar al servicio de persistencia. Consultar `shared/domain.ts` para los contratos TypeScript de filtros, ofertas, perfiles, resultado de búsqueda, explicación del score y adaptadores. `isEligible` es verdadero solo cuando los datos son suficientes y no hay un requisito excluyente incumplido; una ausencia no confirmada produce `eligibilityStatus: insufficient` y no se cuenta en el modo estricto.

## Política de datos

La autorización administrativa se valida en servidor, no solo ocultando botones. Perfiles, CV, notas, guardados, búsquedas e importaciones de personas se filtran por el usuario dueño. Ofertas pueden consultarse por cuentas autorizadas del proyecto; edición e importación requieren rol administrador. Los eventos de auditoría guardan acción/tipo/ID, no contenido de CV o notas.
