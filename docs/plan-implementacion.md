# Plan de implementación

## Resultado buscado

Construir una primera versión usable de Autos Locos en la que una persona autenticada pueda consultar los usos compartidos de un auto, reservarlo para un horario y coordinar conflictos. La experiencia principal se diseña para celular y se amplía para escritorio.

Referencias visuales:

- Móvil: `mockups/calendario/mobile/calendario-lista-sheet.png`.
- Escritorio: `mockups/calendario/calendario-calido-familiar.png`.

## Decisiones de producto para la primera versión

- En celular, la vista principal muestra un día como lista cronológica. Un selector permite cambiar de día y de auto.
- La creación de una reserva se hace en un panel inferior con auto, fecha, hora inicial, hora final y comentario opcional.
- En escritorio, la misma información se presenta en una grilla semanal. El formulario conserva los mismos campos y estados.
- Todos los usuarios autenticados de la familia ven los autos y las reservas activas.
- Cada persona puede cancelar su propia reserva. Los demás pueden responder o marcar que también necesitan el auto, pero no cancelar una reserva ajena.
- Una superposición no impide reservar: marca todas las reservas involucradas como `en_conflicto`.
- La primera versión no incorpora hogares, roles administrativos, notificaciones push ni recurrencia.

## Etapa 1 — Base visual mobile-first con datos mock

- Separar los tipos y datos mock del componente visual actual.
- Crear la cabecera móvil, selector de auto, selector de fecha y lista de reservas del día.
- Implementar el panel inferior de creación con controles cómodos para pantalla táctil.
- Mostrar estados `confirmada`, `en_conflicto` y `cancelada` con texto e icono, además de color.
- Mantener una adaptación de escritorio con la grilla semanal existente.
- Evitar interacciones que dependan de hover y asegurar áreas táctiles de al menos 44 px.

Validación: navegar días y autos, abrir/cerrar el formulario, crear una reserva mock y comprobar el layout aproximadamente a 390 px y 1280 px de ancho.

## Etapa 2 — Esquema y reglas de negocio en PostgreSQL

- Eliminar del snapshot el ejemplo obsoleto que propone `usuario_id` como dueño del auto.
- Crear `autos`, `reservas` y `reserva_respuestas`, con restricciones para estados, tipos de respuesta y `fin > inicio`.
- Agregar índices por auto/fecha, usuario y reserva.
- Crear una vista o función de lectura que incluya nombres de usuario y respuestas necesarias para la interfaz.
- Implementar `crear_reserva(p_usuario_id, ...)`: insertar y marcar como `en_conflicto` todas las reservas activas que se solapen para el mismo auto.
- Implementar cancelación sólo para el autor y reconciliar el estado de las reservas restantes.
- Implementar respuestas y comentarios con el usuario de la sesión.
- Mantener `db/schema.sql` idempotente y tratar los timestamps como instantes; convertirlos para Argentina en la presentación.

Validación: ejecutar casos SQL de reserva sin conflicto, conflicto entre dos reservas, cancelación y reconciliación.

## Etapa 3 — API autenticada

- Crear `GET /api/autos`.
- Crear `GET /api/reservas?autoId=&desde=&hasta=`.
- Crear `POST /api/reservas`.
- Crear `DELETE /api/reservas/[id]` para retirar una reserva propia.
- Crear `POST /api/reservas/[id]/respuestas`.
- En todas las rutas privadas, obtener `usuarioId` desde la sesión, validar entradas y devolver errores JSON consistentes.
- Aplicar el rate limit genérico a `POST` y `DELETE` y marcar las lecturas dinámicas.

Validación: comprobar 401 sin sesión, 400 para entradas inválidas, 403 al cancelar una reserva ajena, 429 por límite y respuestas correctas para los casos válidos.

## Etapa 4 — Conectar la interfaz

- Reemplazar autos y reservas mock por datos de la API.
- Añadir estados de carga, vacío, error y reintento.
- Enviar reservas desde el panel inferior y actualizar la pantalla con el resultado real del servidor.
- Abrir el detalle de una reserva para ver conflicto, comentarios y respuestas.
- Permitir retirar una reserva propia y refrescar los estados reconciliados.
- Evitar actualizaciones optimistas en operaciones de conflicto hasta recibir la respuesta del servidor.

Validación: completar de punta a punta consulta, creación, conflicto, respuesta y cancelación desde dos usuarios.

## Etapa 5 — Responsive, accesibilidad y acabado

- Afinar la vista móvil en 360, 390 y 430 px.
- Adaptar a tablet y escritorio sin mantener dos implementaciones de negocio.
- Revisar navegación por teclado, foco, etiquetas, contraste y mensajes que no dependan sólo del color.
- Probar horarios largos, nombres extensos, varios solapamientos y días sin reservas.
- Confirmar que fechas y horas coincidan con Argentina cerca de medianoche.

Validación: `npm run build`, recorrido manual en móvil y escritorio, y prueba desde otro dispositivo de la red local.

## Orden para comenzar

1. Implementar la Etapa 1 y aprobar el flujo móvil con datos mock.
2. Implementar y probar el SQL de la Etapa 2.
3. Construir la API y conectar un primer recorrido vertical: listar autos, listar reservas y crear una reserva.
4. Agregar conflictos, respuestas y cancelación.
5. Completar responsive, accesibilidad y validación de producción.

El primer cambio de código debería concentrarse sólo en la Etapa 1. Así se valida la experiencia elegida antes de fijar el contrato de API alrededor de una interfaz que todavía podría cambiar.
