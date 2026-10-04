import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addressesApi,
  type AddressInput,
  type AddressResponse,
  type SavedAddress,
} from "../frontApisRoute/addresses";
import { useCustomerAuth } from "./CustomerAuthContext";
interface AddressContextType {
  addresses: SavedAddress[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => void;
  createAddress: (input: AddressInput) => Promise<void>;
  updateAddress: (id: string, input: AddressInput) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
}
const AddressContext = createContext<AddressContextType | undefined>(undefined);
function UserAddresses({ children }: { children: ReactNode }) {
  const { user } = useCustomerAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const userId = user?._id;
  const [loading, setLoading] = useState(!!userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mutationPending = useRef(false);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    addressesApi
      .list()
      .then(({ addresses }) => {
        if (active) {
          setAddresses(addresses);
          setError(null);
        }
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "Unable to load addresses",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  const mutate = async (request: () => Promise<AddressResponse>) => {
    if (mutationPending.current)
      throw new Error("Please wait for the current address change to finish");
    mutationPending.current = true;
    setSaving(true);
    try {
      const result = await request();
      setAddresses(result.addresses);
      setError(null);
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };
  return (
    <AddressContext.Provider
      value={{
        addresses,
        loading,
        saving,
        error,
        refresh: () => {
          setLoading(true);
          setAttempt((value) => value + 1);
        },
        createAddress: (input) => mutate(() => addressesApi.create(input)),
        updateAddress: (id, input) =>
          mutate(() => addressesApi.update(id, input)),
        deleteAddress: (id) => mutate(() => addressesApi.remove(id)),
        setDefaultAddress: (id) => mutate(() => addressesApi.setDefault(id)),
      }}
    >
      {children}
    </AddressContext.Provider>
  );
}
export function AddressProvider({ children }: { children: ReactNode }) {
  const { user } = useCustomerAuth();
  return <UserAddresses key={user?._id ?? "guest"}>{children}</UserAddresses>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAddressContext() {
  const context = useContext(AddressContext);
  if (!context)
    throw new Error("useAddresses must be used within AddressProvider");
  return context;
}
