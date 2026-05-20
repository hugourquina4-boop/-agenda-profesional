# Salón Pro — Guía de Publicación en Play Store (TWA)

**Estado:** Listo para ejecutar cuando tengas los 5 clientes pagando.
**Tiempo estimado:** 2–4 horas (más 3–7 días de revisión de Google).
**Costo:** USD $25 única vez (cuenta de desarrollador Google Play).

---

## Prerequisitos (ya están listos ✅)

- [x] PWA válida con `manifest.json` en producción
- [x] Service worker activo (`/sw.js`)
- [x] `start_url`, `scope`, `display: standalone` configurados
- [x] Icono `maskable` 512×512 en `/logo512.png`
- [x] `/.well-known/assetlinks.json` en producción (falta SHA-256)
- [x] `https://` con certificado válido (Vercel lo gestiona)

---

## PASO 1 — Instalar Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

Bubblewrap es el CLI oficial de Google para generar APKs TWA desde una PWA.

---

## PASO 2 — Inicializar el proyecto TWA

Crea una carpeta fuera del repo de Salón Pro:

```bash
mkdir salon-pro-android
cd salon-pro-android
bubblewrap init --manifest https://project-gnyy8.vercel.app/manifest.json
```

Bubblewrap te hará preguntas. Usa estos valores:

| Campo | Valor |
|-------|-------|
| Application ID | `com.salonpro.app` |
| App name | `Salón Pro` |
| Short name | `Salón Pro` |
| Host | `project-gnyy8.vercel.app` |
| Start URL | `/salon` |
| Version code | `1` |
| Version name | `1.0.0` |
| Signing key | Genera uno nuevo cuando pregunte |

**Guarda la contraseña del keystore en un lugar seguro.**  
El archivo `.keystore` que genera es irreemplazable — si lo pierdes, no puedes actualizar la app en Play Store.

---

## PASO 3 — Obtener el SHA-256 del keystore

```bash
keytool -list -v -keystore <nombre>.keystore
```

Copia el valor de **SHA-256 Certificate Fingerprints**, que tiene este formato:
```
A1:B2:C3:D4:E5:F6:...
```

---

## PASO 4 — Actualizar assetlinks.json

Edita el archivo `public/.well-known/assetlinks.json` en el repo:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.salonpro.app",
    "sha256_cert_fingerprints": [
      "A1:B2:C3:D4:E5:F6:..."  ← pega aquí el SHA-256 del paso 3
    ]
  }
}]
```

Luego despliega:

```bash
cd "d:\Proyectos antrigravity\AGENDAS\agenda-saas-v2"
git add public/.well-known/assetlinks.json
git commit -m "twa: SHA-256 fingerprint en assetlinks"
npx vercel deploy --prod --yes
```

Verifica en el navegador que esta URL responde con el JSON correcto:
```
https://project-gnyy8.vercel.app/.well-known/assetlinks.json
```

---

## PASO 5 — Compilar el APK

```bash
cd salon-pro-android
bubblewrap build
```

Genera `app-release-signed.apk` en la carpeta `build/`.

---

## PASO 6 — Crear la app en Google Play Console

1. Ve a [play.google.com/console](https://play.google.com/console) y paga los USD $25.
2. Crea app → **Aplicación** → **Android** → **Gratis** (o de pago).
3. Nombre: `Salón Pro`
4. Idioma predeterminado: `Español (Latinoamérica)`

---

## PASO 7 — Subir el APK

1. Play Console → Tu app → **Producción** → **Crear nueva versión**
2. Sube `app-release-signed.apk`
3. Completa los metadatos requeridos:

| Campo | Valor sugerido |
|-------|----------------|
| Descripción corta | Gestión completa para salones de belleza y barberías |
| Descripción larga | (describe los módulos: agenda, caja, clientes, equipo...) |
| Capturas de pantalla | Mínimo 2 screenshots del app (usa Chrome DevTools mobile view) |
| Ícono de la app | `logo512.png` del repo |
| Categoría | Negocios |
| Clasificación de contenido | Todos |
| Política de privacidad | URL a una página de política (puedes crear una simple) |

---

## PASO 8 — Revisión y publicación

- Google tarda **3 a 7 días hábiles** en revisar apps nuevas.
- Si rechazan por alguna política, corrigen → suben nueva versión.
- Una vez aprobada, aparece en Play Store con el link:
  `https://play.google.com/store/apps/details?id=com.salonpro.app`

---

## Actualizaciones futuras

Cada vez que hagas un deploy importante a Vercel, la TWA actualiza automáticamente el contenido (porque apunta a tu URL). Solo necesitas subir un nuevo APK cuando cambies metadatos de Play Store o la versión del manifiesto Android.

---

## Notas técnicas

- La TWA abre la URL de Salón Pro en Chrome pero sin la barra de navegación — se ve 100% nativa.
- El SHA-256 en `assetlinks.json` vincula tu dominio con el APK específico — sin él, la app muestra la barra del navegador (no es nativa).
- Guarda el archivo `.keystore` y su contraseña fuera del repo (no commitear nunca).
