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
import { ApiQuery } from '@nestjs/swagger';
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

  interface SchemaProperty {
    type?: string;
    description?: string;
    items?: {
      type?: string;
      enum?: unknown[];
    };
    enum?: unknown[];
  }

  const apiQueries = Object.keys(schema.properties || {}).map((key) => {
    const properties = schema.properties as Record<string, SchemaProperty>;
    const prop = properties[key];
    const isRequired = schema.required?.includes(key) ?? false;

    let type: typeof String | typeof Number | typeof Boolean = String;
    const isArray = prop?.type === 'array';

    const enumValues: unknown[] | undefined = isArray
      ? prop?.items?.enum
      : prop?.enum;

    if (prop?.type === 'number' || prop?.type === 'integer') {
      type = Number;
    } else if (prop?.type === 'boolean') {
      type = Boolean;
    } else if (prop?.type === 'string') {
      type = String;
    } else if (isArray) {
      const itemType = prop?.items?.type;
      if (itemType === 'number' || itemType === 'integer') {
        type = Number;
      } else if (itemType === 'boolean') {
        type = Boolean;
      } else {
        type = String;
      }
    }

    const enumValuesForSwagger: string[] | number[] | undefined = enumValues
      ? type === Number
        ? (enumValues as number[])
        : enumValues.map((value) => String(value))
      : undefined;

    type ApiQueryOptions = Parameters<typeof ApiQuery>[0];
    const apiQueryOptions: ApiQueryOptions = enumValuesForSwagger
      ? {
          name: key,
          required: isRequired,
          enum: enumValuesForSwagger,
          enumName: `${key}Enum`,
          type,
          isArray,
          description: prop?.description,
        }
      : {
          name: key,
          required: isRequired,
          type,
          isArray,
          description: prop?.description,
        };

    return ApiQuery(apiQueryOptions);
  });

  return applyDecorators(
    UseInterceptors(QueryValidationInterceptor),
    ...apiQueries,
  );
};
