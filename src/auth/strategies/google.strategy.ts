import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { env } from '../../config/env';

export interface GoogleUserProfile {
  readonly googleId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    const clientID = env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
    const callbackURL = env.GOOGLE_OAUTH_CALLBACK_URL;
    if (!clientID || !clientSecret || !callbackURL) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured on this server.',
      );
    }
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): GoogleUserProfile {
    const email =
      profile.emails?.[0]?.value?.trim().toLowerCase() ??
      profile._json?.email?.trim()?.toLowerCase() ??
      '';
    if (!email) {
      throw new ServiceUnavailableException(
        'Google profile did not include an email address.',
      );
    }
    const firstName =
      profile.name?.givenName?.trim() ??
      profile._json?.given_name?.trim() ??
      'Google';
    const lastName =
      profile.name?.familyName?.trim() ??
      profile._json?.family_name?.trim() ??
      'User';
    return {
      googleId: profile.id,
      email,
      firstName,
      lastName,
    };
  }
}
