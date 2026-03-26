import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PipeTransform,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TObject, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Observable } from 'rxjs';

@Injectable()
export class TypeBoxQueryPipe<T extends TObject> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): Static<T> {
    let data = Value.Default(this.schema, value ?? {});
    data = Value.Convert(this.schema, data);
    data = Value.Clean(this.schema, data);

    if (!Value.Check(this.schema, data)) {
      const errors = [...Value.Errors(this.schema, data)].map((e) => ({
        path: e.path,
        message: (() => {
          const schemaWithMessage = e.schema as { errorMessage?: unknown };
          return typeof schemaWithMessage.errorMessage === 'string'
            ? schemaWithMessage.errorMessage
            : e.message;
        })(),
      }));

      throw new BadRequestException({
        message: this.schema.description ?? 'Query validation failed',
        errors,
      });
    }

    return data;
  }
}

export const ValidateQueryParams = <T extends TObject>(schema: T) => {
  @Injectable()
  class QueryValidationInterceptor implements NestInterceptor {
    private readonly pipe = new TypeBoxQueryPipe(schema);

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      const request = context.switchToHttp().getRequest<Request>();
      const validated = this.pipe.transform(request.query);

      Object.defineProperty(request, 'query', {
        value: validated,
        writable: true,
        configurable: true,
      });
      return next.handle();
    }
  }

  return applyDecorators(UseInterceptors(QueryValidationInterceptor));
};
