# Privacidad y manejo de datos

Empleos Chile es una herramienta privada, no una vitrina pública ni un servicio de postulación. Antes de iniciar sesión con el primer usuario, configura **Owner** como acceso al proyecto desde su control de acceso, o establece `OWNER_OPEN_ID` con el identificador OAuth del propietario. La primera cuenta que inicia sesión recibe rol administrador si no hay usuarios y no existe un identificador `OWNER_OPEN_ID`. Si el proyecto se expone públicamente antes de ese paso, esa cuenta inicial podría obtener privilegios administrativos. La meta `noindex` es una medida complementaria, no un límite de autorización.

## Alcance de acceso

- El inicio de sesión usa el OAuth de Manus y una cookie HTTP-only, `Secure` y `SameSite=None` para el Preview HTTPS embebido.
- El backend exige sesión para la aplicación; realiza las comprobaciones de rol/propiedad en cada procedimiento y valida el origen de las mutaciones.
- Cada usuario ve únicamente sus perfiles, experiencias, extracciones, favoritos, notas, búsquedas, importaciones e historial de importación. Las cuentas con rol administrador gestionan ofertas y fuentes, no obtienen por ello acceso a perfiles que pertenecen a otro usuario.
- Mantén la visibilidad del proyecto restringida a sus personas autorizadas. Ocultar una ruta o agregar `noindex` no hace privado un proyecto.

## CV y consentimiento

Crear un perfil exige consentimiento explícito y fecha. La aplicación acepta PDF/DOCX hasta 8 MB, inspecciona extensión y firma binaria, y extrae texto dentro del proceso del servidor sin un servicio de IA, OCR, analítica ni almacenamiento de terceros. El binario original no se conserva. La base retiene el nombre/formato/tamaño/fecha de carga, el estado de extracción y hasta 120.000 caracteres del texto extraído o corregido, porque esa información es necesaria para revisar y comparar el perfil.

Si un PDF escaneado no contiene texto, el estado avisa que necesita revisión manual y permite completar los antecedentes sin afirmar que se aplicó OCR. El archivo no se usa para completar títulos o logros que no estén expresados. El perfil permite corregir el texto, eliminar una versión y borrar permanentemente el perfil, sus extracciones, experiencia, habilidades y coincidencias asociadas. Favoritos, notas y búsquedas permanecen separados de los perfiles.

No cargues CV de una persona sin su consentimiento. El consentimiento revocado se gestiona eliminando el perfil, lo cual purga sus registros de aplicación; la retención de respaldos de infraestructura, si existieran, depende del proveedor y no es controlada por esta aplicación.

## Telemetría, registros y almacenamiento

- Analytics está desactivado en la configuración del proyecto y no se instala un proveedor de analítica en el frontend.
- Se desactivó el plugin de depuración del starter que guardaba redes/consola/replay en archivos locales.
- Los registros de auditoría almacenan usuario, acción, tipo e identificador de entidad; no copian el texto de CV o notas.
- `.env`, valores OAuth, DSN y tokens no deben incluirse en Git. `.env.example` contiene solo placeholders.
- Las ofertas importadas y sus enlaces originales provienen del operador; abrir un enlace lleva a un sitio de terceros y sale del control de esta app.
- El CV se envía temporalmente al endpoint autenticado para extraer texto; los bytes originales no se escriben a archivos estáticos ni al repositorio.

Este documento describe el comportamiento del código actual y no sustituye la política institucional que la persona administradora deba comunicar a sus usuarios.
