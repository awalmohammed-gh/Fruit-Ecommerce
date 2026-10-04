import { apiRequest } from "./client";
export const ghanaRegions = ["Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra", "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"];
export interface AddressInput {
  label: string; fullName: string; phone: string; addressLine1: string; addressLine2: string;
  city: string; region: string; digitalAddress: string; landmark: string; country: string; isDefault: boolean;
}
export interface SavedAddress extends AddressInput { _id: string; createdAt: string; updatedAt: string }
export type AddressResponse = { addresses: SavedAddress[]; message?: string };
export const addressesApi = {
  list: () => apiRequest<AddressResponse>("/addresses"),
  get: (id: string) => apiRequest<{ address: SavedAddress }>(`/addresses/${encodeURIComponent(id)}`),
  create: (input: AddressInput) => apiRequest<AddressResponse>("/addresses", { method: "POST", body: JSON.stringify(input) }),
  update: (id: string, input: AddressInput) => apiRequest<AddressResponse>(`/addresses/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  remove: (id: string) => apiRequest<AddressResponse>(`/addresses/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setDefault: (id: string) => apiRequest<AddressResponse>(`/addresses/${encodeURIComponent(id)}/default`, { method: "PATCH" }),
};
