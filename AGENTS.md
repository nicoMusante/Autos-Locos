# Instrucciones del proyecto

Este archivo es la referencia principal para Codex al trabajar en este repositorio. Mantenerlo actualizado cuando cambien la arquitectura o los comandos.

## Objetivo y stack

Autos Locos permite coordinar el uso de uno o dos autos entre hermanos mediante un calendario semanal. Las reservas superpuestas se resuelven entre los involucrados mediante respuestas y comentarios, sin un aprobador único. La aplicación debe funcionar también en PC, pero el diseño y las decisiones de interacción tienen prioridad mobile-first: la experiencia principal debe verse y usarse muy bien en celular antes de adaptarse a pantallas grandes.

- Next.js 14 con App Router, TypeScript y React 18.
- Tailwind CSS y variables CSS semánticas para los temas.
- PostgreSQL en Neon, usando `@neondatabase/serverless` desde `lib/db.ts`.
- NextAuth v5: credenciales y Google OAuth opcional. Deploy en Vercel.

## Comandos y validación

```sh
npm install      # instalar dependencias si faltan
npm run dev      # desarrollo en localhost:3000
npm run build    # build de producción
npm run start    # servir el build de producción
npm run lint     # ejecuta next lint
```

No hay suite de tests configurada. `package.json` incluye el comando de lint, pero no declara ESLint: no asumir que funciona sin configuración adicional. Validar los cambios con los controles pertinentes; para cambios de código, usar el build cuando el entorno lo permita. Para cambios sólo de documentación, verificar contenido, rutas y diff. Informar qué se comprobó y cualquier bloqueo; nunca declarar una validación exitosa sin evidencia.

## Configuración y secretos

- `.env.local` contiene `DATABASE_URL` y `AUTH_SECRET`; Google requiere además `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Sin estas últimas, el login por credenciales sigue disponible.
- Nunca copiar secretos a archivos versionados, respuestas o logs. `.env.local.example` es una plantilla versionada y sólo debe contener placeholders.
- Reiniciar el servidor de desarrollo después de cambiar variables de entorno.
- Las variables de Vercel se configuran por separado y requieren redeploy. La ausencia de `AUTH_SECRET` puede provocar la pantalla genérica de error de Auth.js.
- `db/schema.sql` es un snapshot manual e idempotente, no un sistema de migraciones ni una sincronización automática con Neon. Mantenerlo actualizado al cambiar el esquema. Editarlo no aplica cambios a la base remota.

## Arquitectura y permisos

- `auth.config.ts` contiene la configuración compatible con edge; no agregar allí acceso a la base ni dependencias incompatibles. `auth.ts` incorpora providers, acceso a usuarios y callbacks del JWT.
- `middleware.ts` protege páginas y excluye `/api`. Cada endpoint privado debe resolver la sesión con `getUsuarioId()` de `lib/auth.ts` y responder con `noAutenticado()` si falta. No confiar en el middleware para autorizar APIs.
- `/login` y `/registro` son páginas públicas. `app/api/auth/registro/route.ts` es el registro público propio; NextAuth maneja login y logout mediante `app/api/auth/[...nextauth]/route.ts`.
- El handler de NextAuth reconstruye la URL con `x-forwarded-host` para permitir acceso desde otros dispositivos en desarrollo; preservar ese comportamiento al tocar autenticación.
- Mantener rutas de dominio finas: sesión, parsing, llamada SQL parametrizada y respuesta. La lógica de negocio persistente debe vivir en funciones PL/pgSQL, incluyendo solapamientos y reconciliación de reservas.
- Obtener la identidad del usuario desde la sesión, nunca confiar en un `usuario_id` enviado por el cliente. Las funciones de dominio que requieran identidad reciben `p_usuario_id` como primer parámetro y validan los permisos de la operación.
- **El dominio es compartido por una sola familia:** los autos no tienen `usuario_id` de dueño. `reservas.usuario_id` y `reserva_respuestas.usuario_id` identifican al autor; no implican ocultar esos registros al resto de la familia. La detección de conflictos debe considerar todas las reservas activas del mismo auto, incluso las de otros usuarios.
- No hay aislamiento por hogares ni RLS implementado. No agregar un filtro universal por autor que impida la coordinación compartida. La visibilidad compartida tampoco autoriza modificar arbitrariamente reservas ajenas; respetar los permisos de cada acción y aclarar reglas que aún no estén definidas.
- Usar el tagged template `sql` de `lib/db.ts` para parametrizar consultas.
- Las rutas que devuelvan datos que cambian frecuentemente deben exportar `dynamic = "force-dynamic"`.

## Rate limiting

- `lib/rateLimit.ts` controla intentos de autenticación mediante `intentos_auth`: 5 fallos en 15 minutos, por email normalizado para login y por identificador `registro:<ip>` para registro.
- Preservar el código `rate_limited` que usa la UI de login.
- `ipDelRequest()` toma el último valor de `x-forwarded-for`, suponiendo un proxy de confianza. Revisar esa suposición si cambia la infraestructura.
- Aplicar `demasiadasRequests()` y `demasiadasPeticiones()` a nuevos métodos mutantes del dominio (`POST`, `PATCH`, `DELETE`). El límite es 40 requests por 10 segundos por usuario, en memoria; no se comparte entre instancias ni persiste entre reinicios. Auth tiene su limitador específico.

## Fechas y estilos

- Para el día actual de Argentina en SQL, usar `hoy_ar()` de `db/schema.sql`, basada en `America/Argentina/Buenos_Aires`, en lugar de `CURRENT_DATE` sin conversión explícita.
- No parsear una columna `DATE` (`YYYY-MM-DD`) con `new Date(fechaISO)` directamente: se interpreta como UTC y puede mostrarse como el día anterior en Argentina.
- `app/globals.css` define temas mediante `[data-theme="..."]` y variables semánticas. Consumirlas con clases como `bg-background` y `text-foreground`; no introducir una prop de tema `t` ni estilos inline para reemplazar el sistema de temas.
- El calendario usa `--cal-good`, `--cal-warning`, `--cal-critical`, `--cal-cancelada` y `--cal-series-1/2/3`. Agregar nuevas variables coherentes si hacen falta más colores de personas.

## Mapa del repositorio

- `app/page.tsx`: página autenticada que renderiza el calendario.
- `components/calendario/Calendario.tsx`: calendario, reservas y panel de coordinación.
- `app/api/`: route handlers.
- `app/login/`, `app/registro/`: autenticación pública.
- `lib/auth.ts`, `lib/db.ts`, `lib/rateLimit.ts`: sesión, conexión y límites.
- `auth.ts`, `auth.config.ts`, `middleware.ts`: autenticación y protección de páginas.
- `db/schema.sql`: snapshot del esquema.

## Estado verificado en el repositorio (2026-09-21)

El calendario funciona con datos mock en memoria (`USUARIOS`, `AUTOS`, `reservasIniciales`) y todavía no consume una API de reservas. Incluye creación de reservas, detección de solapamientos, columnas para reservas simultáneas, comentarios y reconciliación al retirar una reserva.

El esquema implementado contiene `usuarios`, `intentos_auth` y `hoy_ar()`. Las tablas de dominio y sus endpoints todavía están pendientes. Esto describe los archivos locales; no confirma el estado de una base Neon remota.

La dirección visual elegida es mobile-first. Usar `mockups/calendario/mobile/calendario-lista-sheet.png` como referencia principal: lista simple de usos del día y formulario de reserva en un panel inferior. `mockups/calendario/calendario-calido-familiar.png` queda como referencia para adaptar la misma experiencia a escritorio. Los mockups orientan la jerarquía y el flujo; no deben copiarse como una imagen ni obligar a reproducir detalles decorativos que perjudiquen accesibilidad o responsive.

Modelo acordado en el contexto anterior, aún por implementar:

- `autos`: `id`, `nombre`, `patente` opcional, `creado_en`; compartidos, sin propietario.
- `reservas`: `id`, `auto_id`, `usuario_id`, `inicio`, `fin`, `estado` (`pendiente`, `confirmada`, `en_conflicto`, `cancelada`), comentario inicial opcional y `creado_en`.
- `reserva_respuestas`: `id`, `reserva_id`, `usuario_id`, `tipo` (`tambien_lo_necesito`, `no_lo_necesito`, `comentario`), texto opcional y `creado_en`.
- `crear_reserva`: detectar solapamiento con reservas activas del mismo auto y marcar las afectadas `en_conflicto`. Al cancelar, reconciliar y devolver a `confirmada` las que ya no se solapen.

Antes de implementar persistencia, revisar `seSolapan`, `crearReserva`, `retirarReserva` y `reconciliarConflictos` como referencia del comportamiento; `layoutReservas` es lógica visual que debe permanecer en la UI. El paso pendiente es implementar esquema y funciones, aplicarlos al entorno correspondiente y conectar el calendario a APIs reales cuando la tarea lo requiera.

## Forma de trabajar

- Responder en español natural de Argentina, de forma breve y directa, sin adulaciones ni narración de cada herramienta utilizada.
- Si el usuario anuncia que enviará contexto en varios mensajes, responder sólo “Recibido” hasta que indique “LISTO, podés analizar todo” o una confirmación equivalente.
- Antes de editar código, leer los archivos relevantes y revisar el contexto de Git. Preservar cambios existentes del usuario y evitar modificaciones ajenas a la tarea.
- Hacer cambios pequeños y localizados. Evitar reescribir archivos completos, abstraer prematuramente o agregar dependencias sin necesidad.
- Al diseñar interfaces, partir de celular: controles cómodos para el pulgar, texto legible, acciones primarias accesibles y contenido sin depender de hover. Ampliar el layout para PC sin perder ese flujo.
- Leer sólo lo necesario; buscar con `rg`, agrupar lecturas independientes y no releer archivos sin motivo. Una búsqueda simple no requiere subagentes.
- Si falta información que cambie sustancialmente la solución, preguntar. Resolver decisiones rutinarias con el contexto disponible.
- Los comentarios nuevos deben estar en español, en primera persona, en minúsculas y con lenguaje cotidiano; sin dirigirse al usuario y sin espacio después del delimitador, por ejemplo `//valido la reserva`.
- Al modificar SQL, explicar brevemente la lógica. No repetir código ya visible en el diff; resumir el resultado y la validación al terminar.
- Mantener este documento acorde al código. Distinguir siempre funcionalidades existentes de propuestas o tareas pendientes.
