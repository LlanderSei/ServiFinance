import { httpPostJson, httpDelete } from "@/shared/api/http";
import { AuthSessionResponse } from "@/shared/api/contracts";
import { applySession, clearSession } from "@/shared/auth/session";

export { getCurrentSession as getCurrentCustomerSession } from "@/shared/auth/session";

export type CustomerAccountRecord = {
  id: string;
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  createdAtUtc: string;
};

export type CustomerSession = AuthSessionResponse["user"];

export type RegisterCustomerAccountRequest = {
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  password: string;
};

export type LoginCustomerAccountRequest = {
  tenantDomainSlug: string;
  email: string;
  password: string;
};

export async function registerCustomerAccount(request: RegisterCustomerAccountRequest) {
  const tenantDomainSlug = request.tenantDomainSlug.trim().toLowerCase();
  const fullName = request.fullName.trim();
  const email = request.email.trim().toLowerCase();
  const mobileNumber = request.mobileNumber.trim();
  const address = request.address.trim();
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
    password,
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

  const response = await httpPostJson<AuthSessionResponse, any>("/api/auth/customer/login", {
    tenantDomainSlug,
    email,
    password,
    useCookieSession: true
  });

  await applySession(response, { rememberOnWeb: true });
  return response.user;
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
