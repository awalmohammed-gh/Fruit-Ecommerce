import { apiRequest } from './client';
import type { CartItem } from '../types';

export interface CartResponse { ownerId: string; items: CartItem[] }
const request = (ownerId: string, method = 'GET', body?: object): RequestInit => ({
  method, headers: { 'X-Cart-Owner': ownerId }, ...(body && { body: JSON.stringify(body) }),
});
export const cartApi = {
  list: (ownerId: string) => apiRequest<CartResponse>('/cart', request(ownerId)),
  add: (ownerId: string, productId: string, quantity: number) =>
    apiRequest<CartResponse>('/cart', request(ownerId, 'POST', { productId, quantity })),
  update: (ownerId: string, productId: string, quantity: number) =>
    apiRequest<CartResponse>(`/cart/${encodeURIComponent(productId)}`, request(ownerId, 'PATCH', { quantity })),
  remove: (ownerId: string, productId: string) =>
    apiRequest<CartResponse>(`/cart/${encodeURIComponent(productId)}`, request(ownerId, 'DELETE')),
  clear: (ownerId: string) => apiRequest<CartResponse>('/cart', request(ownerId, 'DELETE')),
};
