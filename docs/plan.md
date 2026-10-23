# Plan incremental — Anexo técnico 02

## Alcance y decisiones

Extender la aplicación fullstack existente de Empleos Chile para que su modelo `Job`, las ocurrencias de fuente, el registro de portales/ATS, la relación empresa→board y el importador manual puedan representar el Anexo 02. La expansión será aditiva: conservará identificadores, datos, rutas y contratos ya implementados; los campos heterogéneos serán nulos/opcionales. No se harán llamadas a portales ni APIs, scraping, sincronizaciones, publicaciones de ofertas ni ejecuciones de adaptadores. Todas las fuentes externas y los board ATS nuevos permanecerán explícitamente `not_connected`; los datos complementarios se clasificarán como referencias y nunca como vacantes.

El importador seguirá procesando archivos localmente antes de enviarlos al backend administrativo. Permitirá mapear campos avanzados, normalizar solo cuando la interpretación sea inequívoca, conservar registros originales y evidencia por campo, marcar errores en la vista previa y mantener la deduplicación por URL/ID/huella con ocurrencias múltiples. La remuneración original, moneda, periodicidad, base, visibilidad y componentes se conservarán separadamente; solo cifras comprobadas como CLP mensuales podrán poblar los campos numéricos usados por el filtro mensual, y nunca se convertirán entre bruto y líquido.

El registro de empresa/ATS/board guardará país y evidencia de sede física chilena para una eventual integración; su estado no autorizará ni ejecutará conexiones. El motor determinista aprovechará únicamente experiencia, estudios, titulaciones, habilidades y requisitos estructurados que estén presentes, distinguibles como explícitos/inferidos y editables. El perfil podrá declarar si las listas de formación y de licencias/certificaciones fueron revisadas como completas: solo una ausencia confirmada podrá activar un bloqueo; lo desconocido se muestra como “revisión pendiente” y no como elegible ni como no elegible. Los faltantes producirán explicación de datos insuficientes, no inferencias ocultas ni una equivalencia profesional inventada. Se conservarán los pesos configurables actuales.

## Persistencia, API y componentes

La solución seguirá usando React/Vite en `client/`, tRPC/Express en `server/`, tipos y normalización en `shared/`, MySQL/Drizzle en `drizzle/` y pruebas en los directorios existentes. Se añadirán columnas/tablas, índices y migración Drizzle aditiva; se revisará el SQL generado antes de aplicarlo porque Preview y cualquier instancia publicada comparten la misma base. No se ejecutarán borrados ni reinicializaciones.

`server/employment-db.ts` normalizará el catálogo y los metadatos de procedencia; `server/routers.ts` mantendrá operaciones de escritura protegidas por `adminProcedure`; `shared/domain.ts` formalizará los tipos y contratos. `client/src/lib/importData.ts` y `OfferAdminPage.tsx` ofrecerán mapeo agrupado de campos originales y canónicos, y la vista previa será invalidada cuando cambie el mapeo. `SourcesPage.tsx` distinguirá portales de empleo, ATS, carga manual y datos de referencia, expondrá capacidades declaradas sin presentarlas como conectadas e incorporará la administración explícita de boards empresariales. Las fichas mostrarán solo los campos opcionales realmente observados.

## Estructura y diseño

Se reutilizarán los módulos existentes: `client/src/pages` para portal, ofertas, fuentes y administración; `client/src/lib` para lectura/mapeo de archivos; `server/` para reglas, acceso a DB y rutas protegidas; `shared/` para contratos, filtros, normalización y scoring; `drizzle/` para schema/migraciones; `docs/` para diccionario, catálogo y plantilla. No se migrará al monorepo hipotético `/apps`; el stack actual es funcional y preservarlo evita duplicar lógica o perder la integración Preview.

La UI seguirá la dirección ya aprobada: portal editorial maduro, sobrio y profesional en español, fondos marfil/gris claro, superficies blancas, azul petróleo/índigo y acento turquesa discreto, tipografía sans legible, bordes neutros y controles accesibles. En administración, las fuentes desconectadas y los datos no disponibles se expresarán sin métricas ficticias ni lenguaje de promesa; las tablas y formularios extensos se agruparán por identidad, ubicación, condiciones, remuneración, requisitos, postulación y evidencia.

## Dependencias y límites

No se incorporarán APIs, credenciales, servicios de pago ni IA externa. Se añade `sanitize-html` con versión fija y lockfile para sanear HTML no confiable en servidor; no se envía contenido a un tercero. Se respetarán OAuth, autorización backend, privacidad de CV, geografía CL y la configuración actual del proyecto. Los cambios permanecerán en Sandbox Preview; no se conectará el remoto del usuario, no se hará push/checkpoint y no se publicará. Los comandos del proyecto seguirán siendo `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` y la migración Drizzle aditiva correspondiente.
