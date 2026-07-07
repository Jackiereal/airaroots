export type PaginatedResult<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

export type QueryOptions = {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
};
