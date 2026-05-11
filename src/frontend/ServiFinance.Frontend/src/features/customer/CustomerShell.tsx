import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/shared/toast/ToastProvider";
import { IdleLogoutGuard } from "@/shared/auth/IdleLogoutGuard";
import type { CustomerSession } from "./customerAuth";
import { logoutCustomerAccount } from "./customerAuth";
import { fetchCustomerRequestNotifications } from "./useCustomerRequests";
import { buildCustomerNav } from "./customerNav";

type Props = {
  session: CustomerSession | null;
  children: ReactNode;
};

type NotificationBanner = {
  tone: "info" | "warning";
  title: string;
  message: string;
  canPrompt: boolean;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getNotificationPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function buildNotificationStorageKey(tenantDomainSlug: string, customerUserId: string) {
  return `servifinance:customer-request-notifications:${tenantDomainSlug}:${customerUserId}`;
}

function trimNotificationText(value: string, maxLength = 140) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function CustomerShell({ session, children }: Props) {
  const { tenantDomainSlug = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => getNotificationPermissionState());
  const [notificationBanner, setNotificationBanner] = useState<NotificationBanner | null>(null);
  const lastScrollYRef = useRef(0);
  const isScrollTickingRef = useRef(false);
  const notificationCursorRef = useRef<string | null>(null);
  const isNotificationPollingRef = useRef(false);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const navItems = buildCustomerNav(tenantDomainSlug);
  const isAuthenticated = session !== null;
  const notificationStorageKey = session
    ? buildNotificationStorageKey(session.tenantDomainSlug, session.userId)
    : null;

  useEffect(() => {
    setIsDrawerOpen(false);
    setIsHeaderVisible(true);
    lastScrollYRef.current = window.scrollY;
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrollTickingRef.current) {
        return;
      }

      isScrollTickingRef.current = true;
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollYRef.current;

        if (currentScrollY < 16 || scrollDelta < -8) {
          setIsHeaderVisible(true);
        } else if (scrollDelta > 8 && currentScrollY > 96 && !isDrawerOpen) {
          setIsHeaderVisible(false);
        }

        lastScrollYRef.current = currentScrollY;
        isScrollTickingRef.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    const permission = getNotificationPermissionState();
    setNotificationPermission(permission);
    notificationCursorRef.current = null;
    seenNotificationIdsRef.current.clear();

    if (!session) {
      setNotificationBanner(null);
      return;
    }

    if (permission === "default") {
      setNotificationBanner({
        tone: "info",
        title: "Enable browser notifications",
        message: "Allow browser notifications so tenant-side request updates can reach you instantly, even when this tab is in the background.",
        canPrompt: true
      });
      return;
    }

    if (permission === "granted") {
      setNotificationBanner(null);
      return;
    }

    if (permission === "denied") {
      setNotificationBanner({
        tone: "warning",
        title: "Browser notifications are blocked",
        message: "Request updates can still appear inside the portal, but instant browser alerts are blocked until you re-enable them in browser site settings.",
        canPrompt: false
      });
      return;
    }

    setNotificationBanner({
      tone: "warning",
      title: "Browser notifications are unavailable",
      message: "This browser cannot show web notifications, so request movement will appear as in-app alerts only.",
      canPrompt: false
    });
  }, [session?.tenantDomainSlug, session?.userId]);

  useEffect(() => {
    const storageKey = notificationStorageKey!;
    if (!storageKey) {
      return;
    }

    let isCancelled = false;

    async function bootstrapNotifications() {
      const storedCursor = window.localStorage.getItem(storageKey);
      if (storedCursor) {
        notificationCursorRef.current = storedCursor;
        return;
      }

      try {
        const baseline = await fetchCustomerRequestNotifications();
        if (isCancelled) {
          return;
        }

        notificationCursorRef.current = baseline.cursorUtc;
        window.localStorage.setItem(storageKey, baseline.cursorUtc);
      } catch {
        const fallbackCursor = new Date().toISOString();
        notificationCursorRef.current = fallbackCursor;
        window.localStorage.setItem(storageKey, fallbackCursor);
      }
    }

    void bootstrapNotifications();

    return () => {
      isCancelled = true;
    };
  }, [notificationStorageKey]);

  useEffect(() => {
    const storageKey = notificationStorageKey!;
    if (!storageKey || !session) {
      return;
    }

    let isDisposed = false;

    async function pollNotifications() {
      if (isDisposed || isNotificationPollingRef.current) {
        return;
      }

      isNotificationPollingRef.current = true;
      try {
        if (!notificationCursorRef.current) {
          const baseline = await fetchCustomerRequestNotifications();
          if (isDisposed) {
            return;
          }

          notificationCursorRef.current = baseline.cursorUtc;
          window.localStorage.setItem(storageKey, baseline.cursorUtc);
          return;
        }

        const cursorUtc = notificationCursorRef.current;
        const feed = await fetchCustomerRequestNotifications(cursorUtc);
        if (isDisposed) {
          return;
        }

        const unseenEvents = feed.events.filter((event) => !seenNotificationIdsRef.current.has(event.id));
        unseenEvents.forEach((event) => {
          seenNotificationIdsRef.current.add(event.id);
        });

        notificationCursorRef.current = feed.cursorUtc;
        window.localStorage.setItem(storageKey, feed.cursorUtc);

        if (unseenEvents.length === 0) {
          return;
        }

        const latestEvent = unseenEvents[unseenEvents.length - 1];
        const updateCountLabel = unseenEvents.length === 1
          ? "1 new request update"
          : `${unseenEvents.length} new request updates`;
        const defaultMessage = `${latestEvent.requestNumber} is now ${latestEvent.status}. ${trimNotificationText(latestEvent.remarks, 96)}`;

        if (notificationPermission === "granted" && typeof window !== "undefined" && "Notification" in window) {
          if (document.visibilityState === "visible") {
            toast.info({
              title: updateCountLabel,
              message: defaultMessage
            });
          } else {
            unseenEvents.forEach((event) => {
              new window.Notification(`Request updated: ${event.requestNumber}`, {
                body: `${event.status} • ${trimNotificationText(event.remarks, 96)}`,
                tag: `customer-request-${event.id}`
              });
            });
          }

          return;
        }

        if (notificationPermission === "denied") {
          setNotificationBanner({
            tone: "warning",
            title: "Browser notifications are blocked",
            message: `${updateCountLabel} arrived while notifications were denied. Open browser site settings to re-enable alerts for this tenant domain.`,
            canPrompt: false
          });
          toast.warning({
            title: "Request update available",
            message: `${defaultMessage} Notifications are currently blocked in this browser.`
          });
          return;
        }

        if (notificationPermission === "default") {
          setNotificationBanner({
            tone: "info",
            title: "Enable browser notifications",
            message: `${updateCountLabel} arrived. Allow notifications so future tenant-side request movement can reach you instantly.`,
            canPrompt: true
          });
          toast.info({
            title: "Request update available",
            message: `${defaultMessage} Enable browser notifications for instant alerts.`
          });
          return;
        }

        setNotificationBanner({
          tone: "warning",
          title: "Browser notifications are unavailable",
          message: `${updateCountLabel} arrived, but this browser cannot show web notifications. Keep the portal open for in-app alerts.`,
          canPrompt: false
        });
        toast.info({
          title: "Request update available",
          message: defaultMessage
        });
      } catch {
        // Notification polling should fail quietly and retry on the next interval.
      } finally {
        isNotificationPollingRef.current = false;
      }
    }

    const timerId = window.setInterval(() => {
      void pollNotifications();
    }, 30000);

    void pollNotifications();

    return () => {
      isDisposed = true;
      window.clearInterval(timerId);
    };
  }, [notificationPermission, notificationStorageKey, session?.userId, toast]);

  async function handleLogout() {
    await logoutCustomerAccount();
    navigate(`/t/${tenantDomainSlug}/c/login`, { replace: true });
  }

  async function handleIdleLogout() {
    await logoutCustomerAccount();
    navigate(`/t/${tenantDomainSlug}/c/login`, { replace: true });
  }

  async function handleEnableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setNotificationBanner({
        tone: "warning",
        title: "Browser notifications are unavailable",
        message: "This browser does not support the Notification API for web alerts.",
        canPrompt: false
      });
      return;
    }

    if (!window.isSecureContext) {
      setNotificationBanner({
        tone: "warning",
        title: "Notification permission cannot be requested here",
        message: "Browser notifications require a secure origin. Use HTTPS or localhost to enable them.",
        canPrompt: false
      });
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        setNotificationBanner(null);
        toast.success({
          title: "Browser notifications enabled",
          message: "Tenant-side request movement can now reach you instantly while this customer portal stays signed in."
        });
        return;
      }

      if (permission === "denied") {
        setNotificationBanner({
          tone: "warning",
          title: "Browser notifications are blocked",
          message: "This browser denied notification permission. Open browser site settings if you want to enable alerts later.",
          canPrompt: false
        });
        toast.warning({
          title: "Notifications blocked",
          message: "Browser permission was denied, so future request updates will stay inside the portal only."
        });
        return;
      }

      setNotificationBanner({
        tone: "info",
        title: "Enable browser notifications",
        message: "Permission is still pending. Allow notifications when the browser prompts so request movement can reach you instantly.",
        canPrompt: true
      });
    } catch {
      toast.error({
        title: "Unable to request notifications",
        message: "The browser could not open the notification permission prompt right now."
      });
    }
  }

  const authLinks = isAuthenticated
    ? navItems
    : [
        {
          to: `/t/${tenantDomainSlug}/c/login`,
          label: "Login",
          eyebrow: "Access"
        },
        {
          to: `/t/${tenantDomainSlug}/c/register`,
          label: "Register",
          eyebrow: "Create"
        }
      ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(163,202,255,0.24),transparent_24%),linear-gradient(180deg,#f7fbff_0%,#eff4fb_46%,#f5f7fb_100%)] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] lg:gap-5 lg:px-5 lg:py-5">
        <div
          className={joinClasses(
            "fixed inset-0 z-40 bg-slate-950/34 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
            isDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={joinClasses(
            "fixed inset-y-0 left-0 z-50 flex w-[min(86vw,21rem)] flex-col overflow-y-auto overscroll-contain border-r border-slate-200/70 bg-white/96 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_22px_50px_rgba(33,44,74,0.18)] backdrop-blur-xl transition-transform duration-300 lg:sticky lg:inset-auto lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[290px] lg:shrink-0 lg:self-start lg:translate-x-0 lg:rounded-[2rem] lg:border lg:pb-8 lg:shadow-[0_20px_45px_rgba(42,56,92,0.08)]",
            isDrawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,#102147_0%,#2d5fff_100%)] text-sm font-semibold uppercase tracking-[0.16em] text-white">
                C
              </span>
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-slate-500">Customer Portal</p>
                <h1 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{tenantDomainSlug}</h1>
              </div>
            </div>

            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 lg:hidden"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close customer navigation"
            >
              <span className="text-xl leading-none">&lt;</span>
            </button>
          </div>

          <div className="mt-8 rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(240,246,255,0.92),rgba(255,255,255,0.92))] px-4 py-4">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.22em] text-slate-500">
              {isAuthenticated ? "Signed in" : "Tenant-scoped access"}
            </p>
            {session ? (
              <>
                <strong className="mt-2 block text-lg text-slate-950">{session.fullName}</strong>
                <p className="mt-1 text-sm text-slate-600">{session.email}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your customer profile and activity stay isolated inside this tenant domain.
                </p>
              </>
            ) : (
              <>
                <strong className="mt-2 block text-lg text-slate-950">Separate from SMS staff access</strong>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Customer login and registration stay under `/t/&lbrace;tenant&rbrace;/c/*` so tenant staff and customer journeys do not mix.
                </p>
              </>
            )}
          </div>

          <nav className="mt-8 grid gap-2">
            {authLinks.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  joinClasses(
                    "group rounded-[1.4rem] px-4 py-3 no-underline transition-colors duration-200",
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={joinClasses(
                        "block text-[0.7rem] font-bold uppercase tracking-[0.2em]",
                        isActive ? "text-white/60" : "text-slate-400"
                      )}
                    >
                      {item.eyebrow}
                    </span>
                    <span className="mt-1 block text-sm font-semibold tracking-[0.01em]">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 border-t border-slate-200/70 pt-5">
            {isAuthenticated ? (
              <button
                type="button"
                className="btn w-full rounded-full border-slate-300 bg-white text-slate-900 shadow-none hover:bg-slate-100"
                onClick={handleLogout}
              >
                Sign out
              </button>
            ) : (
              <p className="px-2 text-sm leading-6 text-slate-500">
                Accounts are tenant-scoped. Registering here does not create access for other tenant domains.
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header
            className={joinClasses(
              "sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/70 bg-white/84 px-4 py-4 backdrop-blur-xl transition-transform duration-300 ease-out lg:rounded-[2rem] lg:border lg:px-6 lg:shadow-[0_16px_34px_rgba(35,46,76,0.06)]",
              isHeaderVisible ? "translate-y-0" : "-translate-y-[calc(100%+0.75rem)]"
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Open customer navigation"
              >
                <span className="flex flex-col gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                </span>
              </button>

              <div className="min-w-0">
                <p className="truncate text-[0.72rem] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {tenantDomainSlug} / Customer
                </p>
                <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-950">
                  {session ? `Welcome back, ${session.fullName.split(" ")[0]}` : "Customer Access"}
                </h2>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                {session ? session.email : "Tenant-scoped registration and login"}
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-5">
            <div className="mx-auto w-full max-w-[1120px]">
              {session && notificationBanner && (
                <section
                  className={joinClasses(
                    "mb-5 rounded-[1.7rem] border px-4 py-4 shadow-[0_12px_28px_rgba(35,46,76,0.06)] sm:px-5",
                    notificationBanner.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-sky-200 bg-sky-50 text-sky-900"
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em]">
                        {notificationBanner.tone === "warning" ? "Notification status" : "Instant request alerts"}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em]">
                        {notificationBanner.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-current/80">
                        {notificationBanner.message}
                      </p>
                    </div>

                    {notificationBanner.canPrompt && (
                      <button
                        type="button"
                        className="btn rounded-full border-none bg-slate-950 px-5 text-white hover:bg-slate-800 sm:w-auto"
                        onClick={handleEnableNotifications}
                      >
                        Enable notifications
                      </button>
                    )}
                  </div>
                </section>
              )}

              {children}
            </div>
          </main>
        </div>
      </div>
      {session ? (
        <IdleLogoutGuard workspaceLabel="the customer portal" onLogout={handleIdleLogout} />
      ) : null}
    </div>
  );
}
