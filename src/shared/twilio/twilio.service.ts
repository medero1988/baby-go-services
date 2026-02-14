import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env.service';
// twilio usa module.exports (no default); require para compatibilidad en runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require('twilio') as (
  sid: string,
  token: string,
) => {
  messages: {
    create: (opts: {
      to: string;
      messagingServiceSid: string;
      body: string;
    }) => Promise<unknown>;
  };
};

/**
 * Envío de SMS vía Twilio (Messaging Service).
 * Si TWILIO_ACCOUNT_SID / TWILIO_MESSAGING_SERVICE_SID no están configurados, no envía.
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: ReturnType<typeof twilio> | null = null;

  constructor(private env: EnvService) {
    const sid = this.env.twilioAccountSid;
    const token = this.env.twilioAuthToken;
    if (sid && token) {
      this.client = twilio(sid, token);
    }
  }

  get isConfigured(): boolean {
    return (
      this.client !== null &&
      Boolean(this.env.twilioMessagingServiceSid?.trim())
    );
  }

  /**
   * Envía un SMS al número dado (formato E.164, ej: +315615628854).
   * Si Twilio no está configurado o falla, solo registra el error y no lanza.
   */
  async sendSms(to: string, body: string): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.debug(
        'Twilio no configurado (TWILIO_ACCOUNT_SID / TWILIO_MESSAGING_SERVICE_SID); no se envía SMS.',
      );
      return false;
    }

    const messagingServiceSid = this.env.twilioMessagingServiceSid.trim();
    const normalizedTo = normalizePhoneToE164(to);

    try {
      const result = await this.client!.messages.create({
        to: normalizedTo,
        messagingServiceSid,
        body,
      });
      this.logger.log(result);
      this.logger.log(`SMS enviado a ${normalizedTo}`);
      return true;
    } catch (err) {
      this.logger.warn(
        `Error enviando SMS a ${normalizedTo}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}

function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return phone;
  return phone.startsWith('+') ? phone : `+${digits}`;
}
