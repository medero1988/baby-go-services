# Baby Go — Postman (contrato para front)

Importá las 6 collections + el environment `Baby-Go.postman_environment.json`.

**Base URL:** `{{baseUrl}}` = `http://localhost:3000/api`  
Rutas reales: `http://localhost:3000/api/v1/...`

**Auth:** `Authorization: Bearer {{token}}` (collection auth). Los requests marcados *público* tienen auth `noauth`.

**Errores:** Nest `BadRequestException` / `NotFoundException`:

```json
{ "statusCode": 400, "error": "title_not_available", "message": "..." }
```

Campos extra en el body → **400** (whitelist). Fechas de oferta: `YYYY-MM-DD` o `DD/MM/YYYY`. Montos de store/pagos en **centavos** salvo `product.price` / `bundle.price` (euros por día, número).

Hoy **no hay `role` en el usuario**. Provider vs client se infiere por el flujo (store/productos = provider). No mandes `role` en create account.

---

## Collections

| Archivo | Para quién | Prefijo |
|---|---|---|
| `baby-go-auth.postman_collection.json` | todos | `/v1/auth` |
| `baby-go-settings.postman_collection.json` | app (configs por code) | `/v1/settings` |
| `baby-go-provider-store.postman_collection.json` | provider — funnel tienda | `/v1/store` |
| `baby-go-provider-products.postman_collection.json` | provider — catálogo | `/v1/products` |
| `baby-go-provider-bundles.postman_collection.json` | provider — combos | `/v1/bundles` |
| `baby-go-payments.postman_collection.json` | client — Stripe | `/v1/payments` |

Orden de montaje provider: **Auth → Store → Products → Bundles**. Settings GET es público (picker de país/tel).

---

## Auth `/v1/auth`

Públicos: `POST /account`, `/email-verification`, `/resend-email-code`, `/login`, `/access-refresh`, `/password-recovery`, `/resend-password-recovery`, `/new-password`, `/google`, `/facebook`.  
JWT: `GET/DELETE /account`, `POST /logout`.

Create account body: `{ name, lastName, email, password }` (password ≥ 8). Respuesta `{ id, name, lastName, email, emailVerified }`. Copiá `id` → `accountId`.

Login: `{ email, password }` → `{ accessToken, refreshToken, expiresAt, user }`. Guardá tokens.

Errores: `email_already_registered`, `invalid_credentials`, `email_not_verified`, `invalid_code`, `code_expired`, `account_not_found`, `invalid_refresh_token`, `expired_refresh_token`.

---

## Settings `/v1/settings`

Documentos `{ code, value }` (JSON libre). El seeder crea `supported-countries`.

- `GET /v1/settings` público → `{ items: [{ id, code, value, createdAt, updatedAt }] }`
- `GET /v1/settings/:code` público → un setting. 404 `settings_not_found`
- `POST /v1/settings` JWT → `{ code, value }`. 409 `settings_code_exists`
- `PATCH /v1/settings/:code` JWT → `{ value }` (reemplaza el JSON)

Países: `GET /v1/settings/supported-countries` → `value: [{ code, phoneCode }]`.

---

## Store `/v1/store` (1:1, sin `storeId` en URL)

Flujo: `POST /profile` → cell → avatar → delivery → delivery-pricing → customer-pickup → bank-account → confirmation → Stripe Connect.

`meta.state`: `missing-info` | `pending-review` | `active`.  
`meta.lastSteep`: último paso del funnel.

Avatar: `multipart/form-data` field **`avatar`** tipo File. URL Cloudinary en `store.avatar`.

Delivery `days.*.n` son **índices** de `timeRanges` (máx 3 por día). Pickup máx 2. Precios delivery en **centavos**.

Confirmación: `{ "acceptedTerms": true }`. Requiere cell validado + bank.

---

## Products `/v1/products`

Create (draft): `{ category, title, description, price, attributes? }`.  
`title` único por provider (case-insensitive) → `title_not_available`.

List: `GET /v1/products?page=1&limit=20&status=&category=` → `{ items, page, limit, total, totalPages }`. Default page=1, limit=20, máx 100.

PATCH parcial: `title`, `description`, `category`, `price` (merge; `offer: null` saca oferta), `attributes` (merge; key `null` borra), `status`. Fotos **no** van en PATCH.

Medias: `POST /:id/medias` form-data field **`media`** (File). Máx 8, 5MB, png/jpeg/webp/gif. Respuesta:

```json
{
  "id": "...",
  "url": "https://res.cloudinary.com/...",
  "width": 700, "height": 700, "format": "jpg", "bytes": 41179,
  "urls": { "original": "...", "thumbnail": "...", "card": "...", "detail": "..." }
}
```

`POST /:id/save` → `active`. Completitud: title, description, category, `price.list > 0`, attributes con valor, ≥1 media. Si falta: `product_incomplete` + `missing: []`.

---

## Bundles `/v1/bundles`

Create: `{ products: [id, id, ...], title, description, price }`. Mín 2, máx 10, ids propios únicos.  
`category` lo arma el BE: `["bundle", ...categorías de los productos]`.

List paginado igual que products. GET/list expanden `products` (objeto producto, no solo id).

PATCH: `products`, `title`, `description`, `price`, `status`. Recalcula `category` si cambian products.

`POST /:id/save` exige productos **`active`**. Errores: `bundle_incomplete`, `products_not_found`, `products_not_active`, `title_not_available`.

DELETE borra el bundle, no los productos.

---

## Payments (cliente) `/v1/payments`

`amount` en centavos. Body: `{ storeId, amount, orderId?, currency? }`.  
Respuesta incluye `clientSecret` + `publishableKey` para Stripe.js.  
`confirm-test` solo dev. Transfer al terminar el alquiler.

Webhook: no desde Postman; Stripe CLI → `/api/webhooks/stripe`.
