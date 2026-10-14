# Baby Go — Postman (contrato para front)

Importá las 9 collections + el environment `Baby-Go.postman_environment.json`.

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
| `baby-go-client-search.postman_collection.json` | client — catálogo | `/v1/search` |
| `baby-go-client-cart.postman_collection.json` | client — carrito | `/v1/cart` |
| `baby-go-admin.postman_collection.json` | admin de la app — API key | `/v1/admin` |

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

Documentos `{ code, value }` (JSON libre). El seeder crea `supported-countries` y `product-taxonomy`.

- `GET /v1/settings` público → `{ items: [{ id, code, value, createdAt, updatedAt }] }`
- `GET /v1/settings/:code` público → un setting. 404 `settings_not_found`
- `POST /v1/settings` JWT → `{ code, value }`. 409 `settings_code_exists`
- `PATCH /v1/settings/:code` JWT → `{ value }` (reemplaza el JSON)

Países: `GET /v1/settings/supported-countries` → `value: [{ code, phoneCode }]`.  
Catálogo de productos: `GET /v1/settings/product-taxonomy` → `value: { families: [{ id, label, description, categories: [{ id, label, attributes }] }] }`. El front arma el alta de producto con ese JSON. Para cambiar familias/categorías/atributos: `PATCH /v1/settings/product-taxonomy` con el `value` completo.

---

## Store `/v1/store` (1:1, sin `storeId` en URL)

Flujo: `POST /profile` → cell → avatar → delivery → delivery-pricing → customer-pickup → Stripe Connect (`POST /stripe-connect/account-link`, onboarding hosted: KYC + cuenta bancaria) → confirmation.

Los datos bancarios solo se cargan en el formulario de Stripe; la API no los recibe ni los guarda. Estado: `stripeConnect.{detailsSubmitted, payoutsEnabled, transfersEnabled, onboardingComplete}` (se sincroniza por webhook `account.updated` o `GET /stripe-connect/status`).

`meta.state`: `missing-info` | `pending-review` | `active`.  
`meta.lastSteep`: último paso del funnel.

Avatar: `multipart/form-data` field **`avatar`** tipo File. Cloudinary como product medias; `avatar` responde `{ url, urls: { original, thumbnail, card, detail }, ... }`.

Delivery `days.*.n` son **índices** de `timeRanges` (máx 3 por día). Pickup máx 2. Precios delivery en **centavos**.

Confirmación: `{ "acceptedTerms": true }`. Requiere cell validado + `stripeConnect.detailsSubmitted` (error `stripe_onboarding_required`).

---

## Products `/v1/products`

Create (`in_review`; un admin lo pasa a `available` con `/v1/admin/.../approve`): `{ category, title, description, price, attributes? }`.  
`title` único por provider (case-insensitive) → `title_not_available`.

List: `GET /v1/products?page=1&limit=20&status=&category=` → `{ items, page, limit, total, totalPages }`. Default page=1, limit=20, máx 100.

`DELETE /v1/products/:id` borra el producto, sus fotos del bucket y lo saca de sus bundles (borra bundles con <2 productos). Respuesta `{ success: true }`. 404 `product_not_found`. Si está `rented` → 409 `{ error: 'product_rented', message: 'A rented product cannot be deleted' }` y no se borra nada.

`DELETE /v1/products` borra todos los productos del provider, sus fotos del bucket y todos sus bundles. Respuesta `{ success: true, deleted }`.

PATCH parcial: `title`, `description`, `category`, `price` (merge; `offer: null` saca oferta), `attributes` (merge; key `null` borra), `status`. Cambiar título, descripción, categoría, atributos o fotos (`POST`/`PUT`/`DELETE` medias) devuelve el producto a `in_review`. El precio no. Los bundles `available` que lo incluyen también pasan a `in_review`.

Status: `available | rented | in_review | inactive`. Solo `available` aparece en la búsqueda de clientes. El provider puede alternar `available` ↔ `inactive` con un PATCH que solo manda `status`; desde `in_review`/`rented` → 400 `invalid_status_transition`.

Fotos **no** van en PATCH.

Medias: `POST /:id/medias` form-data field **`media`** (File). Máx 8, 5MB, png/jpeg/webp/gif. Respuesta:

```json
{
  "id": "...",
  "url": "https://res.cloudinary.com/...",
  "width": 700, "height": 700, "format": "jpg", "bytes": 41179,
  "urls": { "original": "...", "thumbnail": "...", "card": "...", "detail": "..." }
}
```


---

## Bundles `/v1/bundles`

Create: `{ products: [id, id, ...], title, description, price }`. Mín 2, máx 10, ids propios únicos.  
`category` lo arma el BE: `["bundle", ...categorías de los productos]`.

List paginado igual que products. GET/list expanden `products` (objeto producto, no solo id).

PATCH: `products`, `title`, `description`, `price`, `status`. Recalcula `category` si cambian products.

Status: mismos que productos (`available | rented | in_review | inactive`). Un bundle está `in_review` si al menos uno de sus productos está `in_review`; si no, `available` (se calcula al crear y en cada PATCH de un bundle `available`/`in_review`; `inactive`/`rented` no se tocan). Solo `available` aparece en la búsqueda de clientes. El provider alterna `available` ↔ `inactive`; desde `in_review`/`rented` → 400 `invalid_status_transition`. Errores: `invalid_status_transition`, `products_not_found`, `title_not_available`.

DELETE borra el bundle, no los productos.

---

## Payments (cliente) `/v1/payments`

`amount` en centavos. Body: `{ storeId, amount, orderId?, currency? }`.  
Respuesta incluye `clientSecret` + `publishableKey` para Stripe.js.  
`confirm-test` solo dev. Transfer al terminar el alquiler.

Webhook: no desde Postman; Stripe CLI → `/api/webhooks/stripe`.

---

## Search (cliente) `POST /v1/search`

Público (sin JWT). Query `offset` (default 0) y `limit` (default 20, máx 100).

Body opcional. Vacío → productos y combos `available` de todas las stores.

- `destination.country` matchea `store.country`. `city` se busca en `addressLine1/2` (la store no tiene campo city).
- `categories[].name` es el id del taxonomy (`stroller`, `bike`, `crib`, …). `types` matchea atributos `type|style|eceGroup|frameType|boxType|size`. `accessories` matchea `attributes.accessories`.
- `rentalPeriod` valida el rango y define el día para cruzar horarios. No hay calendario de stock todavía.
- `acquisition` / `devolution`: `type` `delivery` | `customer_pickup`, `time` en minutos desde 00:00 contra `timeRanges` de la store. `address` se acepta y no filtra distancia.
- Cada ítem trae `store.delivery` y `store.customerPickup` (`timeRanges`, `days`).

Respuesta: `{ data, total, nextPage }` (`nextPage` es `{ offset, limit }` o `null`). `data[].kind`: `product` | `bundle`.

---

## Cart (cliente) `/v1/cart`

Bearer JWT. Un carrito por usuario.

- `GET /v1/shopping-cart-count` → `{ count }`. Cada producto y cada bundle suma 1. Los productos que van dentro de un bundle no suman. Sin carrito: `0`.
- `GET /v1/cart` → carrito. Vacío: `productsByStore: []`, `totals.amount: 0`.
- `POST /v1/cart` crea o edita el carrito. Un ítem (`productId` o `bundleId`) o varios: `productIds: [{ id, accessories? }]` y `bundleIds: string[]`. Solo entran productos y bundles `available`. Si el bundle incluye un producto que no está `available`, responde `bundle_not_available` y no guarda nada. Si la línea ya está, actualiza accesorios (solo producto). No hay stock numérico por producto.
- `PATCH /v1/cart` actualiza el período (`start` + `end`) y/o el handoff de una store (`storeId` + `acquisition` + `devolution`).
- `PUT /v1/cart/:productId/accessories` → `{ accessories: string[] }` → `{ ok: true }`. No aplica a bundles (`bundle_has_no_accessories`).
- `DELETE /v1/cart` body `{ productIds?: string[], bundleIds?: string[] }` → `{ ok: true }`. Acá los ids son strings (el `id` de la línea). En el POST masivo, `productIds` es `[{ id, accessories? }]`. 404 `item_not_in_cart` si ninguno está en el carrito. 400 `invalid_item_id` / `item_ids_required`.

Fechas: `YYYY-MM-DD` o `DD/MM/YYYY`. En la respuesta van `DD/MM/YYYY`.  
`days` es inclusivo (30/06–02/07 = 3).  
Cada línea: `kind` `product` | `bundle`, `price.amount` por día, `lineTotal` = precio × días. El bundle usa su propio precio, no la suma de sus productos.  
Por store: `itemsTotal`, `deliveryCost`, `total`.  
`totals`: `{ days, itemsAmount, deliveryAmount, taxAmount, amount }` con `amount` = itemsAmount + deliveryAmount + taxAmount.  
`deliveryCost` es el `basePrice` de la store en euros y solo si `acquisition.type` es `delivery`.  
`tax` queda en `0`: no hay tasa configurada. Líneas no disponibles (`isAvailable: false`) no suman.

---

## Admin `/v1/admin`

Sin JWT. Header `x-admin-key` = `ADMIN_API_KEY`. 401 `invalid_admin_api_key` o `admin_not_configured`.

`providerId` es el userId del provider.

- `PATCH /v1/admin/providers/:providerId/products/status` `{ status }` → todos los productos de ese provider. `status`: `available | rented | in_review | inactive`. Respuesta `{ providerId, status, updated, bundlesUpdated }`.
- `POST /v1/admin/providers/:providerId/products/approve` aprueba todos los `in_review` de ese provider. `{ providerId, approved, bundlesUpdated }`.
- `POST /v1/admin/products/approve` `{ productIds }` aprueba esos productos. Tienen que estar `in_review`. 404 `products_not_found`, 400 `product_not_in_review`.

Aprobar = `in_review` → `available`. Los bundles `available` o `in_review` del provider siguen el status de sus productos. Bundles `inactive` o `rented` no se tocan.
