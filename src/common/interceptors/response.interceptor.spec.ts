import { ExecutionContext } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('wraps response in standard envelope', async () => {
    const interceptor = new ResponseInterceptor<{ id: string }>();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/admin/users' }),
      }),
    } as unknown as ExecutionContext;

    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ id: 'u1' }),
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: { id: 'u1' },
        path: '/admin/users',
      }),
    );
  });
});
