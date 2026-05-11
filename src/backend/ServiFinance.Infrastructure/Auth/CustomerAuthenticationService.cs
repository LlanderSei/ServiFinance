namespace ServiFinance.Infrastructure.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;

public sealed class CustomerAuthenticationService(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<Customer> passwordHasher,
    IPasswordPolicyService passwordPolicyService) : ICustomerAuthenticationService {
  private const int EmailMaxLength = 50;
  private const int AddressMaxLength = 500;
  private const int AddressDetailsMaxLength = 500;

  public async Task<AuthenticatedUser?> AuthenticateAsync(string email, string password, string tenantDomainSlug, CancellationToken cancellationToken = default) {
    var tenantSlug = tenantDomainSlug.Trim().ToLowerInvariant();
    var normalizedEmail = email.Trim().ToLowerInvariant();

    var customer = await dbContext.Customers
        .AsNoTracking()
        .Include(c => c.Tenant)
        .Where(c => c.Tenant!.DomainSlug == tenantSlug && c.Tenant.IsActive)
        .Where(c => c.Email == normalizedEmail)
        .FirstOrDefaultAsync(cancellationToken);

    if (customer is null || customer.Tenant is null) {
      return null;
    }

    var verificationResult = passwordHasher.VerifyHashedPassword(customer, customer.PasswordHash, password);
    if (verificationResult == PasswordVerificationResult.Failed) {
      return null;
    }

    return new AuthenticatedUser(
        UserId: customer.Id,
        TenantId: customer.TenantId,
        TenantDomainSlug: customer.Tenant.DomainSlug,
        Email: customer.Email,
        FullName: customer.FullName,
        Roles: ["Customer"],
        PlatformScopes: [],
        PermissionKeys: [],
        ModuleAccess: []);
  }

  public async Task<AuthenticatedUser> RegisterAsync(CustomerRegisterRequest request, CancellationToken cancellationToken = default) {
    var tenantSlug = request.TenantDomainSlug.Trim().ToLowerInvariant();
    var normalizedEmail = request.Email.Trim().ToLowerInvariant();
    var address = request.Address.Trim();
    var addressDetails = NormalizeOptionalText(request.AddressDetails);
    if (normalizedEmail.Length > EmailMaxLength) {
      throw new InvalidOperationException($"Email must be {EmailMaxLength} characters or fewer.");
    }
    if (address.Length > AddressMaxLength) {
      throw new InvalidOperationException($"Address must be {AddressMaxLength} characters or fewer.");
    }
    if ((addressDetails?.Length ?? 0) > AddressDetailsMaxLength) {
      throw new InvalidOperationException($"Address details must be {AddressDetailsMaxLength} characters or fewer.");
    }

    var passwordPolicy = passwordPolicyService.Validate(
        request.Password,
        new PasswordPolicyContext(
            normalizedEmail,
            request.FullName,
            tenantSlug));
    if (!passwordPolicy.IsValid) {
      throw new InvalidOperationException(string.Join(" ", passwordPolicy.Errors));
    }

    var tenant = await dbContext.Tenants
        .AsNoTracking()
        .Where(t => t.DomainSlug == tenantSlug && t.IsActive)
        .FirstOrDefaultAsync(cancellationToken);

    if (tenant is null) {
      throw new InvalidOperationException("Tenant domain not found or inactive.");
    }

    var existingCustomer = await dbContext.Customers
        .AsNoTracking()
        .Where(c => c.TenantId == tenant.Id && c.Email == normalizedEmail)
        .FirstOrDefaultAsync(cancellationToken);

    if (existingCustomer is not null) {
      throw new InvalidOperationException("A customer account with this email already exists for this tenant domain.");
    }

    var customer = new Customer {
        Id = Guid.NewGuid(),
        TenantId = tenant.Id,
        CustomerCode = "CUS-" + Guid.NewGuid().ToString()[..6].ToUpper(),
        FullName = request.FullName.Trim(),
        Email = normalizedEmail,
        MobileNumber = request.MobileNumber.Trim(),
        Address = address,
        AddressDetails = addressDetails,
        CreatedAtUtc = DateTime.UtcNow
    };

    customer.PasswordHash = passwordHasher.HashPassword(customer, request.Password);

    dbContext.Customers.Add(customer);
    await dbContext.SaveChangesAsync(cancellationToken);

    return new AuthenticatedUser(
        UserId: customer.Id,
        TenantId: customer.TenantId,
        TenantDomainSlug: tenant.DomainSlug,
        Email: customer.Email,
        FullName: customer.FullName,
        Roles: ["Customer"],
        PlatformScopes: [],
        PermissionKeys: [],
        ModuleAccess: []);
  }

  private static string? NormalizeOptionalText(string? value) {
    var normalized = value?.Trim();
    return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
  }
}
