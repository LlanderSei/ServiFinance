using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Tenancy;

namespace ServiFinance.Infrastructure.Data;

public sealed class ServiFinanceDbContextFactory : IDesignTimeDbContextFactory<ServiFinanceDbContext> {
  public ServiFinanceDbContext CreateDbContext(string[] args) {
    var optionsBuilder = new DbContextOptionsBuilder<ServiFinanceDbContext>();
    optionsBuilder.UseSqlServer(ServiFinanceDatabaseDefaults.DefaultConnectionString);

    return new ServiFinanceDbContext(optionsBuilder.Options, new DesignTimeTenantProvider());
  }

  private sealed class DesignTimeTenantProvider : ITenantProvider {
    public Guid CurrentTenantId => ServiFinanceDatabaseDefaults.DefaultDevelopmentTenantId;
    public bool HasRequestContext => false;
  }
}
