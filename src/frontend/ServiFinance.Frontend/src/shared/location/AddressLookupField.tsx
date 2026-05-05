import { useEffect, useState } from "react";
import { useAddressLookup } from "./useAddressLookup";

type AddressLookupFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  required?: boolean;
  className?: string;
  variant?: "customer" | "workspace";
};

const minimumSearchLength = 5;

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeSearchQuery(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function AddressLookupField({
  label,
  value,
  onChange,
  placeholder,
  description,
  required = false,
  className,
  variant = "customer"
}: AddressLookupFieldProps) {
  const addressLookup = useAddressLookup();
  const [searchQuery, setSearchQuery] = useState(value);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery(value);
  }, [value]);

  const normalizedSearchQuery = normalizeSearchQuery(searchQuery);
  const results = addressLookup.data ?? [];
  const isCustomerVariant = variant === "customer";

  async function handleSearch() {
    if (normalizedSearchQuery.length < minimumSearchLength) {
      setLocalError(`Enter at least ${minimumSearchLength} characters before searching.`);
      return;
    }

    setLocalError(null);
    await addressLookup.mutateAsync({ query: normalizedSearchQuery, limit: 5 });
  }

  function handleUseAddress(address: string) {
    onChange(address);
    setSearchQuery(address);
    setLocalError(null);
    addressLookup.reset();
  }

  return (
    <div className={joinClasses("grid gap-2", className)}>
      <span
        className={joinClasses(
          isCustomerVariant
            ? "text-sm font-medium text-slate-700"
            : "text-[0.8rem] font-bold uppercase tracking-[0.04em] text-base-content/60"
        )}
      >
        {label}
      </span>
      <textarea
        className={joinClasses(
          "textarea textarea-bordered min-h-24 w-full",
          isCustomerVariant
            ? "rounded-xl bg-white"
            : "border-base-300/70 bg-base-100/95 text-base-content shadow-none"
        )}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          type="text"
          className={joinClasses(
            "input input-bordered w-full",
            isCustomerVariant
              ? "rounded-xl bg-white"
              : "border-base-300/70 bg-base-100/95 text-base-content shadow-none"
          )}
          placeholder="Search an address once, then choose a result"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <button
          type="button"
          className={joinClasses(
            "btn w-full rounded-full sm:w-auto",
            isCustomerVariant
              ? "border-none bg-slate-900 text-white hover:bg-slate-800"
              : "border border-base-300/70 bg-base-100/90 text-base-content shadow-none hover:bg-base-200/85"
          )}
          disabled={addressLookup.isPending}
          onClick={() => {
            void handleSearch();
          }}
        >
          {addressLookup.isPending ? "Searching..." : "Search address"}
        </button>
      </div>
      <span
        className={joinClasses(
          "text-xs leading-5",
          isCustomerVariant ? "text-slate-500" : "text-base-content/60"
        )}
      >
        Manual lookup only. Searches are cached and rate-limited before the request reaches OpenStreetMap.
      </span>
      {description ? (
        <span
          className={joinClasses(
            "text-xs leading-5",
            isCustomerVariant ? "text-slate-500" : "text-base-content/60"
          )}
        >
          {description}
        </span>
      ) : null}
      {localError ? (
        <p className={joinClasses("text-sm", isCustomerVariant ? "text-rose-600" : "text-error")}>
          {localError}
        </p>
      ) : null}
      {addressLookup.isError ? (
        <p className={joinClasses("text-sm", isCustomerVariant ? "text-rose-600" : "text-error")}>
          {addressLookup.error.message}
        </p>
      ) : null}
      {addressLookup.isSuccess ? (
        results.length ? (
          <div
            className={joinClasses(
              "grid gap-2 rounded-2xl border p-3",
              isCustomerVariant
                ? "border-slate-200 bg-slate-50"
                : "border-base-300/70 bg-base-200/40"
            )}
          >
            {results.map((result) => (
              <div
                key={`${result.displayName}-${result.latitude}-${result.longitude}`}
                className={joinClasses(
                  "grid gap-2 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto]",
                  isCustomerVariant
                    ? "border-slate-200 bg-white"
                    : "border-base-300/70 bg-base-100/90"
                )}
              >
                <div className="min-w-0">
                  <p className={joinClasses("text-sm font-medium", isCustomerVariant ? "text-slate-900" : "text-base-content")}>
                    {result.displayName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}</span>
                    <a
                      href={result.openStreetMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={joinClasses(
                        "font-medium no-underline",
                        isCustomerVariant ? "text-blue-600 hover:text-blue-700" : "text-info hover:opacity-80"
                      )}
                    >
                      Open map
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className={joinClasses(
                    "btn btn-sm rounded-full",
                    isCustomerVariant
                      ? "border-none bg-blue-600 text-white hover:bg-blue-700"
                      : "btn-primary text-primary-content"
                  )}
                  onClick={() => handleUseAddress(result.displayName)}
                >
                  Use address
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className={joinClasses("text-sm", isCustomerVariant ? "text-slate-500" : "text-base-content/65")}>
            No matching addresses found for that search.
          </p>
        )
      ) : null}
    </div>
  );
}
