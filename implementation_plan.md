# Migración a @solidjs/router y Solución Definitiva de WebSocket

El objetivo es cambiar la arquitectura de una "Single Page Application manual" a una aplicación con ruteo real (`/events/1`). Esto resolverá los problemas de "sordera" del WebSocket, ya que ataremos la conexión al ciclo de vida de la URL.

## User Review Required

> [!IMPORTANT]
> Vamos a instalar una nueva dependencia (`@solidjs/router`). El servidor de Vite podría necesitar un reinicio después de la instalación.

## Open Questions

Ninguna por ahora. La estructura con barra lateral (sidebar) y contenido principal se adapta perfectamente a un layout anidado.

## Proposed Changes

### Dependencias
- Ejecutar: `npm install @solidjs/router` en la carpeta `frontend`.

---

### Frontend Components

#### [MODIFY] `index.tsx`
- Envolver el componente principal con `<Router>` para proveer el contexto de navegación a toda la aplicación.

#### [MODIFY] `App.tsx`
- Implementar `<Routes>` y `<Route>`.
- Ruta `/`: Mostrar un mensaje que diga "Selecciona un evento de la lista".
- Ruta `/events/:id`: Renderizar el componente `<EventDetail>`.
- La barra lateral (`<EventList>`) se mantendrá visible en todo momento.

#### [MODIFY] `components/EventList.tsx`
- Cambiar los eventos `onClick` de las tarjetas por el componente `<A href="/events/1">` de Solid Router.
- Esto permitirá abrir eventos en pestañas nuevas, usar el botón de "Atrás" del navegador y compartir URLs.

#### [MODIFY] `components/EventDetail.tsx`
- Usar `useParams()` para capturar el ID del evento desde la URL (ej: `/events/1` -> `id: 1`).
- Implementar un `createEffect` que reaccione al cambio de la URL y llame a `store.selectEvent(id)`. Esto garantiza que los datos se recarguen siempre que cambie la URL.

#### [MODIFY] `stores/EventContext.tsx`
- Limpiar el `createEffect` del WebSocket. Al ser impulsado ahora por cambios reales en la URL y el ciclo de montaje, SolidJS no perderá el rastro de la variable reactiva.
