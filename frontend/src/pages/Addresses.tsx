import React, { useState } from "react";
import type { AddressInput, SavedAddress } from "../frontApisRoute/addresses";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import toast from "../components/toast/toast";
import { useAddresses } from "../hooks/useAddresses";
import {
  MapPinIcon,
  PlusIcon,
  HomeIcon,
  PackageIcon,
  Building,
} from "lucide-react";
import AddressCard from "../components/card/AddressCard";
import AddressForm from "../components/common/AddressForm";

const Addresses = () => {
  const { addresses, loading, saving, error, refresh, createAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses();
  const { user } = useCustomerAuth();
  const emptyForm = (): AddressInput => ({ label: "Home", fullName: user?.fullName ?? "", phone: user?.phone ?? "", addressLine1: "", addressLine2: "", city: "", region: "", digitalAddress: "", landmark: "", country: "Ghana", isDefault: false });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AddressInput>(emptyForm);
  const [formError, setFormError] = useState("");

  const resetForm = () => {
    setFormData(emptyForm());
    setFormError("");
    setShowForm(false);
    setEditingId(null);
  };

  const handleChanges = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : value,
    }));
    
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setFormError("");
    try {
      if (editingId) await updateAddress(editingId, formData);
      else await createAddress(formData);
      toast.success(editingId ? "Address updated" : "Address added");
      resetForm();
    } catch (error) { setFormError(error instanceof Error ? error.message : "Unable to save address"); }
  };

  const onEditHandler = (add: SavedAddress) => {
    setFormData({ label: add.label, fullName: add.fullName, phone: add.phone, addressLine1: add.addressLine1, addressLine2: add.addressLine2, city: add.city, region: add.region, digitalAddress: add.digitalAddress, landmark: add.landmark, country: add.country, isDefault: add.isDefault });
    setFormError("");
    setEditingId(add._id);
    setShowForm(true);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Delete this delivery address?")) return;
    try { await deleteAddress(id); toast.success("Address deleted"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete address"); }
  };

  const onSetDefault = async (id: string) => {
    try { await setDefaultAddress(id); toast.success("Default address updated"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update default address"); }
  };

  // Count address types
  const defaultAddress = addresses.find((a) => a.isDefault);
  const addressCount = addresses.length;

  return (
    <div className="bg-app-cream pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              <MapPinIcon className="size-7 text-app-orange" />
              My Addresses
            </h1>
            <p className="text-sm text-app-text-light mt-1">
              Manage your delivery addresses for faster checkout
            </p>
          </div>
          <button
            disabled={loading || saving || !!error}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-5 py-2.5 bg-app-green text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <PlusIcon className="size-4" />
            Add New Address
          </button>
        </div>

        {/* Stats Bar */}
        {addresses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl p-3 text-center border border-app-border/50 shadow-sm">
              <p className="text-2xl font-bold text-app-green">
                {addressCount}
              </p>
              <p className="text-xs text-app-text-light">Total Addresses</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-app-border/50 shadow-sm">
              <p className="text-2xl font-bold text-orange-500">
                {addresses.filter((a) => a.label === "Home").length}
              </p>
              <p className="text-xs text-app-text-light flex items-center justify-center gap-1">
                <HomeIcon className="size-3" /> Home
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-app-border/50 shadow-sm">
              <p className="text-2xl font-bold text-blue-500">
                {addresses.filter((a) => a.label === "Work").length}
              </p>
              <p className="text-xs text-app-text-light flex items-center justify-center gap-1">
                <Building className="size-3" /> Work
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-app-border/50 shadow-sm">
              <p className="text-2xl font-bold text-app-green">
                {defaultAddress ? 1 : 0}
              </p>
              <p className="text-xs text-app-text-light flex items-center justify-center gap-1">
                <MapPinIcon className="size-3" /> Default
              </p>
            </div>
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <AddressForm
            resetForm={resetForm}
            handleSubmit={handleSubmit}
            formData={formData}
            handleChanges={handleChanges}
            editingId={editingId}
            saving={saving}
            error={formError}
          />
        )}

        {/* Address List */}
        {loading ? <div role="status" className="py-20 text-center text-app-green">Loading your addresses...</div> : error ? <div className="py-12 text-center"><p role="alert" className="text-red-700">{error}</p><button onClick={refresh} className="mt-4 text-app-green underline">Try again</button></div> : addresses.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-app-border/50">
            <div className="max-w-sm mx-auto">
              <div className="w-24 h-24 bg-app-cream rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPinIcon className="size-10 text-app-text-light" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                No Addresses Saved
              </h2>
              <p className="text-sm text-app-text-light mb-6">
                Add your first address for faster checkout
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-app-green text-white font-medium rounded-xl hover:bg-green-800 transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <PlusIcon className="size-4" />
                Add Your First Address
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            {addresses.map((address) => (
              <AddressCard
                key={address._id}
                addr={address}
                onEditHandler={onEditHandler}
                onDelete={onDelete}
                onSetDefault={onSetDefault}
                saving={saving}
              />
            ))}
          </div>
        )}

        {/* Footer hint */}
        {addresses.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-xs text-app-text-light flex items-center justify-center gap-2">
              <PackageIcon className="size-3" />
              Your saved addresses are available whenever you sign in
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Addresses;
