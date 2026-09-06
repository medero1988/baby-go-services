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
      from?: string;
      messagingServiceSid?: string;
      body: string;
    }) => Promise<{ sid: string; status: string }>;
  };
};

export type CellVerificationChannel = 'whatsapp' | 'sms';

export type SendVerificationResult = {
  sent: boolean;
  channel: CellVerificationChannel;
  /** Hint para sandbox WhatsApp (solo cuando falla / no configurado). */
  hint?: string;
};

/**
 * Envío de OTP vía Twilio: WhatsApp (sandbox gratis) o SMS.
 * Canal: CELL_VERIFICATION_CHANNEL=whatsapp|sms (default whatsapp).
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

  get channel(): CellVerificationChannel {
    return this.env.cellVerificationChannel;
  }

  get isWhatsappConfigured(): boolean {
    return this.client !== null && Boolean(this.env.twilioWhatsappFrom?.trim());
  }

  get isSmsConfigured(): boolean {
    return (
      this.client !== null &&
      Boolean(this.env.twilioMessagingServiceSid?.trim())
    );
  }

  /**
   * Envía el código de verificación por el canal configurado.
   * WhatsApp sandbox: el usuario debe haber enviado antes "join <código>"
   * al número del sandbox (gratis).
   */
  async sendVerificationCode(
    to: string,
    code: string,
  ): Promise<SendVerificationResult> {
    const channel = this.channel;
    if (channel === 'whatsapp') {
      return this.sendWhatsApp(to, code);
    }
    return this.sendSms(to, code);
  }

  async sendWhatsApp(
    to: string,
    code: string,
  ): Promise<SendVerificationResult> {
    const channel: CellVerificationChannel = 'whatsapp';
    const sandboxHint =
      'Abrí WhatsApp, escribí al sandbox de Twilio (ej. +1 415 523 8886) el mensaje join <tu-código-sandbox> que aparece en Twilio Console → Messaging → Try WhatsApp. Luego reintentá el resend.';

    if (!this.isWhatsappConfigured) {
      this.logger.debug(
        'Twilio WhatsApp no configurado (TWILIO_ACCOUNT_SID / TWILIO_WHATSAPP_FROM).',
      );
      return { sent: false, channel, hint: sandboxHint };
    }

    const from = this.env.twilioWhatsappFrom.trim();
    const normalizedTo = toWhatsAppAddress(to);
    const body = `Baby Go: tu código de verificación es ${code}. Válido por unos minutos.`;

    try {
      const result = await this.client!.messages.create({
        from,
        to: normalizedTo,
        body,
      });
      this.logger.log(
        `WhatsApp OTP enviado a ${normalizedTo} sid=${result.sid} status=${result.status}`,
      );
      return { sent: true, channel };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Error enviando WhatsApp a ${normalizedTo}: ${message}`);
      return {
        sent: false,
        channel,
        hint: sandboxHint,
      };
    }
  }

  /**
   * Envía SMS (Messaging Service). En trial Chile suele fallar la entrega.
   */
  async sendSms(to: string, code: string): Promise<SendVerificationResult> {
    const channel: CellVerificationChannel = 'sms';
    if (!this.isSmsConfigured) {
      this.logger.debug(
        'Twilio SMS no configurado (TWILIO_ACCOUNT_SID / TWILIO_MESSAGING_SERVICE_SID).',
      );
      return { sent: false, channel };
    }

    const messagingServiceSid = this.env.twilioMessagingServiceSid.trim();
    const normalizedTo = normalizePhoneToE164(to);

    try {
      const result = await this.client!.messages.create({
        to: normalizedTo,
        messagingServiceSid,
        body: code,
      });
      this.logger.log(
        `SMS enviado a ${normalizedTo} sid=${result.sid} status=${result.status}`,
      );
      return { sent: true, channel };
    } catch (err) {
      this.logger.warn(
        `Error enviando SMS a ${normalizedTo}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { sent: false, channel };
    }
  }
}

function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return phone;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

function toWhatsAppAddress(phone: string): string {
  const e164 = normalizePhoneToE164(phone);
  return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`;
}
