# Postman — API Store (proveedor)

**Base URL:** `http://localhost:3000/api`  
**Prefijo store:** `p/v1/store` → rutas completas: `http://localhost:3000/api/p/v1/store/...`

---

## Variables de entorno (Postman)

| Variable   | Ejemplo              | Uso                          |
|-----------|----------------------|------------------------------|
| `host`    | `http://localhost:3000` | Base sin `/api` (opcional) |
| `baseUrl` | `http://localhost:3000/api` | Todas las rutas |
| `token`   | `eyJhbGciOiJIUzI1NiIs...`   | JWT del login |
| `storeId` | `507f1f77bcf86cd799439011` | Id de la store (después de crear perfil) |

En la pestaña **Authorization** de la colección puedes usar **Bearer Token** → `{{token}}`.

---

## Auth

- **Normal:** header `Authorization: Bearer {{token}}`
- **Desarrollo** (si en `.env` tienes `ENABLE_DEV_AUTH_BYPASS=true` y `NODE_ENV` ≠ production): puedes llamar **sin** JWT; el backend usa el usuario dev. Opcional: header `x-dev-bypass: true`

---

## 1. Listar todas las stores

**GET** `{{baseUrl}}/p/v1/store`

- Sin body.

---

## 2. Crear perfil de store (inicio funnel)

**POST** `{{baseUrl}}/p/v1/store/profile`

**Headers:** `Content-Type: application/json`

**Body (raw JSON):**

```json
{
  "name": "Mi Tienda",
  "country": "AR",
  "address": "Calle 123",
  "cellPhone": "+5491112345678"
}
```

**Respuesta:** incluye `id` de la store → copialo a `{{storeId}}`.

> Nota: el query `?steep=profile` del diseño antiguo ya no aplica aquí; el body va directo.

---

## 3. Reenviar código SMS (celular)

**POST** `{{baseUrl}}/p/v1/store/{{storeId}}/cell-verification/resend`

- Sin body.

---

## 4. Validar código de celular

**POST** `{{baseUrl}}/p/v1/store/{{storeId}}/cell-verification`

**Body (raw JSON):**

```json
{
  "code": "123456"
}
```

---

## 5. Subir avatar

**POST** `{{baseUrl}}/p/v1/store/{{storeId}}/avatar`

- **Body:** `form-data`
- Key: `avatar` → tipo **File** (elegí una imagen jpg/png/webp/gif)
- No pongas `Content-Type` a mano; Postman lo arma con el boundary.

---

## 6. Configurar delivery (horarios)

**POST** `{{baseUrl}}/p/v1/store/{{storeId}}/delivery`

**Headers:** `Content-Type: application/json`

### Opción A — Horario por días (índices → `timeRanges`)

```json
{
  "available": true,
  "timeRanges": [
    "7:30-9:30",
    "12:30-14:00",
    "17:30-19:00",
    "10:00-15:00"
  ],
  "days": {
    "mon": [0, 1, 2],
    "tue": [0, 1],
    "sat": [3]
  }
}
```

### Opción B — 24/7 (sin rangos por día)

```json
{
  "available": true,
  "available24h": true
}
```

---

## 7. Eliminar store

**DELETE** `{{baseUrl}}/p/v1/store/{{storeId}}`

- Sin body.

---

## Colección rápida (importar en Postman)

1. Creá una **Collection** "Baby Go Provider".
2. En **Variables** de la colección: `baseUrl` = `http://localhost:3000/api`, `storeId` vacío al inicio.
3. Duplicá requests cambiando solo método + path según arriba.
4. Después del **POST profile**, guardá el `id` del JSON en `storeId`.

### URLs en una línea (copiar/pegar)

```
GET    http://localhost:3000/api/p/v1/store
POST   http://localhost:3000/api/p/v1/store/profile
POST   http://localhost:3000/api/p/v1/store/{{storeId}}/cell-verification/resend
POST   http://localhost:3000/api/p/v1/store/{{storeId}}/cell-verification
POST   http://localhost:3000/api/p/v1/store/{{storeId}}/avatar
POST   http://localhost:3000/api/p/v1/store/{{storeId}}/delivery
DELETE http://localhost:3000/api/p/v1/store/{{storeId}}
```

---

## Obtener JWT (si no usás bypass)

Si tenés endpoint de login en tu `auth` (Google/JWT propio), usá ese para rellenar `{{token}}`. El guard espera:

`Authorization: Bearer <access_token>`
