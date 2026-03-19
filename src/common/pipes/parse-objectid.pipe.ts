import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Validates that the incoming value looks like a MongoDB ObjectId (24 hex chars).
 * In this scaffold, we only validate shape and return the original value.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (typeof value !== 'string') {
      throw new BadRequestException('Invalid id');
    }

    const isObjectId = /^[a-fA-F0-9]{24}$/.test(value);
    if (!isObjectId) {
      throw new BadRequestException('Invalid id format');
    }

    return value;
  }
}

