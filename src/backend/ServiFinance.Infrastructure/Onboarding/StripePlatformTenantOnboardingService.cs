using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.Checkout;
using ServiFinance.Application.Onboarding;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Data;
using StripeInvoice = Stripe.Invoice;

namespace ServiFinance.Infrastructure.Onboarding;

public sealed class StripePlatformTenantOnboardingService(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<AppUser> passwordHasher,
    IOptions<StripeBillingOptions> stripeOptionsAccessor,
    TimeProvider timeProvider) : IPlatformTenantOnboardingService {
  private const string CheckoutCreatedStatus = "CheckoutCreated";
  private const string CheckoutExpiredStatus = "CheckoutExpired";
  private const string CheckoutFailedStatus = "CheckoutFailed";
  private const string PaymentCompletedStatus = "PaymentCompleted";
  private const string ProvisionedStatus = "Provisioned";
  private const string ProvisioningFailedStatus = "ProvisioningFailed";

  private static readonly Regex SubscriptionAmountPattern = new(@"([\d,]+(?:\.\d+)?)", RegexOptions.Compiled);
  private static readonly Regex SlugCleanupPattern = new(@"[^a-z0-9-]+", RegexOptions.Compiled);
  private static readonly Regex HyphenCollapsePattern = new(@"-{2,}", RegexOptions.Compiled);

  private readonly StripeBillingOptions _stripeOptions = stripeOptionsAccessor.Value;

  public bool IsConfigured => !string.IsNullOrWhiteSpace(_stripeOptions.SecretKey);

  public async Task<StripeTenantCheckoutSession> CreateCheckoutSessionAsync(
      CreatePlatformTenantCheckoutRequest request,
      string baseUrl,
      CancellationToken cancellationToken = default) {
    EnsureConfigured();

    var normalizedBusinessName = request.BusinessName.Trim();
    var normalizedOwnerName = request.OwnerFullName.Trim();
    var normalizedOwnerEmail = request.OwnerEmail.Trim();
    var normalizedDomainSlug = NormalizeDomainSlug(request.DomainSlug);
    if (string.IsNullOrWhiteSpace(normalizedBusinessName)) {
      throw new InvalidOperationException("Enter the business name.");
    }

    if (string.IsNullOrWhiteSpace(normalizedDomainSlug)) {
      throw new InvalidOperationException("Enter a valid tenant domain slug.");
    }

    if (string.IsNullOrWhiteSpace(normalizedOwnerName)) {
      throw new InvalidOperationException("Enter the owner full name.");
    }

    if (string.IsNullOrWhiteSpace(normalizedOwnerEmail)) {
      throw new InvalidOperationException("Enter the owner email.");
    }

    if (string.IsNullOrWhiteSpace(request.OwnerPassword) || request.OwnerPassword.Length < 8) {
      throw new InvalidOperationException("Owner password must be at least 8 characters.");
    }

    if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri)) {
      throw new InvalidOperationException("The platform checkout base URL could not be resolved.");
    }

    var subscriptionTier = await dbContext.SubscriptionTiers
        .AsNoTracking()
        .SingleOrDefaultAsync(
            entity => entity.Id == request.SubscriptionTierId && entity.IsActive,
            cancellationToken);
    if (subscriptionTier is null) {
      throw new InvalidOperationException("The selected subscription tier is not available.");
    }

    var tierAmount = TryParseSubscriptionAmount(subscriptionTier.PriceDisplay);
    if (!tierAmount.HasValue || tierAmount.Value <= 0m) {
      throw new InvalidOperationException("The selected subscription tier does not have a valid recurring amount yet.");
    }

    var normalizedOwnerEmailUpper = normalizedOwnerEmail.ToUpperInvariant();
    var tenantSlugTaken = await dbContext.Tenants
        .IgnoreQueryFilters()
        .AnyAsync(entity => entity.DomainSlug == normalizedDomainSlug, cancellationToken);
    if (tenantSlugTaken) {
      throw new InvalidOperationException("That tenant domain slug is already registered.");
    }

    var ownerEmailTaken = await dbContext.Users
        .IgnoreQueryFilters()
        .AnyAsync(entity => entity.Email.ToUpper() == normalizedOwnerEmailUpper, cancellationToken);
    if (ownerEmailTaken) {
      throw new InvalidOperationException("That owner email is already used by another tenant account.");
    }

    var blockingRegistration = await dbContext.PlatformTenantRegistrations
        .Where(
            entity =>
                entity.DomainSlug == normalizedDomainSlug &&
                (entity.Status == CheckoutCreatedStatus ||
                 entity.Status == PaymentCompletedStatus ||
                 entity.Status == ProvisionedStatus))
        .OrderByDescending(entity => entity.CreatedAtUtc)
        .FirstOrDefaultAsync(cancellationToken);
    if (blockingRegistration is not null) {
      var reusableSession = await TryResolveBlockingRegistrationAsync(
          blockingRegistration,
          normalizedOwnerEmail,
          cancellationToken);
      if (reusableSession is not null) {
        return reusableSession;
      }
    }

    var hasBlockingRegistration = await dbContext.PlatformTenantRegistrations
        .AsNoTracking()
        .AnyAsync(
            entity =>
                entity.DomainSlug == normalizedDomainSlug &&
                (entity.Status == CheckoutCreatedStatus ||
                 entity.Status == PaymentCompletedStatus ||
                 entity.Status == ProvisionedStatus),
            cancellationToken);
    if (hasBlockingRegistration) {
      throw new InvalidOperationException("A registration is already in progress for that tenant domain.");
    }

    var tempUser = new AppUser {
      FullName = normalizedOwnerName,
      Email = normalizedOwnerEmail
    };
    var registration = new PlatformTenantRegistration {
      SubscriptionTierId = subscriptionTier.Id,
      BusinessName = normalizedBusinessName,
      TenantCode = BuildTenantCode(normalizedDomainSlug),
      DomainSlug = normalizedDomainSlug,
      OwnerFullName = normalizedOwnerName,
      OwnerEmail = normalizedOwnerEmail,
      OwnerPasswordHash = passwordHasher.HashPassword(tempUser, request.OwnerPassword),
      Status = CheckoutCreatedStatus,
      CreatedAtUtc = GetUtcNow(),
      UpdatedAtUtc = GetUtcNow(),
      CheckoutExpiresAtUtc = GetUtcNow().AddHours(1)
    };

    dbContext.PlatformTenantRegistrations.Add(registration);
    await dbContext.SaveChangesAsync(cancellationToken);

    try {
      var sessionService = new SessionService(BuildStripeClient());
      var session = await sessionService.CreateAsync(
          new SessionCreateOptions {
            Mode = "subscription",
            SuccessUrl = BuildAbsoluteUrl(baseUri, $"/register?checkout=success&session_id={{CHECKOUT_SESSION_ID}}"),
            CancelUrl = BuildAbsoluteUrl(baseUri, "/register?checkout=canceled"),
            CustomerEmail = normalizedOwnerEmail,
            ClientReferenceId = registration.Id.ToString("N"),
            Metadata = new Dictionary<string, string> {
              ["registrationId"] = registration.Id.ToString("N"),
              ["subscriptionTierId"] = subscriptionTier.Id.ToString("N"),
              ["tenantDomainSlug"] = normalizedDomainSlug
            },
            LineItems = [
                new SessionLineItemOptions {
                  Quantity = 1,
                  PriceData = new SessionLineItemPriceDataOptions {
                    Currency = "php",
                    UnitAmountDecimal = tierAmount.Value * 100m,
                    ProductData = new SessionLineItemPriceDataProductDataOptions {
                      Name = subscriptionTier.DisplayName,
                      Description = subscriptionTier.PlanSummary
                    },
                    Recurring = new SessionLineItemPriceDataRecurringOptions {
                      Interval = "month"
                    }
                  }
                }
            ],
            SubscriptionData = new SessionSubscriptionDataOptions {
              Metadata = new Dictionary<string, string> {
                ["registrationId"] = registration.Id.ToString("N"),
                ["subscriptionTierId"] = subscriptionTier.Id.ToString("N"),
                ["tenantDomainSlug"] = normalizedDomainSlug
              }
            }
          },
          cancellationToken: cancellationToken);

      registration.StripeCheckoutSessionId = session.Id;
      registration.CheckoutExpiresAtUtc = registration.CheckoutExpiresAtUtc;
      registration.UpdatedAtUtc = GetUtcNow();
      await dbContext.SaveChangesAsync(cancellationToken);

      return new StripeTenantCheckoutSession(registration.Id, session.Id, session.Url);
    } catch (Exception ex) {
      registration.Status = CheckoutFailedStatus;
      registration.FailureReason = ex.Message;
      registration.UpdatedAtUtc = GetUtcNow();
      await dbContext.SaveChangesAsync(cancellationToken);
      throw;
    }
  }

  public async Task<PlatformTenantRegistrationStatus?> GetRegistrationStatusAsync(
      string checkoutSessionId,
      CancellationToken cancellationToken = default) {
    var normalizedSessionId = checkoutSessionId?.Trim();
    if (string.IsNullOrWhiteSpace(normalizedSessionId)) {
      return null;
    }

    var registration = await dbContext.PlatformTenantRegistrations
        .Include(entity => entity.Tenant)
        .Include(entity => entity.SubscriptionTier)
        .SingleOrDefaultAsync(entity => entity.StripeCheckoutSessionId == normalizedSessionId, cancellationToken);
    if (registration is null) {
      return null;
    }

    if (registration.Status == CheckoutCreatedStatus) {
      await TryRefreshRegistrationFromStripeAsync(registration, cancellationToken);
      if (registration.TenantId.HasValue && registration.Tenant is null) {
        await dbContext.Entry(registration)
            .Reference(entity => entity.Tenant)
            .LoadAsync(cancellationToken);
      }
    }

    var tenantLoginUrl = registration.TenantId.HasValue
        ? $"/t/{registration.DomainSlug}/sms/"
        : null;

    return new PlatformTenantRegistrationStatus(
        registration.Id,
        registration.Status,
        registration.BusinessName,
        registration.DomainSlug,
        registration.OwnerEmail,
        registration.SubscriptionTier?.DisplayName ?? registration.Tenant?.SubscriptionPlan ?? "Selected plan",
        registration.SubscriptionTier?.SubscriptionEdition ?? registration.Tenant?.SubscriptionEdition ?? "Unknown",
        registration.Tenant?.BillingProvider,
        registration.Tenant?.SubscriptionStatus,
        registration.FailureReason,
        registration.TenantId,
        tenantLoginUrl,
        registration.CreatedAtUtc,
        registration.ProvisionedAtUtc);
  }

  private async Task<StripeTenantCheckoutSession?> TryResolveBlockingRegistrationAsync(
      PlatformTenantRegistration registration,
      string ownerEmail,
      CancellationToken cancellationToken) {
    if (!string.Equals(registration.OwnerEmail, ownerEmail, StringComparison.OrdinalIgnoreCase)) {
      throw new InvalidOperationException("A registration is already in progress for that tenant domain.");
    }

    if (registration.TenantId.HasValue || registration.Status == ProvisionedStatus) {
      return new StripeTenantCheckoutSession(
          registration.Id,
          registration.StripeCheckoutSessionId ?? string.Empty,
          $"/t/{registration.DomainSlug}/sms/");
    }

    if (registration.Status == PaymentCompletedStatus) {
      await ProvisionTenantAsync(registration, cancellationToken);
      if (registration.TenantId.HasValue) {
        return new StripeTenantCheckoutSession(
            registration.Id,
            registration.StripeCheckoutSessionId ?? string.Empty,
            $"/t/{registration.DomainSlug}/sms/");
      }

      throw new InvalidOperationException(
          registration.FailureReason ?? "The previous checkout completed, but tenant provisioning is still unresolved.");
    }

    if (registration.Status != CheckoutCreatedStatus) {
      return null;
    }

    if (string.IsNullOrWhiteSpace(registration.StripeCheckoutSessionId)) {
      if (IsRegistrationLocallyExpired(registration)) {
        await MarkRegistrationCheckoutExpiredAsync(registration, cancellationToken);
        return null;
      }

      throw new InvalidOperationException("A registration is already in progress for that tenant domain.");
    }

    var session = await TryGetStripeCheckoutSessionAsync(registration.StripeCheckoutSessionId, cancellationToken);
    if (session is null) {
      if (IsRegistrationLocallyExpired(registration)) {
        await MarkRegistrationCheckoutExpiredAsync(registration, cancellationToken);
        return null;
      }

      throw new InvalidOperationException("A registration is already in progress for that tenant domain.");
    }

    if (IsCheckoutSessionComplete(session)) {
      await CompleteRegistrationFromCheckoutSessionAsync(registration, session, cancellationToken);
      if (registration.TenantId.HasValue) {
        return new StripeTenantCheckoutSession(
            registration.Id,
            session.Id,
            $"/t/{registration.DomainSlug}/sms/");
      }

      throw new InvalidOperationException(
          registration.FailureReason ?? "The previous checkout completed, but tenant provisioning is still unresolved.");
    }

    if (IsCheckoutSessionExpired(session)) {
      await MarkRegistrationCheckoutExpiredAsync(registration, cancellationToken);
      return null;
    }

    if (!string.IsNullOrWhiteSpace(session.Url)) {
      return new StripeTenantCheckoutSession(registration.Id, session.Id, session.Url);
    }

    throw new InvalidOperationException("A registration is already in progress for that tenant domain.");
  }

  private async Task TryRefreshRegistrationFromStripeAsync(
      PlatformTenantRegistration registration,
      CancellationToken cancellationToken) {
    if (string.IsNullOrWhiteSpace(registration.StripeCheckoutSessionId)) {
      return;
    }

    var session = await TryGetStripeCheckoutSessionAsync(registration.StripeCheckoutSessionId, cancellationToken);
    if (session is null) {
      return;
    }

    if (IsCheckoutSessionComplete(session)) {
      await CompleteRegistrationFromCheckoutSessionAsync(registration, session, cancellationToken);
      return;
    }

    if (IsCheckoutSessionExpired(session)) {
      await MarkRegistrationCheckoutExpiredAsync(registration, cancellationToken);
    }
  }

  private async Task CompleteRegistrationFromCheckoutSessionAsync(
      PlatformTenantRegistration registration,
      Session session,
      CancellationToken cancellationToken) {
    registration.StripeCheckoutSessionId ??= session.Id;
    registration.StripeCustomerId = session.CustomerId;
    registration.StripeSubscriptionId = session.SubscriptionId;
    registration.Status = registration.TenantId.HasValue ? registration.Status : PaymentCompletedStatus;
    registration.FailureReason = null;
    registration.UpdatedAtUtc = GetUtcNow();
    await dbContext.SaveChangesAsync(cancellationToken);

    if (registration.TenantId.HasValue || registration.ProvisionedAtUtc.HasValue) {
      return;
    }

    await ProvisionTenantAsync(registration, cancellationToken);
  }

  private async Task<Session?> TryGetStripeCheckoutSessionAsync(
      string checkoutSessionId,
      CancellationToken cancellationToken) {
    try {
      var sessionService = new SessionService(BuildStripeClient());
      return await sessionService.GetAsync(checkoutSessionId, cancellationToken: cancellationToken);
    } catch (StripeException) {
      return null;
    }
  }

  private async Task MarkRegistrationCheckoutExpiredAsync(
      PlatformTenantRegistration registration,
      CancellationToken cancellationToken) {
    registration.Status = CheckoutExpiredStatus;
    registration.FailureReason = "The previous Stripe checkout expired before payment completed.";
    registration.UpdatedAtUtc = GetUtcNow();
    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private bool IsRegistrationLocallyExpired(PlatformTenantRegistration registration) =>
    registration.CheckoutExpiresAtUtc.HasValue && registration.CheckoutExpiresAtUtc.Value <= GetUtcNow();

  private static bool IsCheckoutSessionComplete(Session session) =>
    string.Equals(session.Status, "complete", StringComparison.OrdinalIgnoreCase) ||
    string.Equals(session.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase);

  private static bool IsCheckoutSessionExpired(Session session) =>
    string.Equals(session.Status, "expired", StringComparison.OrdinalIgnoreCase);

  public async Task ProcessWebhookAsync(
      string payload,
      string? signatureHeader,
      CancellationToken cancellationToken = default) {
    EnsureConfigured();

    if (string.IsNullOrWhiteSpace(_stripeOptions.WebhookSecret)) {
      throw new InvalidOperationException("Stripe webhook secret is not configured.");
    }

    var stripeEvent = EventUtility.ConstructEvent(payload, signatureHeader, _stripeOptions.WebhookSecret);
    switch (stripeEvent.Type) {
      case "checkout.session.completed":
        if (stripeEvent.Data.Object is Session completedSession) {
          await HandleCheckoutSessionCompletedAsync(completedSession, cancellationToken);
        }
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        if (stripeEvent.Data.Object is Subscription subscription) {
          await HandleSubscriptionUpdatedAsync(subscription, cancellationToken);
        }
        break;
      case "invoice.paid":
        if (stripeEvent.Data.Object is StripeInvoice paidInvoice) {
          await HandleInvoicePaidAsync(paidInvoice, cancellationToken);
        }
        break;
      case "invoice.payment_failed":
        if (stripeEvent.Data.Object is StripeInvoice failedInvoice) {
          await HandleInvoicePaymentFailedAsync(failedInvoice, cancellationToken);
        }
        break;
    }
  }

  public async Task<TenantBillingPortalSession> CreateBillingPortalSessionAsync(
      Guid tenantId,
      string returnUrl,
      CancellationToken cancellationToken = default) {
    EnsureConfigured();

    var tenant = await dbContext.Tenants
        .SingleOrDefaultAsync(entity => entity.Id == tenantId, cancellationToken);
    if (tenant is null) {
      throw new InvalidOperationException("Tenant billing context could not be resolved.");
    }

    if (!string.Equals(tenant.BillingProvider, "Stripe", StringComparison.OrdinalIgnoreCase) ||
        string.IsNullOrWhiteSpace(tenant.StripeCustomerId)) {
      throw new InvalidOperationException("Stripe billing is not active for this tenant.");
    }

    var portalService = new Stripe.BillingPortal.SessionService(BuildStripeClient());
    var portalSession = await portalService.CreateAsync(
        new Stripe.BillingPortal.SessionCreateOptions {
          Customer = tenant.StripeCustomerId,
          ReturnUrl = returnUrl
        },
        cancellationToken: cancellationToken);

    return new TenantBillingPortalSession(portalSession.Url);
  }

  private async Task HandleCheckoutSessionCompletedAsync(Session session, CancellationToken cancellationToken) {
    var registration = await ResolveRegistrationAsync(session, cancellationToken);
    if (registration is null) {
      return;
    }

    await CompleteRegistrationFromCheckoutSessionAsync(registration, session, cancellationToken);
  }

  private async Task HandleSubscriptionUpdatedAsync(Subscription subscription, CancellationToken cancellationToken) {
    var tenant = await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(
            entity => entity.StripeSubscriptionId == subscription.Id ||
                (!string.IsNullOrWhiteSpace(subscription.CustomerId) && entity.StripeCustomerId == subscription.CustomerId),
            cancellationToken);
    if (tenant is null) {
      return;
    }

    tenant.StripeCustomerId = subscription.CustomerId ?? tenant.StripeCustomerId;
    tenant.StripeSubscriptionId = subscription.Id;
    ApplySubscriptionState(tenant, subscription.Status);
    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task HandleInvoicePaidAsync(StripeInvoice invoice, CancellationToken cancellationToken) {
    var tenant = await ResolveTenantByInvoiceAsync(invoice, cancellationToken);
    if (tenant is null) {
      return;
    }

    ApplySubscriptionState(tenant, "Active");
    await UpsertStripeBillingRecordAsync(tenant, invoice, isPaid: true, cancellationToken);
  }

  private async Task HandleInvoicePaymentFailedAsync(StripeInvoice invoice, CancellationToken cancellationToken) {
    var tenant = await ResolveTenantByInvoiceAsync(invoice, cancellationToken);
    if (tenant is null) {
      return;
    }

    if (tenant.IsActive) {
      tenant.SubscriptionStatus = "Past due";
    }

    await UpsertStripeBillingRecordAsync(tenant, invoice, isPaid: false, cancellationToken);
  }

  private async Task ProvisionTenantAsync(PlatformTenantRegistration registration, CancellationToken cancellationToken) {
    var subscriptionTier = await dbContext.SubscriptionTiers
        .AsNoTracking()
        .SingleOrDefaultAsync(entity => entity.Id == registration.SubscriptionTierId, cancellationToken);
    if (subscriptionTier is null) {
      registration.Status = ProvisioningFailedStatus;
      registration.FailureReason = "The selected subscription tier no longer exists.";
      registration.UpdatedAtUtc = GetUtcNow();
      await dbContext.SaveChangesAsync(cancellationToken);
      return;
    }

    var tenantSlugTaken = await dbContext.Tenants
        .IgnoreQueryFilters()
        .AnyAsync(entity => entity.DomainSlug == registration.DomainSlug, cancellationToken);
    if (tenantSlugTaken) {
      registration.Status = ProvisioningFailedStatus;
      registration.FailureReason = "The requested tenant domain slug was taken before provisioning completed.";
      registration.UpdatedAtUtc = GetUtcNow();
      await dbContext.SaveChangesAsync(cancellationToken);
      return;
    }

    var ownerEmailUpper = registration.OwnerEmail.ToUpperInvariant();
    var ownerEmailTaken = await dbContext.Users
        .IgnoreQueryFilters()
        .AnyAsync(entity => entity.Email.ToUpper() == ownerEmailUpper, cancellationToken);
    if (ownerEmailTaken) {
      registration.Status = ProvisioningFailedStatus;
      registration.FailureReason = "The owner email is already attached to another tenant account.";
      registration.UpdatedAtUtc = GetUtcNow();
      await dbContext.SaveChangesAsync(cancellationToken);
      return;
    }

    var tenant = new Tenant {
      Name = registration.BusinessName,
      Code = registration.TenantCode,
      DomainSlug = registration.DomainSlug,
      BusinessSizeSegment = subscriptionTier.BusinessSizeSegment,
      SubscriptionEdition = subscriptionTier.SubscriptionEdition,
      SubscriptionPlan = subscriptionTier.DisplayName,
      SubscriptionStatus = "Active",
      BillingProvider = "Stripe",
      StripeCustomerId = registration.StripeCustomerId,
      StripeSubscriptionId = registration.StripeSubscriptionId,
      CreatedAtUtc = GetUtcNow(),
      IsActive = true
    };
    var tenantTheme = new TenantTheme {
      TenantId = tenant.Id,
      DisplayName = registration.BusinessName
    };

    var administratorRole = new Role {
      TenantId = tenant.Id,
      Name = "Administrator",
      Description = "Full-access tenant administrator role."
    };
    var staffRole = new Role {
      TenantId = tenant.Id,
      Name = "Staff",
      Description = "Default staff role for service and finance users."
    };
    var ownerUser = new AppUser {
      TenantId = tenant.Id,
      FullName = registration.OwnerFullName,
      Email = registration.OwnerEmail,
      PasswordHash = registration.OwnerPasswordHash,
      CreatedAtUtc = GetUtcNow(),
      IsActive = true
    };

    dbContext.Tenants.Add(tenant);
    dbContext.TenantThemes.Add(tenantTheme);
    dbContext.Roles.Add(administratorRole);
    dbContext.Roles.Add(staffRole);
    dbContext.Users.Add(ownerUser);
    dbContext.UserRoles.Add(new UserRole {
      TenantId = tenant.Id,
      UserId = ownerUser.Id,
      RoleId = administratorRole.Id,
      AssignedAtUtc = GetUtcNow()
    });

    registration.TenantId = tenant.Id;
    registration.Status = ProvisionedStatus;
    registration.ProvisionedAtUtc = GetUtcNow();
    registration.UpdatedAtUtc = GetUtcNow();
    registration.FailureReason = null;

    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task<Tenant?> ResolveTenantByInvoiceAsync(StripeInvoice invoice, CancellationToken cancellationToken) {
    if (string.IsNullOrWhiteSpace(invoice.CustomerId)) {
      return null;
    }

    return await dbContext.Tenants
        .IgnoreQueryFilters()
        .SingleOrDefaultAsync(
            entity => entity.StripeCustomerId == invoice.CustomerId,
            cancellationToken);
  }

  private async Task UpsertStripeBillingRecordAsync(
      Tenant tenant,
      StripeInvoice invoice,
      bool isPaid,
      CancellationToken cancellationToken) {
    var submittedAtUtc = isPaid
        ? invoice.StatusTransitions?.PaidAt?.ToUniversalTime() ?? GetUtcNow()
        : GetUtcNow();
    var existingRecord = await dbContext.TenantBillingRecords
        .SingleOrDefaultAsync(
            entity => entity.TenantId == tenant.Id && entity.ReferenceNumber == invoice.Id,
            cancellationToken);
    var latestConfirmedRecord = await dbContext.TenantBillingRecords
        .AsNoTracking()
        .Where(entity => entity.TenantId == tenant.Id && entity.Status == "Confirmed")
        .OrderByDescending(entity => entity.CoverageEndUtc)
        .ThenByDescending(entity => entity.SubmittedAtUtc)
        .FirstOrDefaultAsync(cancellationToken);

    var coverageStartUtc = latestConfirmedRecord is null
        ? submittedAtUtc.Date
        : latestConfirmedRecord.CoverageEndUtc.Date.AddDays(1);
    var coverageEndUtc = coverageStartUtc.AddMonths(1).AddDays(-1);
    var billingActorUserId = await ResolveBillingActorUserIdAsync(tenant.Id, cancellationToken);
    var amountDue = invoice.AmountDue / 100m;
    var amountPaid = invoice.AmountPaid / 100m;
    if (existingRecord is null) {
      existingRecord = new TenantBillingRecord {
        TenantId = tenant.Id,
        SubmittedByUserId = billingActorUserId,
        BillingPeriodLabel = $"{coverageStartUtc:MMMM yyyy} subscription cycle",
        CoverageStartUtc = coverageStartUtc,
        CoverageEndUtc = coverageEndUtc,
        DueDateUtc = submittedAtUtc.Date,
        ReferenceNumber = invoice.Id,
        PaymentMethod = "Stripe",
        Note = "Automatically synced from the Stripe subscription ledger.",
        SubmittedAtUtc = submittedAtUtc
      };
      dbContext.TenantBillingRecords.Add(existingRecord);
    }

    existingRecord.AmountDue = amountDue > 0m ? amountDue : amountPaid;
    existingRecord.AmountSubmitted = isPaid ? amountPaid : 0m;
    existingRecord.Status = isPaid ? "Confirmed" : "Payment failed";
    existingRecord.ReviewRemarks = isPaid
        ? "Automatically confirmed from Stripe invoice payment."
        : "Stripe reported that the recurring subscription invoice payment failed.";
    existingRecord.ReviewedAtUtc = submittedAtUtc;

    await dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task<Guid> ResolveBillingActorUserIdAsync(Guid tenantId, CancellationToken cancellationToken) {
    var administratorUserId = await dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == tenantId)
        .Join(
            dbContext.UserRoles.IgnoreQueryFilters(),
            user => user.Id,
            roleLink => roleLink.UserId,
            (user, roleLink) => new { user.Id, roleLink.RoleId })
        .Join(
            dbContext.Roles.IgnoreQueryFilters(),
            link => link.RoleId,
            role => role.Id,
            (link, role) => new { link.Id, role.Name })
        .Where(entity => entity.Name == "Administrator")
        .Select(entity => entity.Id)
        .FirstOrDefaultAsync(cancellationToken);
    if (administratorUserId != Guid.Empty) {
      return administratorUserId;
    }

    var fallbackUserId = await dbContext.Users
        .IgnoreQueryFilters()
        .Where(entity => entity.TenantId == tenantId)
        .OrderBy(entity => entity.CreatedAtUtc)
        .Select(entity => entity.Id)
        .FirstOrDefaultAsync(cancellationToken);
    if (fallbackUserId == Guid.Empty) {
      throw new InvalidOperationException("No tenant billing actor user could be resolved.");
    }

    return fallbackUserId;
  }

  private async Task<PlatformTenantRegistration?> ResolveRegistrationAsync(Session session, CancellationToken cancellationToken) {
    var registrationIdText = session.ClientReferenceId;
    if (string.IsNullOrWhiteSpace(registrationIdText) &&
        session.Metadata is not null &&
        session.Metadata.TryGetValue("registrationId", out var metadataRegistrationId)) {
      registrationIdText = metadataRegistrationId;
    }

    if (!Guid.TryParse(registrationIdText, out var registrationId)) {
      return null;
    }

    return await dbContext.PlatformTenantRegistrations
        .Include(entity => entity.Tenant)
        .SingleOrDefaultAsync(entity => entity.Id == registrationId, cancellationToken);
  }

  private void ApplySubscriptionState(Tenant tenant, string? stripeSubscriptionStatus) {
    var normalizedStatus = stripeSubscriptionStatus?.Trim();
    if (string.IsNullOrWhiteSpace(normalizedStatus)) {
      return;
    }

    tenant.SubscriptionStatus = normalizedStatus switch {
      "active" => "Active",
      "trialing" => "Trialing",
      "past_due" => "Past due",
      "unpaid" => "Suspended",
      "canceled" => "Suspended",
      "paused" => "Suspended",
      "incomplete" => "Pending payment",
      "incomplete_expired" => "Suspended",
      _ => normalizedStatus
    };

    tenant.IsActive = normalizedStatus is "active" or "trialing" or "past_due";
  }

  private StripeClient BuildStripeClient() => new(_stripeOptions.SecretKey);

  private void EnsureConfigured() {
    if (!IsConfigured) {
      throw new InvalidOperationException("Stripe billing is not configured for this environment yet.");
    }
  }

  private DateTime GetUtcNow() => timeProvider.GetUtcNow().UtcDateTime;

  private static string NormalizeDomainSlug(string? domainSlug) {
    var normalized = domainSlug?.Trim().ToLowerInvariant() ?? string.Empty;
    normalized = SlugCleanupPattern.Replace(normalized.Replace(" ", "-", StringComparison.Ordinal), "-");
    normalized = HyphenCollapsePattern.Replace(normalized, "-").Trim('-');
    if (normalized.Length > 100) {
      normalized = normalized[..100].Trim('-');
    }

    return normalized;
  }

  private static string BuildTenantCode(string domainSlug) {
    var filtered = new string(domainSlug
        .ToUpperInvariant()
        .Where(char.IsLetterOrDigit)
        .ToArray());
    if (string.IsNullOrWhiteSpace(filtered)) {
      filtered = "TENANT";
    }

    return filtered.Length <= 50 ? filtered : filtered[..50];
  }

  private static string BuildAbsoluteUrl(Uri baseUri, string relativePath) =>
    new Uri(baseUri, relativePath).ToString();

  private static decimal? TryParseSubscriptionAmount(string? priceDisplay) {
    if (string.IsNullOrWhiteSpace(priceDisplay)) {
      return null;
    }

    var match = SubscriptionAmountPattern.Match(priceDisplay);
    if (!match.Success) {
      return null;
    }

    return decimal.TryParse(
        match.Groups[1].Value.Replace(",", string.Empty, StringComparison.Ordinal),
        NumberStyles.Number,
        CultureInfo.InvariantCulture,
        out var amount)
        ? amount
        : null;
  }
}
