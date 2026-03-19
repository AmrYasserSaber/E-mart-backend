export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(params: PaginationParams = {}): PaginationResult {
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.max(1, Number(params.limit ?? 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

