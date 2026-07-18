# Theos — Teólogo Católico

Aplicación web de chat con un agente teólogo católico, compatible con proveedores de IA como OpenAI, Anthropic, Google Gemini y Mistral. Interfaz minimalista, respuestas en streaming, sin framework ni paso de compilación.

---

## Uso rápido local (sin backend)

1. Clona o descarga el repositorio.
2. Abre `public/index.html` directamente en tu navegador.
3. Haz clic en el icono ⚙ (Configuración) e introduce tu API key del proveedor que quieras usar.
4. Escribe tu pregunta. Enter para enviar, Shift+Enter para nueva línea.

No se necesita servidor, npm ni ningún paso de compilación si abres `index.html` como archivo local. La key se mantiene solo en memoria mientras la pestaña está abierta; no se guarda en el navegador y se borra al recargar o cerrar la pestaña.

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
├── public/                     # Frontend estático (servido por el proxy o abierto directo)
│   ├── index.html              # Shell de la interfaz de chat
│   ├── marco-referencia.html   # Fuentes y marco de referencia doctrinal
│   ├── aviso-privacidad.html   # Aviso de privacidad
│   ├── terminos-condiciones.html
│   ├── style.css               # Sistema de diseño (tokens navy + oro, temas claro/oscuro)
│   ├── fonts.css               # Fuentes auto-hospedadas (Spectral, Public Sans, IBM Plex Mono)
│   ├── fonts/                  # Archivos .woff2 (sin CDN, por la CSP estricta)
│   ├── app.js                  # Lógica: estado, streaming SSE, Markdown, detección de proxy
│   ├── shared/providers.js     # Catálogo de proveedores/modelos compartido
│   └── robots.txt · sitemap.xml
├── server.js                   # Proxy Express de producción (protege API keys y valida requests)
├── system-prompt.js            # Prompt del sistema controlado por servidor
├── electron-main.js            # Empaquetado de escritorio (Electron)
├── package.json                # Dependencias del servidor (dotenv, express)
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Excluye .env y node_modules
├── SECURITY.md                 # Política de seguridad
├── CODE_OF_CONDUCT.md          # Código de conducta
└── LICENSE                     # MIT
```

---

## Características

- **Streaming token a token** — las respuestas aparecen en tiempo real mientras el modelo genera texto
- **Markdown renderizado** — el teólogo puede usar negritas, listas, citas bíblicas y encabezados
- **Detección de contexto** — el system prompt identifica el perfil del interlocutor antes de responder
- **Diálogo interreligioso** — Islam, Hinduismo, Budismo, Judaísmo, Iglesia Ortodoxa
- **Reporte de respuestas** — los usuarios pueden reportar contenido doctrinalmente problemático, ofensivo o inseguro
- **Dual-mode controlado** — modo local solo al abrir `public/index.html`; despliegues web usan proxy
- **Responsive** — adaptado a móvil
- **Sistema de diseño con temas** — dark-first (navy profundo + acento dorado), tema claro secundario vía `data-theme="light"`; todo sobre tokens CSS y fuentes auto-hospedadas
- **Sin dependencias de frontend** — marked.js y DOMPurify se cargan desde CDN (fijados + SRI), sin npm para el frontend

---

## Proveedores y modelos disponibles

| Proveedor | Modelos |
|-----------|---------|
| Anthropic (Claude) | `claude-sonnet-4-6`, `claude-opus-4-6` |
| OpenAI (ChatGPT) | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1` |
| Google (Gemini) | `gemini-3-flash-preview`, `gemini-2.5-flash` |
| Mistral AI | `mistral-large-latest`, `mistral-small-latest`, `open-mixtral-8x22b` |

Proveedor y modelo se eligen en el panel de Configuración sin cambiar código. En modo proxy, el servidor valida que el proveedor y el modelo solicitados estén permitidos.

---

## Seguridad de la API key

| Modo | ¿Dónde vive la key? | ¿Visible en DevTools? | Recomendado para |
|------|--------------------|-----------------------|------------------|
| Local (`public/index.html`) | Solo en memoria (no se persiste) | Sí, en cabeceras | Desarrollo o uso personal |
| Proxy (`server.js`) | `.env` en el servidor | No | Despliegue público y Play Store |

Consulta [SECURITY.md](SECURITY.md) para más detalles.

---

## Código de conducta

Este proyecto sigue un [Código de Conducta](CODE_OF_CONDUCT.md) inspirado en
el [ACM Code of Ethics](https://www.acm.org/code-of-ethics). Se espera que
toda persona colaboradora lo respete.

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
