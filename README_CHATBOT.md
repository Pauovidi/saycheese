# Chatbot híbrido (Web + WhatsApp)

## Variables de entorno

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opcional, default: `gpt-5-mini`)
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`

## Endpoints

- `POST /api/chat`
  - Input: `{ sessionId, message, phone? }`
  - Usa OpenAI Responses API + tools para:
    - `get_store_hours`
    - `get_flavors_and_sizes`
    - `get_product_info`
    - `create_order`
    - `cancel_order`

- `GET /api/whatsapp/webhook`
  - Verificación Meta: valida `hub.verify_token` contra `WHATSAPP_VERIFY_TOKEN`
  - Responde con `hub.challenge`

- `POST /api/whatsapp/webhook`
  - Recibe evento WhatsApp Cloud API
  - Extrae texto y `wa_id/from`
  - Reutiliza el mismo motor de chat (`handleMessage`)
  - Envía respuesta con Graph API `/{WHATSAPP_PHONE_NUMBER_ID}/messages`

## Notas de WhatsApp Cloud API

- Dentro de la ventana de 24h se permite responder con texto libre.
- Fuera de 24h Meta exige plantillas (`templates`).
- En esta v1 solo se implementa respuesta libre dentro de ventana.

## Fuente de productos y alérgenos

- Fuente de verdad: `src/data/products.ts`.
- El bot no debe inventar alérgenos.
- Si no hay info explícita en la descripción del producto, responde: `no lo veo en la ficha`.
