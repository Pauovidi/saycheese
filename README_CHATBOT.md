# Chatbot híbrido (Web + WhatsApp) con memoria y recordatorios

## Variables de entorno

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional, default `gpt-5-mini`)
- `HUMAN_SUPPORT_PHONE_E164`
- `HUMAN_SUPPORT_WHATSAPP_LINK`
- BOT_WHATSAPP_LINK (CTA móvil a WhatsApp)
- NEXT_PUBLIC_BOT_WHATSAPP_LINK (opcional para cliente web)
- `CRON_SECRET`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_TEMPLATE_REMINDER_NAME` (ej: `order_reminder_24h`)
- `WHATSAPP_TEMPLATE_LANG` (ej: `es_ES`)
- `TWILIO_AUTH_TOKEN` (opcional, para validar firma del webhook)
- `TWILIO_VALIDATE_SIGNATURE` (opcional, usar `true` para exigir firma válida)
- `YCLOUD_API_KEY` (nuevo, para envío saliente por API de YCloud)
- `YCLOUD_PHONE_NUMBER` (nuevo, número de negocio YCloud en formato E.164, se envía como `from`)
- `YCLOUD_WEBHOOK_SECRET` (opcional, para validar `YCloud-Signature`)
- `YCLOUD_VALIDATE_SIGNATURE` (opcional, usar `true` para exigir firma válida)
- `YCLOUD_SIGNATURE_TOLERANCE_SECONDS` (opcional, default `300`)
- `YCLOUD_API_BASE_URL` (opcional, default `https://api.ycloud.com/v2`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

## Endpoints

- `POST /api/chat`: chat web con motor único y memoria persistente.
- `GET /api/whatsapp/webhook`: verificación Meta (`hub.verify_token` + `hub.challenge`).
- `POST /api/whatsapp/webhook`: recibe mensaje, reutiliza `handleMessage`, responde por Graph API.
- `POST /api/twilio/whatsapp`: webhook inbound de Twilio WhatsApp (`application/x-www-form-urlencoded`), reutiliza `handleMessage` y responde TwiML.
- `POST /api/ycloud/whatsapp`: webhook inbound de YCloud WhatsApp (`application/json`), reutiliza `handleMessage`, responde `200`/JSON y envía la contestación por la API saliente de YCloud.
- `GET /api/cron/send-reminders`: envío de recordatorios por plantilla WhatsApp, protegido por `CRON_SECRET`.

## Integraciones WhatsApp

- Meta Cloud API usa `/api/whatsapp/webhook`.
- Twilio WhatsApp usa `/api/twilio/whatsapp`.
- YCloud WhatsApp usa `/api/ycloud/whatsapp`.
- El endpoint de Twilio responde TwiML, no intenta parsear JSON y reutiliza el mismo motor conversacional del chat web.
- La validación de firma de Twilio queda preparada y solo se exige si `TWILIO_VALIDATE_SIGNATURE=true`.
- YCloud funciona en paralelo a Twilio y reutiliza el mismo `handleMessage()` con `channel: "whatsapp"` para mantener la misma memoria/persistencia entre canales WhatsApp.
- El webhook de YCloud espera eventos `whatsapp.inbound_message.received` con objeto `whatsappInboundMessage`; por ahora el adaptador procesa de forma explícita mensajes `type: "text"` y marca el resto como `skipped`.
- YCloud no usa TwiML: el webhook responde `200` y el reply se envía por `POST https://api.ycloud.com/v2/whatsapp/messages/sendDirectly` con `X-API-Key`.
- La validación de firma de YCloud queda preparada con `YCloud-Signature: t=...,s=...` usando HMAC-SHA256 sobre `${timestamp}.${rawBody}`; solo se exige si `YCLOUD_VALIDATE_SIGNATURE=true`.

## Twilio vs YCloud

- Twilio inbound: `application/x-www-form-urlencoded`, ruta `/api/twilio/whatsapp`, firma `x-twilio-signature`, respuesta TwiML.
- YCloud inbound: `application/json`, ruta `/api/ycloud/whatsapp`, firma `YCloud-Signature`, respuesta JSON + envío saliente por API.
- Ambas integraciones comparten exactamente el motor conversacional `lib/chatbot/engine.ts -> handleMessage()`.
- No se ha tocado el webhook actual de Meta ni la ruta de Twilio.

## Payload asumido de YCloud

Basado en la documentación oficial de YCloud, el adaptador actual espera este patrón mínimo:

```json
{
  "id": "evt_123",
  "type": "whatsapp.inbound_message.received",
  "apiVersion": "v2",
  "createTime": "2023-02-22T12:00:00.000Z",
  "whatsappInboundMessage": {
    "id": "63f71fb8741c165b434292fb",
    "wamid": "wamid.HBgNOD...",
    "from": "+34123456789",
    "to": "+34987654321",
    "type": "text",
    "text": {
      "body": "Hola"
    }
  }
}
```

Campos que se usan:
- texto: `whatsappInboundMessage.text.body`
- remitente: `whatsappInboundMessage.from`
- id de mensaje: `whatsappInboundMessage.wamid` o `whatsappInboundMessage.id`

Eventos no soportados por ahora:
- `request_welcome`
- `order`
- `system`
- otros tipos distintos de `text`

Todos ellos responden `200` con `skipped: true` para no romper la entrega del webhook.

## Ejemplo de prueba local YCloud

```bash
curl -X POST http://localhost:3000/api/ycloud/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt_local_text_001",
    "type": "whatsapp.inbound_message.received",
    "apiVersion": "v2",
    "createTime": "2026-03-26T10:00:00.000Z",
    "whatsappInboundMessage": {
      "id": "inb_local_001",
      "wamid": "wamid.local.001",
      "wabaId": "waba_local",
      "from": "+34600111222",
      "customerProfile": {
        "name": "Prueba"
      },
      "to": "+34900111222",
      "sendTime": "2026-03-26T10:00:00.000Z",
      "type": "text",
      "text": {
        "body": "Hola, quiero una tarta de pistacho para el sábado"
      }
    }
  }'
```

Si quieres probar firma HMAC:
- activa `YCLOUD_VALIDATE_SIGNATURE=true`
- usa `YCLOUD_WEBHOOK_SECRET`
- firma el `raw body` como `${timestamp}.${rawBody}` y envía `YCloud-Signature: t=<unix>,s=<hex>`

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
- el usuario pregunta por stock real del momento (`hoy`, `ahora`, `en tienda`), porque no hay control de existencias en tiempo real
- no hay respuesta segura (ej. alérgenos no presentes o pedido ambiguo)

El handoff actual es blando: ofrece contacto humano en ese turno, pero no bloquea las consultas normales siguientes.
`bot_paused_until` queda reservado para futuros takeovers duros explícitos si hicieran falta.

## Disponibilidad del día

- El bot diferencia entre catálogo general (sabores, tamaños, precios, horario) y consultas de disponibilidad inmediata.
- Para preguntas de stock actual no confirma existencias exactas: indica que normalmente puede haber stock diario en tienda hasta agotar existencias, recomienda reservar con antelación y ofrece pasar con una persona.
- Los saludos simples como `hola` devuelven la bienvenida comercial actual también en el motor compartido, por lo que el copy queda alineado entre web y WhatsApp.

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

