# Theos — Teólogo Católico

Aplicación web de chat con un agente teólogo católico, compatible con proveedores de IA como OpenAI, Anthropic, Google Gemini y Mistral. Interfaz minimalista, respuestas en streaming, sin framework ni paso de compilación.

---

## Uso rápido local (sin backend)

1. Clona o descarga el repositorio.
2. Abre `index.html` directamente en tu navegador.
3. Haz clic en el icono ⚙ (Configuración) e introduce tu API key del proveedor que quieras usar.
4. Escribe tu pregunta. Enter para enviar, Shift+Enter para nueva línea.

No se necesita servidor, npm ni ningún paso de compilación si abres `index.html` como archivo local. La key se guarda solo en `sessionStorage` y se borra al cerrar la pestaña.

Este modo es solo para desarrollo o uso personal. En cualquier despliegue web público, Theos desactiva el modo directo y requiere el proxy para proteger las API keys.

---

## Uso con backend (API key protegida)

Para despliegues donde otros usuarios acceden a la app, usa el proxy Express incluido. La key permanece en el servidor y nunca llega al navegador. El servidor tambien valida proveedor/modelo, controla limites de tokens, aplica rate limiting basico e inyecta el prompt del sistema.

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
├── server.js         # Proxy Express de producción (protege API keys y valida requests)
├── system-prompt.js  # Prompt del sistema controlado por servidor
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
- **Reporte de respuestas** — los usuarios pueden reportar contenido doctrinalmente problemático, ofensivo o inseguro
- **Dual-mode controlado** — modo local solo al abrir `index.html`; despliegues web usan proxy
- **Responsive** — adaptado a móvil
- **Sin dependencias de frontend** — marked.js y DOMPurify se cargan desde CDN, sin npm para el frontend

---

## Modelos disponibles

| Modelo | Velocidad | Profundidad |
|--------|-----------|-------------|
| `claude-sonnet-4-6` | Rápido | Alta (recomendado) |
| `claude-opus-4-6` | Más lento | Máxima |

Seleccionable en el panel de Configuración sin cambiar código. En modo proxy, el servidor valida que el modelo solicitado esté permitido.

---

## Seguridad de la API key

| Modo | ¿Dónde vive la key? | ¿Visible en DevTools? | Recomendado para |
|------|--------------------|-----------------------|------------------|
| Local (`index.html`) | `sessionStorage` del navegador | Sí, en cabeceras | Desarrollo o uso personal |
| Proxy (`server.js`) | `.env` en el servidor | No | Despliegue público y Play Store |

Consulta [SECURITY.md](SECURITY.md) para más detalles.

---

## Despliegue en producción

Cualquier plataforma que ejecute Node.js ≥ 18 sirve (Railway, Render, Fly.io, VPS propio, etc.):

1. Sube el código al servidor (sin `.env` — configura la variable de entorno directamente en la plataforma).
2. Ajusta limites si hace falta: `MAX_TOKENS`, `MAX_MESSAGES`, `MAX_MESSAGE_CHARS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`.
3. `npm install && npm start`.
4. El servidor escucha en `process.env.PORT` (por defecto 3000).

Para plataformas serverless (Cloudflare Workers, Vercel Edge Functions), el endpoint `POST /api/chat` de `server.js` es fácilmente portable — la lógica es un `fetch` con streaming piped de vuelta.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
