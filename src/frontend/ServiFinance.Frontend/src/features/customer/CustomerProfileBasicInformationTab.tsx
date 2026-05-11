import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AddressLookupField } from "@/shared/location/AddressLookupField";
import { useUpdateCustomerProfile } from "./useCustomerProfile";
import type { CustomerProfile } from "./useCustomerProfile";

type CustomerProfileBasicInformationTabProps = {
  profile: CustomerProfile;
};

export function CustomerProfileBasicInformationTab({ profile }: CustomerProfileBasicInformationTabProps) {
  const updateProfile = useUpdateCustomerProfile();
  const [fullName, setFullName] = useState(profile.fullName);
  const [mobileNumber, setMobileNumber] = useState(profile.mobileNumber);
  const [address, setAddress] = useState(profile.address);
  const [addressDetails, setAddressDetails] = useState(profile.addressDetails ?? "");

  useEffect(() => {
    setFullName(profile.fullName);
    setMobileNumber(profile.mobileNumber);
    setAddress(profile.address);
    setAddressDetails(profile.addressDetails ?? "");
  }, [profile]);

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    await updateProfile.mutateAsync({ fullName, mobileNumber, address, addressDetails });
  }

  return (
    <form
      onSubmit={handleProfileSubmit}
      className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]"
    >
      <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Primary record</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Basic information</h2>
      <p className="mt-3 max-w-[42rem] text-sm leading-6 text-slate-600">
        Keep the profile details tenant staff will use when they contact you for service work.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Full name</span>
          <input
            className="input input-bordered w-full rounded-xl bg-white"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input className="input input-bordered w-full rounded-xl bg-slate-50 text-slate-500" value={profile.email} disabled />
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Mobile number</span>
          <input
            className="input input-bordered w-full rounded-xl bg-white"
            value={mobileNumber}
            onChange={(event) => setMobileNumber(event.target.value)}
            required
          />
        </label>

        <AddressLookupField
          className="md:col-span-2"
          label="Default address"
          value={address}
          onChange={setAddress}
          placeholder="Enter a default service address"
        />

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Address details</span>
          <textarea
            className="textarea textarea-bordered min-h-24 w-full rounded-xl bg-white"
            value={addressDetails}
            onChange={(event) => setAddressDetails(event.target.value)}
            placeholder="Lot, unit, building, floor, landmark, or access notes"
          />
        </label>

        {updateProfile.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
            {updateProfile.error.message}
          </p>
        ) : null}

        {updateProfile.isSuccess ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:col-span-2">
            Profile updated.
          </p>
        ) : null}

        <button className="btn w-full rounded-full bg-slate-900 text-white hover:bg-slate-800 sm:w-max md:col-span-2" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
