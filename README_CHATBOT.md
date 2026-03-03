# Chatbot híbrido (Web + WhatsApp) con memoria y recordatorios

## Variables de entorno

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional, default `gpt-5-mini`)
- `HUMAN_SUPPORT_PHONE_E164`
- `HUMAN_SUPPORT_WHATSAPP_LINK`
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
- no hay respuesta segura (ej. alérgenos no presentes o pedido ambiguo)

Cuando hay handoff, el bot se pausa 2h (`bot_paused_until`).

## Recordatorios

- Al crear pedido con fecha por defecto (+3 días): `reminder_at = created_at + 48h`.
- Al crear pedido con fecha explícita: `reminder_at = delivery_date (hora de creación) - 24h`.
- Se guarda `reminder_status='pending'` y el cron marca `sent` o `failed`.

## WhatsApp y ventana de 24h

- Dentro de 24h se puede responder con texto libre.
- Fuera de 24h se requiere **template** de WhatsApp.
- Los recordatorios usan template (`WHATSAPP_TEMPLATE_REMINDER_NAME`).

## Vercel Cron

Se añadió `vercel.json` para ejecutar cada 15 minutos:
- path: `/api/cron/send-reminders?secret=CRON_SECRET`

Recomendación: en producción usar header `x-cron-secret` desde el scheduler si está disponible.
