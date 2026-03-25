import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

describe('MailService', () => {
  const sendMail = jest.fn().mockResolvedValue(undefined);
  const config = {
    MAIL_HOST: 'localhost',
    MAIL_PORT: 1025,
    MAIL_SECURE: false,
    MAIL_USER: '',
    MAIL_PASS: '',
    MAIL_FROM: 'no-reply@test.local',
  };

  const configService = {
    get: jest.fn((key: keyof typeof config) => config[key]),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  it('creates transporter from config', () => {
    new MailService(configService);
    expect(nodemailer.createTransport).toHaveBeenCalled();
  });

  it('sends admin change notice email', async () => {
    const service = new MailService(configService);

    await service.sendAdminChangeNotice('user@test.local', {
      firstName: 'User',
      lastName: 'Test',
      role: 'admin',
      active: true,
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.local',
        subject: 'Your E-mart account was updated',
      }),
    );
  });
});
