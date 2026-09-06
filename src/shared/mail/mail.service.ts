import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';
import { EnvService } from '../../config/env.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private client: Resend | null = null;

  constructor(private env: EnvService) {
    const key = this.env.resendApiKey?.trim();
    if (key) {
      this.client = new Resend(key);
    } else {
      this.logger.warn(
        'RESEND_API_KEY is empty — email verification/recovery will fail until configured',
      );
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** Falla si no hay Resend configurado (flujo real de correos). */
  assertConfigured(): void {
    if (!this.client) {
      throw new ServiceUnavailableException({
        error: 'mail_not_configured',
        message:
          'Email service is not configured. Set RESEND_API_KEY and MAIL_FROM.',
      });
    }
  }

  async sendEmailVerification(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verificá tu email en Baby Go',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>Bienvenido/a a Baby Go</h2>
          <p>Tu código de verificación es:</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f4f4f5;padding:16px;text-align:center;border-radius:8px">${code}</p>
          <p>Caduca en <strong>10 minutos</strong>.</p>
          <p style="color:#71717a;font-size:13px">Si no creaste una cuenta, ignorá este correo.</p>
        </div>
      `,
      text: `Tu código de verificación Baby Go es ${code}. Caduca en 10 minutos.`,
    });
  }

  async sendPasswordRecovery(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: 'Recuperá tu contraseña de Baby Go',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2>Recuperación de contraseña</h2>
          <p>Tu código de recuperación es:</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f4f4f5;padding:16px;text-align:center;border-radius:8px">${code}</p>
          <p>Caduca en <strong>10 minutos</strong>.</p>
          <p style="color:#71717a;font-size:13px">Si no pediste recuperar la contraseña, ignorá este correo.</p>
        </div>
      `,
      text: `Tu código de recuperación Baby Go es ${code}. Caduca en 10 minutos.`,
    });
  }

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    this.assertConfigured();

    try {
      const { data, error } = await this.client!.emails.send({
        from: this.env.mailFrom,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });

      if (error) {
        this.logger.error(`Resend error to ${params.to}: ${error.message}`);
        throw new ServiceUnavailableException({
          error: 'mail_send_failed',
          message: error.message,
        });
      }

      this.logger.log(
        `Email sent to ${params.to} (${params.subject}) id=${data?.id ?? 'n/a'}`,
      );
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend unexpected error: ${message}`);
      throw new ServiceUnavailableException({
        error: 'mail_send_failed',
        message,
      });
    }
  }
}
