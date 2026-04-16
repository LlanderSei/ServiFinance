export type CustomerAccountRecord = {
  id: string;
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  password: string;
  createdAtUtc: string;
};

export type CustomerSession = {
  accountId: string;
  tenantDomainSlug: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  address: string;
  signedInAtUtc: string;
};

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

const CUSTOMER_ACCOUNTS_KEY = "sf:customer:accounts";
const CUSTOMER_SESSION_KEY = "sf:customer:session";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCustomerAccounts(): CustomerAccountRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(CUSTOMER_ACCOUNTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CustomerAccountRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomerAccounts(accounts: CustomerAccountRecord[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(CUSTOMER_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getCurrentCustomerSession() {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as CustomerSession;
  } catch {
    return null;
  }
}

export function setCurrentCustomerSession(session: CustomerSession | null) {
  if (!canUseStorage()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(CUSTOMER_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
}

export function registerCustomerAccount(request: RegisterCustomerAccountRequest) {
  const tenantDomainSlug = request.tenantDomainSlug.trim().toLowerCase();
  const fullName = request.fullName.trim();
  const email = request.email.trim().toLowerCase();
  const mobileNumber = request.mobileNumber.trim();
  const address = request.address.trim();
  const password = request.password;

  if (!fullName || !email || !mobileNumber || !address || !password) {
    throw new Error("Complete the registration form before continuing.");
  }

  const accounts = readCustomerAccounts();
  const existing = accounts.find((account) =>
    account.tenantDomainSlug === tenantDomainSlug &&
    account.email === email
  );

  if (existing) {
    throw new Error("A customer account with this email already exists for this tenant domain.");
  }

  const account: CustomerAccountRecord = {
    id: crypto.randomUUID(),
    tenantDomainSlug,
    fullName,
    email,
    mobileNumber,
    address,
    password,
    createdAtUtc: new Date().toISOString()
  };

  writeCustomerAccounts([...accounts, account]);

  const session: CustomerSession = {
    accountId: account.id,
    tenantDomainSlug: account.tenantDomainSlug,
    fullName: account.fullName,
    email: account.email,
    mobileNumber: account.mobileNumber,
    address: account.address,
    signedInAtUtc: new Date().toISOString()
  };

  setCurrentCustomerSession(session);
  return session;
}

export function loginCustomerAccount(request: LoginCustomerAccountRequest) {
  const tenantDomainSlug = request.tenantDomainSlug.trim().toLowerCase();
  const email = request.email.trim().toLowerCase();
  const password = request.password;

  const account = readCustomerAccounts().find((entry) =>
    entry.tenantDomainSlug === tenantDomainSlug &&
    entry.email === email &&
    entry.password === password
  );

  if (!account) {
    throw new Error("The customer credentials do not match this tenant domain.");
  }

  const session: CustomerSession = {
    accountId: account.id,
    tenantDomainSlug: account.tenantDomainSlug,
    fullName: account.fullName,
    email: account.email,
    mobileNumber: account.mobileNumber,
    address: account.address,
    signedInAtUtc: new Date().toISOString()
  };

  setCurrentCustomerSession(session);
  return session;
}

export function logoutCustomerAccount() {
  setCurrentCustomerSession(null);
}
