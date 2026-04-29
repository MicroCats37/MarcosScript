# TODO: Migración a @solidjs/router

- `[ ]` Instalación de dependencias
    - `npm install @solidjs/router`
- `[ ]` Configuración de Router Principal
    - Modificar `index.tsx` para envolver la App con `<Router>`
    - Modificar `App.tsx` para definir el esquema de `<Routes>` y `<Route>`
- `[ ]` Actualización de Navegación
    - Refactorizar `components/EventList.tsx` para usar `<A>` en lugar de `onClick`
- `[ ]` Limpieza del Store Global
    - Eliminar el `createEffect` del WebSocket de `stores/EventContext.tsx`
- `[ ]` Implementación de EventDetail Reactivo
    - Actualizar `components/EventDetail.tsx` para usar `useParams`
    - Mover la lógica de conexión WebSocket a `EventDetail.tsx`
- `[ ]` Verificación
    - Probar navegación directa por URL
    - Confirmar reconexión automática del WebSocket al cambiar de evento
