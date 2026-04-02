import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly mailConfig: ReturnType<MailService['getMailConfig']>;

  constructor(private readonly configService: ConfigService) {
    const config = this.getMailConfig();
    this.mailConfig = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.pass
          ? {
              user: config.user,
              pass: config.pass,
            }
          : undefined,
    });
  }

  async sendConfirmationEmail(
    to: string,
    payload: { firstName: string; lastName: string; code: string },
  ): Promise<void> {
    const html = this.renderTemplate('confirmation.hbs', payload);
    await this.send(to, 'Confirm your E-mart account', html);
  }

  async sendOrderConfirmation(
    to: string,
    payload: { firstName: string; lastName: string; orderId: string },
  ): Promise<void> {
    const html = this.renderTemplate('order-confirm.hbs', payload);
    await this.send(to, 'Your E-mart order confirmation', html);
  }

  async sendAdminChangeNotice(
    to: string,
    payload: {
      firstName: string;
      lastName: string;
      role: string;
      active: boolean;
    },
  ): Promise<void> {
    const escapeHtml = (value: string): string =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const firstName = escapeHtml(payload.firstName);
    const lastName = escapeHtml(payload.lastName);
    const role = escapeHtml(payload.role);
    const fullName = `${firstName} ${lastName}`.trim();
    const html = `
      <p>Hello ${fullName},</p>
      <p>Your account settings were updated by an administrator.</p>
      <p>Role: ${role}</p>
      <p>Status: ${payload.active ? 'Active' : 'Inactive'}</p>
    `;
    await this.send(to, 'Your E-mart account was updated', html);
  }

  private renderTemplate(
    fileName: string,
    data: Record<string, unknown>,
  ): string {
    const templatePath = join(__dirname, fileName);
    const source = readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(source);
    const payload: Record<string, unknown> = {
      ...data,
      year: new Date().getFullYear(),
    };
    return template(payload);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.mailConfig.from,
      to,
      subject,
      html,
    });
  }

  private getMailConfig() {
    const host = this.configService.get<string>('MAIL_HOST');
    const rawPort = this.configService.get<string | number>('MAIL_PORT');
    const rawSecure = this.configService.get<string | boolean>('MAIL_SECURE');
    const from = this.configService.get<string>('MAIL_FROM');
    const port =
      typeof rawPort === 'number'
        ? rawPort
        : rawPort
          ? Number.parseInt(rawPort, 10)
          : NaN;
    const secure =
      typeof rawSecure === 'boolean' ? rawSecure : rawSecure === 'true';

    if (!host || Number.isNaN(port) || !from) {
      throw new Error('Mail configuration is incomplete');
    }

    return {
      host,
      port,
      secure,
      user: this.configService.get<string>('MAIL_USER'),
      pass: this.configService.get<string>('MAIL_PASS'),
      from,
    };
  }
}
