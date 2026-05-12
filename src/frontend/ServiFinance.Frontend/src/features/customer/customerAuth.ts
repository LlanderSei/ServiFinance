import { httpPostJson, readApiErrorMessage } from "@/shared/api/http";
import { isDesktopShell, resolveApiUrl } from "@/platform/runtime";
import { AuthSessionResponse, CaptchaProof, MfaChallengeResponse } from "@/shared/api/contracts";
import { applySession, clearSession } from "@/shared/auth/session";

export { getCurrentSession as getCurrentCustomerSession } from "@/shared/auth/session";

export type CustomerAccountRecord = {
  id: string;
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  addressDetails: string | null;
  createdAtUtc: string;
};

export type CustomerSession = AuthSessionResponse["user"];

export type RegisterCustomerAccountRequest = {
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  addressDetails: string;
  password: string;
  captcha?: CaptchaProof | null;
};

export type LoginCustomerAccountRequest = {
  tenantDomainSlug: string;
  email: string;
  password: string;
  captcha?: CaptchaProof | null;
  mfaChallengeId?: string | null;
  mfaCode?: string | null;
};

export class MfaRequiredError extends Error {
  constructor(public readonly challenge: MfaChallengeResponse) {
    super(challenge.message);
  }
}

export async function registerCustomerAccount(request: RegisterCustomerAccountRequest) {
  const tenantDomainSlug = request.tenantDomainSlug.trim().toLowerCase();
  const fullName = request.fullName.trim();
  const email = request.email.trim().toLowerCase();
  const mobileNumber = request.mobileNumber.trim();
  const address = request.address.trim();
  const addressDetails = request.addressDetails.trim();
  const password = request.password;

  if (!fullName || !email || !mobileNumber || !address || !password) {
    throw new Error("Complete the registration form before continuing.");
  }

  const response = await httpPostJson<AuthSessionResponse, any>("/api/auth/customer/register", {
    tenantDomainSlug,
    fullName,
    email,
    mobileNumber,
    address,
    addressDetails,
    password,
    captcha: request.captcha,
    useCookieSession: true
  });

  await applySession(response, { rememberOnWeb: true });
  return response.user;
}

export async function loginCustomerAccount(request: LoginCustomerAccountRequest) {
  const tenantDomainSlug = request.tenantDomainSlug.trim().toLowerCase();
  const email = request.email.trim().toLowerCase();
  const password = request.password;

  if (!email || !password) {
    throw new Error("Provide your email and password.");
  }

  const response = await fetch(await resolveApiUrl("/api/auth/customer/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: isDesktopShell() ? "omit" : "include",
    body: JSON.stringify({
      tenantDomainSlug,
      email,
      password,
      captcha: request.mfaChallengeId ? null : request.captcha,
      mfaChallengeId: request.mfaChallengeId,
      mfaCode: request.mfaCode,
      useCookieSession: true
    })
  });

  if (response.status === 202) {
    throw new MfaRequiredError(await response.json() as MfaChallengeResponse);
  }

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response) ?? "The customer email or password is incorrect for this tenant domain.");
  }

  const payload = await response.json() as AuthSessionResponse;
  await applySession(payload, { rememberOnWeb: true });
  return payload.user;
}

export async function logoutCustomerAccount() {
  try {
    await httpPostJson("/api/auth/logout", {});
  } catch (err) {
    // ignore
  } finally {
    await clearSession();
  }
}
