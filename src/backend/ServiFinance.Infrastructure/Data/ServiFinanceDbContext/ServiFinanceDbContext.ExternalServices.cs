using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureExternalServiceStates(ModelBuilder modelBuilder) {
    var externalServiceState = modelBuilder.Entity<ExternalServiceState>();
    externalServiceState.ToTable("ExternalServiceStates");
    externalServiceState.Property(entity => entity.Provider).HasMaxLength(ExternalServiceProviderMaxLength);
    externalServiceState.Property(entity => entity.StateKey).HasMaxLength(ExternalServiceStateKeyMaxLength);
    externalServiceState.Property(entity => entity.PayloadJson).HasColumnType("nvarchar(max)");
    externalServiceState.HasIndex(entity => new { entity.Provider, entity.StateKey }).IsUnique();
  }
}
