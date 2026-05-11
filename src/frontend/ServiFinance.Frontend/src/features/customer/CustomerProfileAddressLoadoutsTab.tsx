import { useState } from "react";
import type { FormEvent } from "react";
import { AddressLookupField } from "@/shared/location/AddressLookupField";
import {
  useDeleteCustomerContactOption,
  useSaveCustomerContactOption
} from "./useCustomerProfile";
import type { CustomerContactOption, CustomerProfile } from "./useCustomerProfile";

const emptyContactForm = {
  label: "",
  contactName: "",
  phoneNumber: "",
  address: "",
  addressDetails: "",
  isDefault: false
};

type ContactFormState = typeof emptyContactForm;

type CustomerProfileAddressLoadoutsTabProps = {
  profile: CustomerProfile;
};

export function CustomerProfileAddressLoadoutsTab({ profile }: CustomerProfileAddressLoadoutsTabProps) {
  const saveContact = useSaveCustomerContactOption();
  const deleteContact = useDeleteCustomerContactOption();
  const [editingContactId, setEditingContactId] = useState<string | undefined>();
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [isModalOpen, setIsModalOpen] = useState(false);

  function openCreateModal() {
    setEditingContactId(undefined);
    setContactForm(emptyContactForm);
    setIsModalOpen(true);
  }

  function openEditModal(option: CustomerContactOption) {
    setEditingContactId(option.id);
    setContactForm({
      label: option.label,
      contactName: option.contactName,
      phoneNumber: option.phoneNumber,
      address: option.address,
      addressDetails: option.addressDetails ?? "",
      isDefault: option.isDefault
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (saveContact.isPending) {
      return;
    }

    setIsModalOpen(false);
    setEditingContactId(undefined);
    setContactForm(emptyContactForm);
  }

  async function handleContactSubmit(event: FormEvent) {
    event.preventDefault();
    await saveContact.mutateAsync({
      id: editingContactId,
      payload: contactForm
    });
    closeModal();
  }

  return (
    <>
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Address loadouts</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Saved service contacts</h2>
            <p className="mt-3 max-w-[42rem] text-sm leading-6 text-slate-600">
              Save reusable service destinations for faster request submission across drop-off, pickup, or on-site work.
            </p>
          </div>
          <button
            type="button"
            className="btn w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
            onClick={openCreateModal}
          >
            Add contact option
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {profile.contactOptions.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm leading-6 text-slate-500">
              No saved contact options yet. Add one to prefill future service requests.
            </div>
          ) : (
            profile.contactOptions.map((option) => (
              <article key={option.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{option.label}</h3>
                      {option.isDefault ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-blue-700">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {option.contactName} / {option.phoneNumber}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{option.address}</p>
                    {option.addressDetails ? (
                      <p className="mt-2 text-sm leading-6 text-slate-500">{option.addressDetails}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none"
                      onClick={() => openEditModal(option)}
                    >
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

      {isModalOpen ? (
        <ContactOptionModal
          contactForm={contactForm}
          editingContactId={editingContactId}
          isSaving={saveContact.isPending}
          errorMessage={saveContact.isError ? saveContact.error.message : null}
          onChange={setContactForm}
          onClose={closeModal}
          onSubmit={handleContactSubmit}
        />
      ) : null}
    </>
  );
}

type ContactOptionModalProps = {
  contactForm: ContactFormState;
  editingContactId?: string;
  isSaving: boolean;
  errorMessage: string | null;
  onChange: (form: ContactFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

function ContactOptionModal({
  contactForm,
  editingContactId,
  isSaving,
  errorMessage,
  onChange,
  onClose,
  onSubmit
}: ContactOptionModalProps) {
  function updateContactForm(patch: Partial<ContactFormState>) {
    onChange({ ...contactForm, ...patch });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 py-5">
          <div>
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Contact option</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              {editingContactId ? "Edit saved address" : "Add saved address"}
            </h2>
          </div>
          <button type="button" className="btn btn-sm rounded-full border-slate-300 bg-white text-slate-900 shadow-none" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="max-h-[min(70vh,42rem)] overflow-y-auto px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Label</span>
                <input
                  className="input input-bordered w-full rounded-xl bg-white"
                  placeholder="Home, Office, Branch"
                  value={contactForm.label}
                  onChange={(event) => updateContactForm({ label: event.target.value })}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Contact name</span>
                <input
                  className="input input-bordered w-full rounded-xl bg-white"
                  value={contactForm.contactName}
                  onChange={(event) => updateContactForm({ contactName: event.target.value })}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Phone number</span>
                <input
                  className="input input-bordered w-full rounded-xl bg-white"
                  value={contactForm.phoneNumber}
                  onChange={(event) => updateContactForm({ phoneNumber: event.target.value })}
                  required
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={contactForm.isDefault}
                  onChange={(event) => updateContactForm({ isDefault: event.target.checked })}
                />
                Use as default for new requests
              </label>
              <AddressLookupField
                className="md:col-span-2"
                label="Service address"
                value={contactForm.address}
                onChange={(value) => updateContactForm({ address: value })}
                placeholder="Enter a saved service address"
                required
              />
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Address details</span>
                <textarea
                  className="textarea textarea-bordered min-h-24 w-full rounded-xl bg-white"
                  value={contactForm.addressDetails}
                  onChange={(event) => updateContactForm({ addressDetails: event.target.value })}
                  placeholder="Lot, unit, building, floor, landmark, or access notes"
                />
              </label>
              {errorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
                  {errorMessage}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col justify-end gap-3 border-t border-slate-200/80 bg-slate-50 px-5 py-4 sm:flex-row">
            <button type="button" className="btn w-full rounded-full border-slate-300 bg-white text-slate-900 shadow-none sm:w-auto" onClick={onClose}>
              Cancel
            </button>
            <button className="btn w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" disabled={isSaving}>
              {isSaving ? "Saving..." : editingContactId ? "Save contact option" : "Add contact option"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
