# Importación de ofertas

La importación está en **Administración → Ofertas**. CSV, TSV o JSON se leen en el navegador, se sugieren asignaciones de encabezados y se permite editarlas antes de solicitar la previsualización administrativa. El archivo no se envía a parsers, analítica ni servicios externos. La persona administradora revisa validaciones, conflictos, duplicados y errores por fila antes de confirmar el lote.

Se admite un arreglo JSON de ofertas o `{ "jobs": [...] }`; los límites son 2.000 filas por lote, 100 KB serializados por fila y 5 MB por archivo en la interfaz. Una plantilla sin ofertas, con encabezados solamente, está en [`../client/public/plantilla-empleos.csv`](../client/public/plantilla-empleos.csv).

## Campos y reglas de interpretación

| Campo o grupo | Tratamiento |
| --- | --- |
| `title` | Obligatorio; máximo 255 caracteres. No se inventa un cargo si falta. |
| `countryCode`, `regionCode`, `regionName`, `communeCode`, `communeName` | Solo país `CL`. Si se omite país, debe existir una región/comuna reconocida que permita inferir Chile; no se presupone el país. La comuna informada debe corresponder a la región. |
| `cityRaw`, `locationRaw`, `officeLocation`, `locality`, `addressApprox`, `geoConfidence`, `geoEvidence` | Conservan ubicación original y/o dato normalizado por separado. No se inventa comuna ni dirección. La confianza/evidencia no sustituye validación territorial. |
| `title`, `originalTitle`, `normalizedTitle`, `companyName`, `companySector`, `companyBoardId` | Se conserva el nombre/título original y la identidad técnica cuando viene en la fila. Un ID de board no activa un conector. |
| `sourceCodes`, `sourceExternalIds`, `canonicalUrl`, `allSourceUrls`, `sourceObservedAt`, `recordUpdatedAt`, `lastVerifiedAt`, `provenance`, `sourceEvidence` | Guardan procedencia, IDs, enlaces, fechas y evidencia. La fecha de consulta/observación no se confunde con publicación/cierre. Una URL debe ser HTTP(S) sin credenciales. Las múltiples fuentes generan ocurrencias separadas. |
| `modality`, `workplaceType`, `workplaceEvidence` | Normaliza presencial/híbrido/remoto solo cuando el valor es claro. Desconocido permanece desconocido; no se infiere que un empleo sea presencial por la ubicación de oficina. |
| `category`, `subcategory`, `sector`, `inferredSector`, `department`, `team`, `occupationCodeCiuo`, `seniority`, `inferredSeniority`, `jobType`, `employmentType`, `contractType`, `schedule`, `scheduleType`, `shift`, `hoursPerWeek`, `vacancyCount`, `practiceType` | Atributos opcionales independientes. Lo inferido permanece identificado como tal y no reemplaza un valor explícito. Se preserva el código ocupacional fuente sin inventar equivalencias. |
| `experienceMinYears`, `experienceRaw`, `educationLevel`, `degreeNames` | Mantienen requisito numérico solo cuando hay años explícitos y el texto original por separado. Formación/nombres de título no se deducen cuando faltan. |
| `skills`, `skillsExplicit`, `normalizedSkills`, `licenses`, `languages`, `responsibilities`, `requirements`, `mandatoryRequirements`, `benefits` | Listas aceptan JSON o valores separados por punto y coma, barra vertical o nueva línea. Los requisitos excluyentes explícitos permanecen separados; una ausencia de texto no se transforma en requisito. |
| `salaryMinCLP`, `salaryMaxCLP` | Solo montos numéricos mensuales en CLP, con mínimo ≤ máximo. Esta regla de filtro no convierte monedas ni periodicidades. |
| `salaryMinSource`, `salaryMaxSource`, `salaryRaw`, `salaryCurrency`, `salaryPeriod`, `salaryBasis`, `salaryVisibility`, `salaryComponents`, `salaryEvidence`, `salaryIsDisclosed` | Mantienen la remuneración original y componentes sin conversión. `gross`/bruto y `net`/líquido no se convierten; cifras en otra moneda/periodicidad no alimentan los rangos CLP mensuales. `reserved` nunca pasa a cero; `not_disclosed` tampoco se vuelve un salario numérico. El rango de filtro sigue siendo solo CLP mensual conocido. |
| `description`, `descriptionHtmlSanitized`, `applicationUrl`, `applicationMethod`, `requiredDocuments`, `recruitmentStages` | El detalle se conserva como texto; el HTML pasa por sanitización de servidor antes de guardarse/mostrarse. Enlaces de postulación se mantienen separados de la URL canónica de la oferta. |
| `publishedAt`, `expiresAt`, `sourceStatus`, `verificationStatus`, `availabilityConfidence`, `dataCompleteness` | El estado interno/fecha de verificación no se reemplaza por fecha de importación. La carga de una oferta no certifica vigencia. Porcentajes deben estar en 0–100. |

El mapeador compara nombres de columna sin depender de mayúsculas o tildes, ofrece campos principales y grupos plegables de identidad/procedencia, territorio/modalidad, cargo/condiciones, experiencia/formación, sueldo/evidencia, descripción/postulación y ciclo de vida. El operador confirma o corrige cada asignación; los JSON de evidencia/componentes deben ser objetos/listas JSON válidos.

La evidencia por campo tiene nivel `explicit`, `parsed`, `inferred` o `unknown`. Ejemplo de `sourceEvidence`:

```json
{
  "officeLocation": {
    "level": "explicit",
    "raw": "Santiago, Chile",
    "sourceCode": "greenhouse",
    "observedAt": "2026-10-23T19:00:00-03:00"
  }
}
```

Al guardar una fila sin evidencia custom, el backend registra campos fuente como explícitos, marca los campos inferidos (`inferredSector`, `inferredSeniority`, `normalizedSkills`, `availabilityConfidence`, `dataCompleteness`) como `inferred`, guarda el valor original acotado y asocia el código de fuente/fecha observada. No se clasifica HTML recibido como confiable: `descriptionHtmlSanitized` se vuelve a sanear en servidor.

## Previsualización, deduplicación y persistencia

El servidor rechaza filas sin título, fuera de Chile, URLs inválidas, enums o números fuera de rango, estructuras JSON incorrectas y conjuntos que no sean avisos laborales válidos. Cada fila reporta fila/error con un mensaje; la confirmación recalcula su validación y continúa siendo idempotente por identidad existente. La deduplicación conserva ID estable, favoritos y anotaciones; los campos ausentes en una carga parcial no borran valores anteriores. Cada nueva coincidencia agrega `job_source_occurrences` con ID/URL/fecha/huella/evidencia y el raw original, mientras el Job conserva los campos canónicos consolidados. La escritura de cada fila —Job, habilidades, ocurrencia, auditoría y resultado de fila— se ejecuta en una transacción; el lote puede terminar con filas válidas, duplicadas y errores, manteniendo el historial y el detalle de errores.

Los binarios de CV no usan este importador ni se almacenan en GitHub. El CSV/JSON no se envía a un tercero.