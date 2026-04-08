# Theos — Teólogo Católico

Aplicación web de chat con un agente teólogo católico, impulsada por la API de Anthropic. Interfaz minimalista, respuestas en streaming, sin framework ni paso de compilación.

---

## Uso rápido (sin backend)

1. Clona o descarga el repositorio.
2. Abre `index.html` directamente en tu navegador.
3. Haz clic en el icono ⚙ (Configuración) e introduce tu [API key de Anthropic](https://console.anthropic.com/settings/api-keys).
4. Escribe tu pregunta. Enter para enviar, Shift+Enter para nueva línea.

No se necesita servidor, npm ni ningún paso de compilación. La key se guarda solo en `sessionStorage` y se borra al cerrar la pestaña.

---

## Uso con backend (API key protegida)

Para despliegues donde otros usuarios acceden a la app, usa el proxy Express incluido. La key permanece en el servidor y nunca llega al navegador.

```bash
# 1. Configura la clave
cp .env.example .env
# Edita .env y añade tu ANTHROPIC_API_KEY real

# 2. Instala dependencias
npm install

# 3. Arrancar
npm start          # producción
npm run dev        # desarrollo (auto-reinicio al cambiar archivos)
```

Abre `http://localhost:3000`. El frontend detecta el proxy automáticamente y oculta el campo de API key.

**Requisitos:** Node.js ≥ 18

---

## Estructura del proyecto

```
theos/
├── index.html        # Shell de la interfaz de chat
├── style.css         # Estilos — estética minimalista católica
├── app.js            # Toda la lógica: estado, streaming SSE, Markdown, proxy
├── server.js         # Proxy Express opcional (protege la API key)
├── package.json      # Dependencias del servidor (dotenv, express)
├── .env.example      # Plantilla de variables de entorno
├── .gitignore        # Excluye .env y node_modules
├── SECURITY.md       # Política de seguridad
└── LICENSE           # MIT
```

---

## Características

- **Streaming token a token** — las respuestas aparecen en tiempo real mientras el modelo genera texto
- **Markdown renderizado** — el teólogo puede usar negritas, listas, citas bíblicas y encabezados
- **Detección de contexto** — el system prompt identifica el perfil del interlocutor antes de responder
- **Diálogo interreligioso** — Islam, Hinduismo, Budismo, Judaísmo, Iglesia Ortodoxa
- **Dual-mode** — funciona sin servidor (local) o con proxy (desplegado)
- **Responsive** — adaptado a móvil
- **Sin dependencias de frontend** — marked.js y DOMPurify se cargan desde CDN, sin npm para el frontend

---

## Modelos disponibles

| Modelo | Velocidad | Profundidad |
|--------|-----------|-------------|
| `claude-sonnet-4-6` | Rápido | Alta (recomendado) |
| `claude-opus-4-6` | Más lento | Máxima |

Seleccionable en el panel de Configuración sin cambiar código.

---

## Seguridad de la API key

| Modo | ¿Dónde vive la key? | ¿Visible en DevTools? | Recomendado para |
|------|--------------------|-----------------------|------------------|
| Local (`index.html`) | `sessionStorage` del navegador | Sí, en cabeceras | Uso personal |
| Proxy (`server.js`) | `.env` en el servidor | No | Despliegue público |

Consulta [SECURITY.md](SECURITY.md) para más detalles.

---

## Despliegue en producción

Cualquier plataforma que ejecute Node.js ≥ 18 sirve (Railway, Render, Fly.io, VPS propio, etc.):

1. Sube el código al servidor (sin `.env` — configura la variable de entorno directamente en la plataforma).
2. `npm install && npm start`.
3. El servidor escucha en `process.env.PORT` (por defecto 3000).

Para plataformas serverless (Cloudflare Workers, Vercel Edge Functions), el endpoint `POST /api/chat` de `server.js` es fácilmente portable — la lógica es un `fetch` con streaming piped de vuelta.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
