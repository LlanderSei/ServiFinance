import { useState } from "react";
import { CustomerBottomTabs } from "./CustomerBottomTabs";
import { CustomerProfileAddressLoadoutsTab } from "./CustomerProfileAddressLoadoutsTab";
import { CustomerProfileBasicInformationTab } from "./CustomerProfileBasicInformationTab";
import { CustomerProfileSecurityTab } from "./CustomerProfileSecurityTab";
import { useCustomerProfile } from "./useCustomerProfile";

type ProfileTab = "basic" | "security" | "addresses";

const profileTabs: Array<{ key: ProfileTab; label: string }> = [
  { key: "basic", label: "Basic Information" },
  { key: "security", label: "Password & Security" },
  { key: "addresses", label: "Address Loadouts" }
];

function getInitialProfileTab(): ProfileTab {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.has("googleLink") ? "security" : "basic";
}

export function CustomerProfilePage() {
  const profileQuery = useCustomerProfile();
  const [activeTab, setActiveTab] = useState<ProfileTab>(getInitialProfileTab);

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

  const profile = profileQuery.data;

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white px-5 py-6 shadow-[0_14px_30px_rgba(35,46,76,0.06)]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-slate-500">Customer profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950">My contact and service details</h1>
        <p className="mt-3 max-w-[42rem] text-sm leading-6 text-slate-600">
          Keep your tenant-scoped profile current and save address/contact loadouts for faster service requests.
        </p>
      </section>

      {activeTab === "basic" ? <CustomerProfileBasicInformationTab profile={profile} /> : null}
      {activeTab === "security" ? <CustomerProfileSecurityTab profile={profile} /> : null}
      {activeTab === "addresses" ? <CustomerProfileAddressLoadoutsTab profile={profile} /> : null}

      <CustomerBottomTabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
}
