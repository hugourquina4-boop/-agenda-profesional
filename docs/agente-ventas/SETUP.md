# Agente de Ventas Salón Pro — Guía de Activación

Tiempo estimado: 20–30 minutos.

---

## Requisitos previos

| Qué | Dónde conseguirlo |
|-----|-------------------|
| API Key de Anthropic | console.anthropic.com → API Keys |
| Token de Whapi | panel.whapi.cloud → Tu canal → API Token |
| URL pública de tu n8n | La URL que ya tienes (ej: https://n8n.tudominio.com) |
| Tu número de Hugo en formato WA | `573XXXXXXXXX@s.whatsapp.net` |

---

## Paso 1 — Importar el workflow en n8n

1. Abre tu n8n
2. Menú lateral → **Workflows** → **Import from file**
3. Selecciona `docs/agente-ventas/n8n-workflow.json`
4. El workflow aparece con 9 nodos conectados

---

## Paso 2 — Configurar credenciales

### Anthropic API Key

1. En n8n: Settings → **Credentials** → New
2. Tipo: `Header Auth`
3. Name: `Anthropic API Key`
4. Header Name: `x-api-key`
5. Header Value: `sk-ant-api03-...` (tu key de console.anthropic.com)

### Whapi API Token

1. En n8n: Settings → **Credentials** → New
2. Tipo: `Header Auth`
3. Name: `Whapi API Token`
4. Header Name: `token`
5. Header Value: El token de tu canal en panel.whapi.cloud

---

## Paso 3 — Configurar el nodo "Notificar a Hugo"

Abre el nodo **Notificar a Hugo** y reemplaza:
```
573XXXXXXXXX@s.whatsapp.net
```
Con tu número en formato: `573001234567@s.whatsapp.net`

---

## Paso 4 — Activar el workflow y obtener la URL del webhook

1. Activa el workflow (toggle en la esquina superior derecha)
2. Haz clic en el nodo **Webhook Whapi**
3. Copia la **Production URL** — algo como:
   ```
   https://n8n.tudominio.com/webhook/salonpro-ventas
   ```

---

## Paso 5 — Configurar el webhook en Whapi

1. Ve a panel.whapi.cloud → Tu canal → **Webhooks**
2. Agrega webhook:
   - URL: la que copiaste en el paso 4
   - Eventos a activar: ✅ **messages** (incoming)
3. Guarda

---

## Paso 6 — Probar

Desde un número diferente al tuyo, escribe al número de WhatsApp Business de Salón Pro:
```
Hola, me interesa el sistema para mi peluquería
```

En 5–10 segundos debería llegar la respuesta del agente.

---

## Personalizar el system prompt

El conocimiento del agente está en el nodo **"Cargar system prompt"**. El texto completo y estructurado está en `docs/agente-ventas/system-prompt.md`.

Para actualizar el prompt:
1. Abre `system-prompt.md` y edita
2. Copia el bloque de texto (sin el frontmatter `---`)
3. Pégalo en la variable `systemPrompt` del nodo Code

---

## Cómo ve los leads Hugo

Cuando el agente detecta que alguien está calificado (tiene negocio real, pregunta precio), Hugo recibe un WhatsApp automático:

```
🔔 Nuevo lead calificado

Teléfono: 573001234567
Datos: nombre=Carolina, negocio=Peluquería Estilo, ciudad=Medellín, estado=CALIFICADO

Revisa y dale seguimiento.
```

---

## Modelo recomendado: Claude Haiku

El workflow usa `claude-haiku-4-5-20251001` — el modelo más rápido y económico.
- Costo estimado: ~$0.002 USD por conversación completa
- Latencia: 1–3 segundos por respuesta
- Para respuestas más elaboradas, cambia a `claude-sonnet-4-6`

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| No llega respuesta al WhatsApp | Revisar que el webhook en Whapi apunta a la URL correcta |
| Error 401 en Claude API | Verificar que la credential `Anthropic API Key` tiene el header name `x-api-key` |
| Error 401 en Whapi | Verificar que la credential `Whapi API Token` tiene el header name `token` |
| Respuestas sin contexto | El historial se reinicia al reiniciar n8n — es normal con `staticData` local |
| El agente no detecta leads | Verificar que el system prompt incluye la instrucción del tag `[LEAD:]` |

---

## Siguiente mejora: pipeline de leads

Cuando el agente marca un lead calificado, puedes agregar un nodo **Airtable** o **Google Sheets** para guardarlo automáticamente:

```
Notificar a Hugo → Crear registro en Airtable
                    (nombre, teléfono, negocio, ciudad, fecha, estado=INTERESADO)
```

Dile a Claude Code "agrega el nodo de Airtable al workflow de ventas" cuando estés listo.
