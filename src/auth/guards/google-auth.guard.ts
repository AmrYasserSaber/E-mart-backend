import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { OAuthStateService } from '../services/oauth-state.service';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly oauthStateService: OAuthStateService) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAuthenticateOptions(context: ExecutionContext): any {
    const req = context
      .switchToHttp()
      .getRequest<Request & { query?: unknown }>();
    const url = typeof req.url === 'string' ? req.url : '';
    if (url.includes('/auth/google/callback')) {
      return {};
    }
    const query = req.query as { returnUrl?: string } | undefined;
    const state = this.oauthStateService.executeCreateState(query?.returnUrl);
    return {
      scope: ['email', 'profile'],
      state,
      prompt: 'select_account',
    };
  }
}
