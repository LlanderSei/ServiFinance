import { useEffect, useState } from "react";
import {
  useCustomerProfile,
  useDeleteCustomerContactOption,
  useSaveCustomerContactOption,
  useUpdateCustomerProfile
} from "./useCustomerProfile";
import type { CustomerContactOption } from "./useCustomerProfile";

const emptyContactForm = {
  label: "",
  contactName: "",
  phoneNumber: "",
  address: "",
  isDefault: false
};

export function CustomerProfilePage() {
  const profileQuery = useCustomerProfile();
  const updateProfile = useUpdateCustomerProfile();
  const saveContact = useSaveCustomerContactOption();
  const deleteContact = useDeleteCustomerContactOption();
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | undefined>();
  const [contactForm, setContactForm] = useState(emptyContactForm);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setFullName(profileQuery.data.fullName);
    setMobileNumber(profileQuery.data.mobileNumber);
    setAddress(profileQuery.data.address);
  }, [profileQuery.data]);

  function handleEditContact(option: CustomerContactOption) {
    setEditingContactId(option.id);
    setContactForm({
      label: option.label,
      contactName: option.contactName,
      phoneNumber: option.phoneNumber,
      address: option.address,
      isDefault: option.isDefault
    });
  }

  function resetContactForm() {
    setEditingContactId(undefined);
    setContactForm(emptyContactForm);
  }

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    await updateProfile.mutateAsync({ fullName, mobileNumber, address });
  }

  async function handleContactSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveContact.mutateAsync({
      id: editingContactId,
      payload: contactForm
    });
    resetContactForm();
  }

  if (profileQuery.isLoading) {
    return (
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-6 py-10 text-center text-slate-500 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        Loading profile...
      </section>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <section className="rounded-[2rem] border border-rose-200/80 bg-white px-6 py-10 text-center text-rose-700 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        Customer profile could not be loaded. Refresh the session and try again.
      </section>
    );
  }

  const contacts = profileQuery.data.contactOptions;

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">My contact and service details</h1>
        <p className="mt-3 max-w-[42rem] text-sm leading-6 text-slate-600">
          Keep your tenant-scoped profile current and save address/contact loadouts for faster service requests.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <form
          onSubmit={handleProfileSubmit}
          className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]"
        >
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Primary record</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Basic information</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Full name</span>
              <input className="input input-bordered w-full rounded-xl bg-white" value={fullName} onChange={event => setFullName(event.target.value)} required />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input className="input input-bordered w-full rounded-xl bg-slate-50 text-slate-500" value={profileQuery.data.email} disabled />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Mobile number</span>
              <input className="input input-bordered w-full rounded-xl bg-white" value={mobileNumber} onChange={event => setMobileNumber(event.target.value)} required />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Default address</span>
              <textarea className="textarea textarea-bordered min-h-28 w-full rounded-xl bg-white" value={address} onChange={event => setAddress(event.target.value)} />
            </label>
            {updateProfile.isError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {updateProfile.error.message}
              </p>
            )}
            {updateProfile.isSuccess && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Profile updated.
              </p>
            )}
            <button className="btn w-full rounded-full bg-slate-900 text-white hover:bg-slate-800 sm:w-max" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>

        <div className="grid gap-5">
          <form
            onSubmit={handleContactSubmit}
            className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Saved loadout</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  {editingContactId ? "Edit contact option" : "Add contact option"}
                </h2>
              </div>
              {editingContactId && (
                <button type="button" className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none" onClick={resetContactForm}>
                  Clear edit
                </button>
              )}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Label</span>
                <input className="input input-bordered w-full rounded-xl bg-white" placeholder="Home, Office, Branch" value={contactForm.label} onChange={event => setContactForm(current => ({ ...current, label: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Contact name</span>
                <input className="input input-bordered w-full rounded-xl bg-white" value={contactForm.contactName} onChange={event => setContactForm(current => ({ ...current, contactName: event.target.value }))} required />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Phone number</span>
                <input className="input input-bordered w-full rounded-xl bg-white" value={contactForm.phoneNumber} onChange={event => setContactForm(current => ({ ...current, phoneNumber: event.target.value }))} required />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" className="checkbox checkbox-sm" checked={contactForm.isDefault} onChange={event => setContactForm(current => ({ ...current, isDefault: event.target.checked }))} />
                Use as default for new requests
              </label>
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Service address</span>
                <textarea className="textarea textarea-bordered min-h-28 w-full rounded-xl bg-white" value={contactForm.address} onChange={event => setContactForm(current => ({ ...current, address: event.target.value }))} required />
              </label>
              {saveContact.isError && (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                  {saveContact.error.message}
                </p>
              )}
              <button className="btn w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-max md:col-span-2" disabled={saveContact.isPending}>
                {saveContact.isPending ? "Saving..." : editingContactId ? "Save contact option" : "Add contact option"}
              </button>
            </div>
          </form>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Address book</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Saved service contacts</h2>
            <div className="mt-5 grid gap-3">
              {contacts.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
                  No saved contact options yet. Add one to prefill future service requests.
                </div>
              ) : (
                contacts.map(option => (
                  <article key={option.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{option.label}</h3>
                          {option.isDefault && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-blue-700">Default</span>}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{option.contactName} · {option.phoneNumber}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{option.address}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none" onClick={() => handleEditContact(option)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm rounded-full border-rose-200 bg-rose-50 text-rose-700 shadow-none"
                          disabled={deleteContact.isPending}
                          onClick={() => deleteContact.mutate(option.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
