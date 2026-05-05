export function formatFullAddress(address?: string | null, addressDetails?: string | null) {
  const baseAddress = address?.trim();
  const extraDetails = addressDetails?.trim();

  if (baseAddress && extraDetails) {
    return `${baseAddress} (${extraDetails})`;
  }

  return baseAddress || extraDetails || "Not provided";
}
