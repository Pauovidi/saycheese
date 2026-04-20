# Chatbot híbrido (Web + WhatsApp) con memoria y recordatorios

## Fuente única de negocio

La fuente de verdad operativa vive en `src/data/business.ts`.

- `HUMAN_SUPPORT_PHONE_RAW = 681147149`
- `HUMAN_SUPPORT_PHONE_E164 = +34681147149`
- `HUMAN_SUPPORT_WHATSAPP_LINK = https://wa.me/34681147149`
- `PICKUP_ONLY_COPY = "Solo recogida en tienda. No hacemos envíos."`
- labels customer-facing de tamaños:
  - `tarta` interna -> `grande`
  - `cajita` interna -> `cajita`
- horario unificado:
  - Miércoles: 16:30–20:30
  - Jueves: 16:30–20:30
  - Viernes: 16:30–20:30
  - Sábado: 10:00–14:00 y 16:30–20:30
  - Domingo: 10:00–14:00
  - Lunes y martes: cerrado

Chatbot web, webhook de WhatsApp, FAQ y CTAs reutilizan esa misma fuente.

## Variables de entorno

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional, default `gpt-5-mini`)
- `CRON_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_TEMPLATE_REMINDER_NAME` (ej: `order_reminder_24h`)
- `WHATSAPP_TEMPLATE_LANG` (ej: `es_ES`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

## Endpoints

- `POST /api/chat`: chat web con motor único y memoria persistente.
- `GET /api/whatsapp/webhook`: verificación Meta (`hub.verify_token` + `hub.challenge`).
- `POST /api/whatsapp/webhook`: recibe mensaje, reutiliza `handleMessage`, responde por Graph API.
- `GET /api/cron/send-reminders`: envío de recordatorios por plantilla WhatsApp, protegido por `CRON_SECRET`.

## Memoria persistente

Se guarda en Supabase con:
- `chat_users`
- `chat_messages`
- `chat_user_state` (`summary`, `bot_paused_until`, `last_openai_response_id`)

El motor carga summary + últimos 20 mensajes antes de llamar a OpenAI.
Cuando la conversación crece, genera resumen y poda mensajes antiguos.

## Handoff a humano

Hay tool `handoff_to_human`.
Además se activa automáticamente si:
- el usuario lo pide explícitamente (humano/persona/agente)
- no hay respuesta segura (ej. alérgenos/ingredientes sin dato confirmado o pedido ambiguo)

El handoff siempre devuelve:
- WhatsApp: `https://wa.me/34681147149`
- Teléfono visible: `+34681147149`

Cuando hay handoff, el bot se pausa 2h (`bot_paused_until`).

## Datos de producto: alérgenos e ingredientes

- El bot resuelve sabores contra `src/data/products.ts`.
- Los alérgenos confirmados salen del campo estructurado `allergens` del producto/familia de sabor.
- Los ingredientes solo se responden si existe dato estructurado confirmado en esa misma fuente.
- Si el producto no tiene ese dato confirmado, el bot no inventa y deriva a humano con el handoff anterior.
- El matching de sabores prioriza slug/nombre/categoría y evita depender del orden `cajita`/`tarta` en el array.

## Recordatorios

- Al crear pedido con fecha por defecto (+3 días): `reminder_at = created_at + 48h`.
- Al crear pedido con fecha explícita: `reminder_at = delivery_date (hora de creación) - 24h`.
- Se guarda `reminder_status='pending'` y el cron marca `sent` o `failed`.

## WhatsApp y ventana de 24h

- Dentro de 24h se puede responder con texto libre.
- Fuera de 24h se requiere **template** de WhatsApp.
- Los recordatorios usan template (`WHATSAPP_TEMPLATE_REMINDER_NAME`).
- El texto visible del recordatorio no vive en el repo: debe configurarse en la plantilla aprobada de WhatsApp con el copy de negocio o equivalente validado.

## Vercel Cron

Se añadió `vercel.json` para ejecutar cada 15 minutos:
- path: `/api/cron/send-reminders`

En producción, Vercel enviará `Authorization: Bearer ${CRON_SECRET}` si `CRON_SECRET` está configurado en el proyecto. La ruta también acepta `x-cron-secret` o `?secret=` para pruebas manuales.
