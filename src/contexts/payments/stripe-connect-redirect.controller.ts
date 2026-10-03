import { Controller, Get, Header, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Páginas `return_url` / `refresh_url` del onboarding hosted de Stripe Connect.
 * Stripe solo acepta http(s), así que estas páginas reenvían al deep link de
 * la app recibido en `?redirect=` (ej. `bbgo://stripe-connect/return`), que es
 * lo que cierra el `WebBrowser.openAuthSessionAsync` del front.
 * Sin `redirect` (Postman / dev) solo muestran un mensaje.
 */
@Controller('stripe-connect')
export class StripeConnectRedirectController {
  @Public()
  @Get('return')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  onboardingReturn(@Query('redirect') redirect?: string) {
    return renderRedirectPage(
      'Stripe setup finished',
      'You can go back to the BBGO app.',
      redirect,
    );
  }

  /** El link expiró o ya se usó: la app pide uno nuevo (requiere sesión). */
  @Public()
  @Get('refresh')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  onboardingRefresh(@Query('redirect') redirect?: string) {
    return renderRedirectPage(
      'Link expired',
      'Go back to the BBGO app and tap "Connect" again to continue.',
      redirect,
    );
  }
}

/** Esquemas web/peligrosos: solo se reenvía a esquemas propios de la app. */
const BLOCKED_SCHEMES = new Set([
  'http',
  'https',
  'javascript',
  'data',
  'file',
  'blob',
  'about',
  'vbscript',
  'ftp',
]);

/** Devuelve el deep link si es un esquema de app (`bbgo://`, `exp://`, ...). */
export function toAppDeepLink(redirect?: string): string | undefined {
  const value = redirect?.trim();
  const match = value?.match(/^([a-z][a-z0-9+.-]*):\/\//i);
  if (!value || !match || BLOCKED_SCHEMES.has(match[1].toLowerCase())) {
    return undefined;
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRedirectPage(
  title: string,
  message: string,
  redirect?: string,
): string {
  const deepLink = toAppDeepLink(redirect);
  const href = deepLink ? escapeHtml(deepLink) : undefined;
  // JSON + escape de `<` evita cerrar el <script> desde el valor.
  const script = deepLink
    ? `<script>window.location.replace(${JSON.stringify(deepLink).replace(/</g, '\\u003c')});</script>`
    : '';
  const button = href
    ? `<p><a class="btn" href="${href}">Open BBGO</a></p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:48px 16px;text-align:center;color:#1a1a1a;background:#fff}
@media (prefers-color-scheme:dark){body{color:#f2f2f2;background:#121212}}
.btn{display:inline-block;padding:12px 24px;border-radius:8px;background:#635bff;color:#fff;text-decoration:none}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
${button}
${script}
</body>
</html>`;
}
