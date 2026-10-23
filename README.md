# Empleos Chile

## Estructura del proyecto

- `client/`: aplicación web, páginas, componentes y archivos públicos.
- `server/`: API, autenticación y lógica del servidor.
- `shared/`: tipos y utilidades compartidas entre cliente y servidor.
- `drizzle/`: esquema de base de datos y migraciones.
- `scripts/`: tareas auxiliares de desarrollo.
- `docs/`: documentación, briefs y material de investigación.
- `client/public/`: recursos estáticos servidos por la aplicación.

La configuración de herramientas (`package.json`, `vite.config.ts`,
`tsconfig.json` y `drizzle.config.ts`) se mantiene en la raíz para que los
comandos habituales de desarrollo y build puedan localizarla.
