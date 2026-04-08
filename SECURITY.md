# Política de seguridad

## Arquitectura y manejo de la API key

Este proyecto puede ejecutarse en dos modos con distintas implicaciones de seguridad:

### Modo local (solo `index.html`)

- La API key se introduce en el panel de Configuración del navegador.
- Se persiste en **`sessionStorage`** — solo vive en esa pestaña y se borra automáticamente al cerrarla.
- Se envía directamente a `https://api.anthropic.com` como cabecera `x-api-key`.
- **Es visible en las DevTools del navegador** (pestaña Network → cabeceras de la petición).
- Aceptable para uso personal en tu propio equipo. No recomendado si compartes la URL con otras personas.

### Modo proxy (`server.js`)

- La API key se configura en un archivo `.env` **en el servidor**, nunca en el navegador.
- El `.env` está en `.gitignore` — nunca debe commitearse.
- El navegador llama a `POST /api/chat` en tu propio servidor; el servidor llama a Anthropic.
- **La key no aparece en ninguna cabecera visible desde el navegador.**
- Es el modo recomendado para cualquier despliegue accesible por terceros.

---

## Qué nunca debes hacer

- Nunca subas `.env` con valores reales a un repositorio git (ni privado).
- Nunca incluyas la API key como variable JavaScript en el HTML servido al cliente.
- Nunca registres (`console.log`) la API key en el servidor.
- Si usas un hosting tipo Vercel, Railway o Render, configura la key como variable de entorno desde el panel de la plataforma, no en archivos subidos.

---

## Riesgos conocidos y mitigaciones

| Riesgo | Mitigación incluida |
|--------|---------------------|
| API key expuesta en modo local | Aviso visible en la UI; `sessionStorage` en lugar de `localStorage` |
| XSS en respuestas del modelo | `DOMPurify.sanitize()` sobre todo HTML generado por `marked.parse()` |
| Commit accidental de `.env` | `.gitignore` cubre `.env` desde el primer commit |
| Inyección de prompt por el usuario | Responsabilidad del operador; el system prompt no es ejecutable |
| Uso abusivo del proxy sin autenticación | El `server.js` incluido es mínimo; en despliegues públicos añade rate limiting (p.ej. `express-rate-limit`) y autenticación de sesión |

---

## Mejoras recomendadas antes de un despliegue público

Si expones esta app a usuarios no confiables, considera añadir:

1. **Rate limiting** — `npm install express-rate-limit` y aplícalo al endpoint `/api/chat`.
2. **Autenticación** — sesiones o tokens para que solo usuarios autorizados puedan llamar al proxy.
3. **Content Security Policy** — cabecera HTTP que restrinja la carga de scripts a fuentes conocidas.
4. **HTTPS** — obligatorio en producción; usa un proxy inverso (nginx, Caddy) o la terminación TLS de tu plataforma.
5. **Límite de tokens por sesión** — evita costes inesperados si un usuario hace muchas peticiones largas.

---

## Reporte de vulnerabilidades

Si encuentras un problema de seguridad en este proyecto, abre un issue en el repositorio con la etiqueta `security` o contacta directamente al mantenedor. Por favor, **no publiques exploits activos** antes de coordinar una solución.
