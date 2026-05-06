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
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (ej: `whatsapp:+14155238886` en sandbox o el remitente WhatsApp aprobado en producción)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

Para confirmaciones outbound de pedidos web por Twilio se acepta también `TWILIO_WHATSAPP_NUMBER` o `TWILIO_MONITOR_FROM` como fallback del remitente, pero `TWILIO_WHATSAPP_FROM` es la variable recomendada. Si falta cualquier variable Twilio, el pedido se confirma igual y se registra `whatsapp_confirmation_skipped_disabled`.

## Endpoints

- `POST /api/chat`: chat web con motor único y memoria persistente.
- `GET /api/whatsapp/webhook`: verificación Meta (`hub.verify_token` + `hub.challenge`).
- `POST /api/whatsapp/webhook`: recibe mensaje, reutiliza `handleMessage`, responde por Graph API.
- `GET/POST /api/twilio/whatsapp`: webhook inbound Twilio WhatsApp; mantiene el canal `whatsapp`.
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
- Cuando el chatbot web crea un pedido con teléfono, se envía una confirmación outbound por Twilio con sabor, formato, fecha/plazo y recogida en tienda.
- La idempotencia se guarda en `whatsapp_confirmation_sends` por `order_id`, así un retry o refresco no manda duplicados.

## Vercel Cron

Se añadió `vercel.json` para ejecutar cada 15 minutos:
- path: `/api/cron/send-reminders`

En Vercel, `CRON_SECRET` se envía automáticamente por `Authorization: Bearer <CRON_SECRET>`.
Para pruebas manuales se mantiene compatibilidad con `x-cron-secret` y `?secret=...`.
