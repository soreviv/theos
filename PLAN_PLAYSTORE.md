# Plan de trabajo para lanzamiento de Theos en Google Play

Este documento convierte las oportunidades detectadas en un plan de implementacion ejecutable. El objetivo no es solo "subir una app", sino llegar a Play Store con una experiencia confiable, sostenible en costos, clara en privacidad y diferenciada por calidad teologica verificable.

## Objetivos

- Publicar Theos como app Android en Google Play a mediano plazo.
- Mantener la confianza del usuario: privacidad clara, limites honestos de IA y respuestas pastoralmente cuidadosas.
- Cumplir politicas relevantes de Google Play para apps con IA generativa.
- Evitar exposicion de API keys, abuso del proxy y costos inesperados.
- Convertir Theos de "chatbot religioso" a "asistente teologico catolico con fuentes verificables".

## Principios de arquitectura

- Backend obligatorio para produccion: el cliente nunca debe llamar directo a proveedores de IA con llaves del usuario.
- Privacidad por defecto: guardar lo minimo, explicar lo que se envia a proveedores y pedir consentimiento para cualquier persistencia.
- Seguridad por capas: rate limit, validacion de entrada, cuotas, moderacion, monitoreo y respuesta a incidentes.
- Fuentes verificables: separar conocimiento doctrinal curado del prompt general.
- Lanzamiento incremental: PWA primero, Trusted Web Activity despues, app nativa solo si hay necesidad clara.

## Fase 0: Alineacion legal, politicas y alcance

### 0.1 Revisar politica vigente de Google Play

Implementacion:

- Crear una checklist interna de Play Console con:
  - AI-Generated Content.
  - User Data / Data Safety.
  - Privacy Policy.
  - User Generated Content, si en el futuro se comparten conversaciones o comentarios entre usuarios.
  - Content Rating.
  - Families policy, solo si se decide orientar la app a menores.
- Definir la categoria inicial recomendada: Education o Lifestyle, evitando presentarla como servicio medico, psicologico o de consejeria profesional.

Criterios de aceptacion:

- Existe una checklist en el repositorio o herramienta de gestion.
- Cada declaracion de Play Console tiene correspondencia exacta con la politica de privacidad.
- Se decide explicitamente si la app sera apta para menores o solo publico general.

Riesgos:

- Rechazo por no tener reporte de contenido generado por IA.
- Inconsistencia entre Data Safety y aviso de privacidad.
- Clasificacion de edad incorrecta por temas sensibles: sexualidad, violencia, suicidio, guerra, abuso o religion.

### 0.2 Actualizar documentos legales

Implementacion:

- Actualizar `aviso-privacidad.html` para incluir todos los proveedores realmente soportados: OpenAI, Anthropic, Google Gemini y Mistral.
- Explicar con precision:
  - Que el mensaje del usuario se transmite al proveedor seleccionado.
  - Que Theos puede procesar reportes de contenido ofensivo.
  - Que se podrian conservar logs tecnicos minimizados para seguridad, si se implementan.
  - Que no debe introducirse informacion sensible.
- Actualizar `terminos-condiciones.html` para incluir:
  - Funcion de reporte.
  - Politica de uso aceptable.
  - Limitaciones pastorales, psicologicas, juridicas y medicas.
  - Responsabilidad del usuario al verificar fuentes antes de decisiones graves.

Criterios de aceptacion:

- Politica de privacidad y terminos mencionan los mismos proveedores que el codigo.
- El footer y Play Console apuntan a una URL publica estable de privacidad.
- No hay promesas absolutas incompatibles con logs, reportes o proveedores externos.

## Fase 1: Seguridad, costos y operacion minima viable

### 1.1 Retirar modo directo para produccion

Implementacion:

- Mantener modo directo solo para desarrollo local, protegido por una variable como `ALLOW_DIRECT_MODE=true`.
- En produccion, ocultar el campo API key y bloquear llamadas directas desde navegador.
- Centralizar proveedor/modelo permitido en el servidor.
- Exponer en `/api/health` solo informacion no sensible.

Criterios de aceptacion:

- En produccion ningun usuario ve ni introduce API keys.
- El navegador solo llama a `/api/chat`.
- Si el proxy no esta disponible, la app muestra un estado de servicio no disponible, no pide API key.

### 1.2 Rate limiting y cuotas

Implementacion:

- Instalar y configurar `express-rate-limit`.
- Definir limites iniciales:
  - Por IP: mensajes por minuto.
  - Por sesion o usuario: mensajes por dia.
  - Por request: longitud maxima del mensaje y numero maximo de mensajes en historial.
  - Por salida: `max_tokens` controlado por servidor, no por cliente.
- Rechazar requests que excedan limites con mensajes claros y no tecnicos.

Criterios de aceptacion:

- Un usuario no puede disparar costos ilimitados.
- Requests largos o automatizados reciben `429` o `400`.
- Los limites son configurables por variables de entorno.

### 1.3 Validacion de entrada y control de historial

Implementacion:

- Validar payload de `/api/chat`:
  - `provider` pertenece a una lista permitida.
  - `model` pertenece a modelos permitidos para ese proveedor.
  - `messages` es arreglo valido.
  - Roles permitidos: `user`, `assistant`, `system`.
  - Longitud maxima por mensaje.
- No aceptar `system` desde cliente en produccion. El servidor debe inyectar el system prompt oficial.
- Implementar truncado o resumen de historial para controlar tokens.

Criterios de aceptacion:

- El cliente no puede reemplazar el system prompt.
- No hay errores internos por payloads malformados.
- El costo por conversacion queda acotado.

### 1.4 Cabeceras de seguridad

Implementacion:

- Agregar `helmet` a Express.
- Configurar Content Security Policy compatible con:
  - Scripts locales.
  - CDN de `marked` y `DOMPurify`, o idealmente servir esas dependencias localmente.
  - Conexion a `/api/chat`.
- Agregar:
  - `X-Content-Type-Options`.
  - `Referrer-Policy`.
  - `Permissions-Policy`.
  - HSTS en produccion con HTTPS.

Criterios de aceptacion:

- Lighthouse no reporta cabeceras basicas faltantes.
- No se rompe el render de Markdown.
- La CSP bloquea scripts no autorizados.

### 1.5 Observabilidad minima

Implementacion:

- Agregar logging estructurado sin contenido sensible:
  - timestamp.
  - proveedor.
  - modelo.
  - duracion.
  - status.
  - tokens aproximados si el proveedor los reporta.
  - hash anonimo de IP o usuario, si es necesario para abuso.
- No registrar prompts completos por defecto.
- Crear alertas basicas:
  - incremento de errores.
  - incremento de gasto.
  - latencia alta.
  - picos de `429`.

Criterios de aceptacion:

- Se puede diagnosticar caida o abuso sin leer conversaciones privadas.
- Existe una politica clara de retencion de logs.

## Fase 2: Cumplimiento especifico de IA generativa

### 2.1 Reporte de contenido ofensivo dentro de la app

Implementacion:

- Agregar boton discreto en cada respuesta del asistente: "Reportar".
- Abrir modal con motivos:
  - Error doctrinal grave.
  - Contenido ofensivo o discriminatorio.
  - Consejo peligroso.
  - Cita falsa o no verificable.
  - Otro.
- Enviar a `/api/reports`:
  - id local de mensaje.
  - motivo.
  - comentario opcional.
  - proveedor/modelo.
  - texto reportado, o una version minimizada/redactada segun politica de privacidad.
- Agregar confirmacion visible: "Gracias, revisaremos este reporte".

Criterios de aceptacion:

- El usuario puede reportar contenido sin salir de la app.
- Los reportes se almacenan o enrutan para revision.
- La politica de privacidad explica este flujo.

### 2.2 Moderacion y filtros de seguridad

Implementacion:

- Agregar una capa previa al modelo para detectar temas de alto riesgo:
  - autolesion/suicidio.
  - abuso sexual o menores.
  - instrucciones violentas.
  - odio religioso o contra grupos protegidos.
  - consejo medico, juridico o financiero.
- Definir respuestas seguras para cada categoria.
- Agregar post-moderacion opcional para respuestas del modelo si el proveedor lo permite.
- Registrar solo eventos de seguridad, no necesariamente el contenido completo.

Criterios de aceptacion:

- Preguntas de crisis reciben respuesta de contencion y recursos de ayuda.
- La app no genera instrucciones peligrosas.
- Hay pruebas manuales con prompts de riesgo.

### 2.3 Prompt pastoral de crisis

Implementacion:

- Separar el system prompt en archivo de servidor.
- Agregar instrucciones especificas:
  - No sustituir sacerdote, terapeuta, medico ni abogado.
  - En riesgo inmediato, recomendar contactar emergencias locales o una persona de confianza.
  - En escrupulosidad religiosa, responder con calma y recomendar direccion espiritual humana.
  - En culpa, abuso o trauma, priorizar cuidado y seguridad.

Criterios de aceptacion:

- Respuestas de temas sensibles son prudentes, no condenatorias y no absolutistas.
- El asistente evita dar diagnosticos clinicos o instrucciones legales.

## Fase 3: Producto y experiencia de usuario

### 3.1 Controles esperados de chat

Implementacion:

- Boton "Detener generacion" con `AbortController`.
- Boton "Reintentar" en errores.
- Boton "Copiar respuesta".
- Boton "Compartir" usando Web Share API cuando este disponible.
- Feedback positivo/negativo por respuesta.
- Confirmacion antes de borrar historial.

Criterios de aceptacion:

- El usuario puede controlar una respuesta larga.
- Errores recuperables no obligan a recargar la app.
- Las acciones estan disponibles en movil sin saturar la interfaz.

### 3.2 Onboarding claro

Implementacion:

- Sustituir la advertencia de API key por una introduccion de uso:
  - "Theos usa IA y puede equivocarse".
  - "Verifica fuentes antes de decisiones importantes".
  - "No compartas datos sensibles".
  - "Puedes reportar respuestas problemáticas".
- Mostrar terminos y privacidad antes del primer uso, si aplica.

Criterios de aceptacion:

- El primer usuario entiende que es una herramienta educativa.
- El onboarding no bloquea innecesariamente el flujo.

### 3.3 Modos de conversacion

Implementacion:

- Agregar selector de modo:
  - Duda rapida.
  - Profundizar con fuentes.
  - Preparar catequesis.
  - Dialogo interreligioso.
  - Acompanamiento espiritual prudente.
  - Explicar a jovenes.
- Cada modo modifica instrucciones secundarias, no el nucleo doctrinal.

Criterios de aceptacion:

- El usuario recibe respuestas ajustadas a su necesidad.
- Los modos no contradicen las reglas doctrinales base.

### 3.4 Accesibilidad y calidad movil

Implementacion:

- Revisar contraste, tamanos tactiles y navegacion por teclado.
- Asegurar que el teclado movil no tape el textarea.
- Probar en viewport pequeno y grande.
- Agregar estados offline, loading y error de red.

Criterios de aceptacion:

- Lighthouse Accessibility >= 90.
- La app se puede usar comodamente con una mano en Android.

## Fase 4: Diferenciador doctrinal con fuentes verificables

### 4.1 Catalogo curado de fuentes

Implementacion:

- Crear un directorio `sources/` o una pequena base de datos con:
  - Catecismo por paragrafos.
  - Vaticano II por documentos/secciones.
  - Codigo de Derecho Canonico por canon relevante.
  - Enlaces oficiales a Vaticano cuando existan.
  - Biblia con politica clara de version/licencia.
- Cada fuente debe incluir:
  - id canonico.
  - titulo.
  - referencia.
  - texto o resumen permitido por licencia.
  - URL oficial.
  - tags.

Criterios de aceptacion:

- El asistente puede devolver referencias verificables.
- Las fuentes usadas tienen licencia o enlace oficial claro.

### 4.2 Recuperacion aumentada por fuentes

Implementacion:

- Para cada pregunta, buscar fuentes relevantes antes de llamar al modelo.
- Inyectar al prompt solo fragmentos relevantes.
- Pedir al modelo que cite unicamente fuentes provistas o indique incertidumbre.
- Mostrar al usuario una seccion "Fuentes consultadas".

Criterios de aceptacion:

- Reduce citas inventadas.
- El usuario puede tocar una fuente y verificarla.
- Si no hay fuente suficiente, Theos lo dice.

### 4.3 Evaluaciones doctrinales

Implementacion:

- Crear un set de preguntas de prueba:
  - sacramentos.
  - salvacion fuera de la Iglesia.
  - moral sexual.
  - dolor, culpa y perdon.
  - otras religiones.
  - temas historicos sensibles.
- Para cada prueba definir:
  - respuesta esperada en terminos generales.
  - fuentes obligatorias o aceptables.
  - riesgos de mala respuesta.
- Ejecutar evaluaciones antes de cada release.

Criterios de aceptacion:

- Existe bateria de evaluacion repetible.
- Cambios de modelo o prompt no degradan respuestas clave sin detectarse.

## Fase 5: PWA y preparacion Android

### 5.1 Convertir Theos en PWA

Implementacion:

- Crear `manifest.webmanifest` con:
  - nombre.
  - short_name.
  - descripcion.
  - theme_color.
  - background_color.
  - start_url.
  - display: standalone.
  - icons 192, 512 y maskable.
- Crear service worker:
  - cache de shell estatico.
  - no cachear respuestas de chat.
  - fallback offline con mensaje claro.
- Registrar service worker desde `index.html`.

Criterios de aceptacion:

- Lighthouse PWA pasa checks principales.
- La app puede abrirse como standalone en Android.
- No se almacenan conversaciones en cache.

### 5.2 Empaquetar con Trusted Web Activity

Implementacion:

- Usar Bubblewrap para generar proyecto Android TWA.
- Configurar package name, iconos, splash screen y versionCode.
- Configurar Digital Asset Links en `/.well-known/assetlinks.json`.
- Verificar que el dominio publicado coincide con la app firmada.

Criterios de aceptacion:

- La app abre en pantalla completa sin barra de navegador.
- Digital Asset Links valida correctamente.
- Se genera un Android App Bundle (`.aab`) listo para Play Console.

### 5.3 Store listing

Implementacion:

- Preparar:
  - nombre corto.
  - descripcion breve.
  - descripcion larga.
  - screenshots telefono.
  - icono 512.
  - feature graphic.
  - politica de privacidad.
  - email de soporte.
- Mensaje recomendado:
  - Enfatizar "herramienta educativa".
  - No prometer autoridad eclesiastica.
  - No prometer exactitud absoluta.

Criterios de aceptacion:

- Listing no usa claims exagerados.
- Screenshots muestran el reporte, fuentes y limites de IA.

## Fase 6: Cuentas, persistencia y personalizacion opcional

### 6.1 Decidir modelo de identidad

Opciones:

- Sin cuenta: menor friccion, menor personalizacion.
- Cuenta opcional: historial, preferencias y limites por usuario.
- Cuenta obligatoria: mejor control de abuso, peor adopcion inicial.

Recomendacion inicial:

- Cuenta opcional despues del MVP Play Store.
- Mantener modo privado sin historial por defecto.

### 6.2 Historial con consentimiento

Implementacion:

- Agregar toggle: "Guardar mis conversaciones".
- Explicar que se guardan preguntas y respuestas para sincronizacion y continuidad.
- Permitir borrar conversaciones.
- Permitir exportar datos si hay cuenta.

Criterios de aceptacion:

- No se guarda historial sin accion afirmativa del usuario.
- La politica de privacidad y Data Safety reflejan esta decision.

## Fase 7: Monetizacion sostenible

### 7.1 Control de costos antes de monetizar

Implementacion:

- Medir costo promedio por conversacion.
- Definir modelo por niveles:
  - Gratis con limite diario.
  - Plus con mas mensajes o modelos mejores.
  - Institucional para parroquias/colegios.
- En Android, si se vende contenido o funcionalidad digital dentro de la app, evaluar Google Play Billing.

Criterios de aceptacion:

- Cada usuario gratuito tiene costo maximo diario.
- Existe margen estimado para plan pago.

### 7.2 Producto institucional

Implementacion:

- Crear propuesta para:
  - parroquias.
  - colegios catolicos.
  - grupos de catequesis.
- Funciones posibles:
  - marco doctrinal curado.
  - panel de preguntas frecuentes.
  - revision humana de respuestas reportadas.
  - modo catequista.

Criterios de aceptacion:

- Hay una oferta clara distinta de la app gratuita.
- El roadmap tecnico no bloquea esta evolucion.

## Fase 8: QA, release y operacion

### 8.1 Pruebas automatizadas minimas

Implementacion:

- Agregar pruebas para:
  - validacion de payload en `/api/chat`.
  - limites de rate limit.
  - bloqueo de modelos no permitidos.
  - endpoint de reportes.
  - sanitizacion/render de Markdown.
- Agregar Playwright para flujos:
  - enviar pregunta.
  - detener generacion.
  - reportar respuesta.
  - abrir privacidad/terminos/fuentes.

Criterios de aceptacion:

- `npm test` o comando equivalente corre localmente.
- Flujos principales pasan antes de release.

### 8.2 Beta cerrada

Implementacion:

- Publicar primero en canal interno o cerrado de Play Console.
- Invitar usuarios de confianza:
  - catequistas.
  - sacerdotes o teologos aliados.
  - usuarios no tecnicos.
- Medir:
  - errores.
  - reportes.
  - costo por usuario.
  - calidad percibida.
  - temas frecuentes.

Criterios de aceptacion:

- Al menos 20-50 testers reales.
- Se corrigen bloqueadores antes de produccion.

### 8.3 Runbook operativo

Implementacion:

- Documentar:
  - como rotar API keys.
  - como desactivar proveedor.
  - como bajar limites ante abuso.
  - como responder a reporte grave.
  - como publicar nueva version.
  - como revertir release.

Criterios de aceptacion:

- Un operador puede manejar incidentes sin leer el codigo completo.

## Cronograma sugerido

### Mes 1: Fundacion segura

- Retirar modo directo en produccion.
- Rate limiting, validacion y quotas.
- Cabeceras de seguridad.
- Actualizacion legal.
- Reporte de contenido dentro de app.

### Mes 2: Calidad de producto

- Controles de chat.
- Onboarding.
- Moderacion de temas sensibles.
- Evaluaciones doctrinales iniciales.
- Mejoras moviles y accesibilidad.

### Mes 3: Fuentes verificables

- Catalogo curado inicial.
- Primer RAG simple.
- UI de fuentes consultadas.
- Pruebas doctrinales ampliadas.

### Mes 4: PWA y Android

- Manifest y service worker.
- TWA con Bubblewrap.
- Digital Asset Links.
- Store listing.
- Canal interno/cerrado en Play Console.

### Mes 5: Beta y ajuste

- Beta cerrada.
- Observabilidad.
- Ajuste de costos.
- Revision legal final.
- Preparacion de lanzamiento publico.

## Backlog tecnico priorizado

1. Mover system prompt al servidor y no aceptar `system` del cliente en produccion.
2. Agregar rate limiting y validacion estricta de payload.
3. Agregar endpoint y UI de reportes.
4. Actualizar privacidad/terminos para proveedores reales y reportes.
5. Agregar controles de chat: detener, reintentar, copiar, compartir.
6. Agregar moderacion de temas de alto riesgo.
7. Crear manifest PWA y service worker.
8. Servir dependencias frontend localmente o endurecer CSP para CDN.
9. Crear catalogo inicial de fuentes verificables.
10. Crear pruebas automatizadas y evaluaciones doctrinales.
11. Empaquetar TWA y configurar Digital Asset Links.
12. Preparar Play Console, screenshots y beta cerrada.

## Decisiones pendientes

- Modelo de negocio inicial: gratis, freemium o institucional primero.
- Pais objetivo de lanzamiento inicial.
- Publico permitido: mayores de edad, publico general o tambien menores.
- Proveedor IA principal para produccion.
- Nivel de retencion de logs.
- Si habra cuentas de usuario en v1 o despues.
- Quien revisara reportes doctrinales sensibles.

## Definicion de listo para Play Store

Theos estara listo para enviar a revision cuando:

- El usuario pueda reportar contenido generado por IA dentro de la app.
- El cliente no exponga ni solicite API keys en produccion.
- Las politicas legales esten alineadas con Data Safety.
- Existan limites de abuso y costo.
- La app tenga PWA completa y TWA validada con Digital Asset Links.
- Haya pruebas basicas automatizadas y evaluaciones doctrinales.
- Se haya realizado beta cerrada con usuarios reales.
- Exista runbook para incidentes y operacion.

