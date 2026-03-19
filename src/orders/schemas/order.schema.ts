export class OrderSchema {
  id?: string;
  userId?: string;
  sellerId?: string;
  items?: Array<{
    productId?: string;
    quantity?: number;
  }>;
  status?: string;
}

