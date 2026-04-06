process.env.JWT_SECRET ??= 'test-jwt-secret';

process.env.EMAIL_VERIFICATION_SECRET ??= 'test-email-verification-secret';

process.env.GOOGLE_OAUTH_CLIENT_ID ??= 'test-google-client-id';
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= 'test-google-client-secret';
process.env.GOOGLE_OAUTH_CALLBACK_URL ??=
  'http://localhost:3000/auth/google/callback';
process.env.OAUTH_STATE_SECRET ??= 'test-oauth-state-secret';
