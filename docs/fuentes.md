# Fuentes, catálogo y conectores

## Estado presente

La única ingestión operativa es el alta manual y la importación CSV/JSON realizada por una persona administradora. El catálogo describe posibilidades técnicas y limita las futuras integraciones; no ejecuta solicitudes HTTP, scraping, sincronizaciones, chequeos de salud de terceros ni importaciones automáticas. Todo portal y ATS externo aparece como `not_connected`; `syncEnabled` es siempre `false`, `lastRunAt`, `lastVerifiedAt`, `nextCursor` y `lastSuccessfulSync` se informan vacíos salvo que exista evidencia persistida real. La etiqueta `available` se reserva para la carga manual y para el catálogo territorial local.

Los datos de referencia se muestran en una categoría separada, no se convierten en empleos, coincidencias ni resultados postulables. La fecha de publicación, fecha de cierre, fecha observada/importada y verificación manual son propiedades distintas. Importar una fila tampoco demuestra que la vacante siga vigente.

## Catálogo de portales y páginas corporativas

Todos están registrados pero desconectados:

| ID | Fuente | Estado/cautela descrita |
| --- | --- | --- |
| `bne` | Bolsa Nacional de Empleo | Fichas públicas con campos heterogéneos; la API para empresas no acredita lectura pública masiva. |
| `trabajando_cl` | Trabajando.cl y subportales corporativos | La referencia revisada cubre búsquedas acotadas; no acredita cobertura integral ni campos universales. |
| `chiletrabajos` | ChileTrabajos | Título/URL son las señales de referencia; validar la ficha antes de declarar otros campos. |
| `laborum_cl` | Laborum Chile | No se confirmó API oficial gratuita de lectura; los campos de ficha deben comprobarse por muestra y términos. |
| `computrabajo_cl` | Computrabajo Chile | Puede haber renta textual, ubicación y fecha, sin garantía de datos estructurados completos. |
| `empleos_publicos` | Empleos Públicos / Servicio Civil | Convocatorias con campos administrativos; no se documentó una API gratuita general de lectura. |
| `getonbrd_cl` | Get on Board (Chile) | API pública documentada en la fuente; se excluyen empleos remotos internacionales o sin sede chilena verificable. Sigue sin conector activo. |
| `corporate` | Páginas corporativas sin ATS identificado | Registro prospectivo, no es un feed único; identificar empresa, dominio y evidencia de sede chilena antes de evaluar un adaptador. |

## Catálogo ATS

Los proveedores individuales permanecen `not_connected`, incluidos aquellos con una API pública de publicaciones. La disponibilidad pública descrita por la ficha no significa que la aplicación los consulte ni que exista cobertura de todos sus campos.

| ID | Proveedor | Nota de alcance |
| --- | --- | --- |
| `greenhouse` | Greenhouse Job Board API | Publicaciones/IDs/ubicaciones y contenido; sueldo y modalidad no son universales. |
| `lever` | Lever Postings API | Localización y modalidad cuando existan; el sueldo conserva moneda, período y base. |
| `ashby` | Ashby Public Job Posting API | Incluir solo ofertas públicamente listadas; remuneración es opcional. |
| `smartrecruiters` | SmartRecruiters Posting API | Filtrar Chile/ubicación presencial solo si los campos están disponibles en el registro real. |
| `workable` | Workable public jobs | Contrastar país y tipo de lugar antes de aceptar una oferta. |
| `recruitee` | Recruitee, condicionado | Revisar autorización/documentación futura; el catálogo no supone que el acceso anónimo se mantenga. |
| `other_ats` | Workday y ATS similares | Exploración caso a caso; no se afirma que exista API pública universal. |

### Registro empresa → board

Administración permite registrar/editar empresa, proveedor, ID del board, país `CL`, resumen de sede física chilena y evidencia textual. La combinación proveedor+board se deduplica. Solo se puede marcar verificada una sede si se declara una ubicación y evidencia no vacía; eso valida la presencia de evidencia para revisión, no certifica automáticamente la vacante. Cada registro mantiene `connectionStatus: not_connected`; editar/activar una fila no habilita conexión ni consulta. El acceso a listar y guardar boards está protegido por `adminProcedure` y se audita sin copiar credenciales.

## Fuentes de referencia — no son avisos de empleo

| ID | Fuente | Uso limitado |
| --- | --- | --- |
| `dpa` | DPA de Chile | Referencia del catálogo territorial local de región/comuna; la API no se consulta en esta fase. |
| `sence_sabe_ciuo` | SENCE / SABE / CIUO-08.CL | Datos agregados, requisitos, habilidades, educación y clasificación ocupacional; no entrega un feed confirmado de vacantes individuales. |
| `datos_abiertos_ckan` | Datos Abiertos Chile (CKAN) | Catálogo de conjuntos; no se verificó un dataset completo de vacantes nacionales vigentes. |
| `chilecompra` | ChileCompra / Mercado Público | Señales de compras públicas que requieren ticket y nunca son una vacante postulable. |
| `omil_municipios` | OMIL, municipios y servicios regionales | Fuentes descentralizadas sin API nacional o estándar único confirmado. |
| `inversion_politicas_empleo` | Inversión y políticas de empleo | Contexto público, noticias y programas; no representa contratación de personas. |

## Contrato futuro de adaptadores

El tipo `SourceAdapterContract<Raw, Normalized>` en `shared/domain.ts` declara el contrato; no contiene conectores implementados:

```ts
{
  sourceId: string;
  fetch(cursor?, filters?): Promise<{ records: Raw[]; nextCursor?: string | null }>;
  normalize(raw): Normalized;
  validate(record): { valid: boolean; errors: string[] };
  healthCheck(): Promise<{ connected: boolean; checkedAt: string; message: string }>;
  rateLimitPolicy: { requestsPerMinute: number; backoffMs: number };
  lastRunAt: string | null;
  nextCursor: string | null;
  provenance: string;
}
```

Antes de habilitar cualquier adaptador futuro se requieren autorización y términos de la fuente, credenciales/documentación cuando correspondan, límites y reintentos acordados, filtrado de país `CL`, procedencia y fechas reales, estados que distingan fallo de consulta de “sin resultados” y deduplicación por URL/ID externo/huella conservadora preservando la ocurrencia de cada fuente. Esta documentación no autoriza ni inicia esa integración.