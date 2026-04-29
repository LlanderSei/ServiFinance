namespace ServiFinance.Infrastructure.Auth;

using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ServiFinance.Application.Auth;
using ServiFinance.Domain;
using ServiFinance.Infrastructure.Data;

public sealed class CustomerAuthenticationService(
    ServiFinanceDbContext dbContext,
    IPasswordHasher<Customer> passwordHasher) : ICustomerAuthenticationService {

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
        Roles: ["Customer"]);
  }

  public async Task<AuthenticatedUser> RegisterAsync(CustomerRegisterRequest request, CancellationToken cancellationToken = default) {
    var tenantSlug = request.TenantDomainSlug.Trim().ToLowerInvariant();
    var normalizedEmail = request.Email.Trim().ToLowerInvariant();

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
        Address = request.Address.Trim(),
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
        Roles: ["Customer"]);
  }
}
