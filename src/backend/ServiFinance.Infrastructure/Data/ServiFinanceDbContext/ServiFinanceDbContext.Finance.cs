using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureInvoices(ModelBuilder modelBuilder) {
    var invoice = modelBuilder.Entity<Invoice>();
    invoice.ToTable("Invoices");
    ConfigureTenantOwned(invoice);
    invoice.Property(entity => entity.InvoiceNumber).HasMaxLength(50);
    invoice.Property(entity => entity.InvoiceStatus).HasMaxLength(50);
    ConfigureMoney(invoice.Property(entity => entity.SubtotalAmount));
    ConfigureMoney(invoice.Property(entity => entity.InterestableAmount));
    ConfigureMoney(invoice.Property(entity => entity.DiscountAmount));
    ConfigureMoney(invoice.Property(entity => entity.TotalAmount));
    ConfigureMoney(invoice.Property(entity => entity.OutstandingAmount));
    invoice.HasIndex(entity => new { entity.TenantId, entity.InvoiceNumber }).IsUnique();
    invoice.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.Invoices)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    invoice.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.Invoices)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureInvoiceLines(ModelBuilder modelBuilder) {
    var invoiceLine = modelBuilder.Entity<InvoiceLine>();
    invoiceLine.ToTable("InvoiceLines");
    ConfigureTenantOwned(invoiceLine);
    invoiceLine.Property(entity => entity.Description).HasMaxLength(500);
    ConfigureMoney(invoiceLine.Property(entity => entity.Quantity), 10, 2);
    ConfigureMoney(invoiceLine.Property(entity => entity.UnitPrice));
    ConfigureMoney(invoiceLine.Property(entity => entity.LineTotal));
    invoiceLine.HasOne(entity => entity.Invoice)
        .WithMany(entity => entity.InvoiceLines)
        .HasForeignKey(entity => entity.InvoiceId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureMicroLoans(ModelBuilder modelBuilder) {
    var microLoan = modelBuilder.Entity<MicroLoan>();
    microLoan.ToTable("MicroLoans");
    ConfigureTenantOwned(microLoan);
    microLoan.Property(entity => entity.LoanStatus).HasMaxLength(50);
    ConfigureMoney(microLoan.Property(entity => entity.PrincipalAmount));
    ConfigureMoney(microLoan.Property(entity => entity.AnnualInterestRate), 6, 2);
    ConfigureMoney(microLoan.Property(entity => entity.MonthlyInstallment));
    ConfigureMoney(microLoan.Property(entity => entity.TotalInterestAmount));
    ConfigureMoney(microLoan.Property(entity => entity.TotalRepayableAmount));
    microLoan.HasIndex(entity => entity.InvoiceId)
        .IsUnique()
        .HasFilter("[InvoiceId] IS NOT NULL");
    microLoan.HasOne(entity => entity.Invoice)
        .WithOne(entity => entity.MicroLoan)
        .HasForeignKey<MicroLoan>(entity => entity.InvoiceId)
        .IsRequired(false)
        .OnDelete(DeleteBehavior.Restrict);
    microLoan.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.MicroLoans)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    microLoan.HasOne(entity => entity.CreatedByUser)
        .WithMany(entity => entity.CreatedMicroLoans)
        .HasForeignKey(entity => entity.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureAmortizationSchedules(ModelBuilder modelBuilder) {
    var schedule = modelBuilder.Entity<AmortizationSchedule>();
    schedule.ToTable("AmortizationSchedules");
    ConfigureTenantOwned(schedule);
    schedule.Property(entity => entity.InstallmentStatus).HasMaxLength(50);
    ConfigureMoney(schedule.Property(entity => entity.BeginningBalance));
    ConfigureMoney(schedule.Property(entity => entity.PrincipalPortion));
    ConfigureMoney(schedule.Property(entity => entity.InterestPortion));
    ConfigureMoney(schedule.Property(entity => entity.InstallmentAmount));
    ConfigureMoney(schedule.Property(entity => entity.EndingBalance));
    ConfigureMoney(schedule.Property(entity => entity.PaidAmount));
    schedule.HasIndex(entity => new { entity.MicroLoanId, entity.InstallmentNumber }).IsUnique();
    schedule.HasOne(entity => entity.MicroLoan)
        .WithMany(entity => entity.AmortizationSchedules)
        .HasForeignKey(entity => entity.MicroLoanId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureTransactions(ModelBuilder modelBuilder) {
    var transaction = modelBuilder.Entity<LedgerTransaction>();
    transaction.ToTable("Transactions");
    ConfigureTenantOwned(transaction);
    transaction.Property(entity => entity.TransactionType).HasMaxLength(50);
    transaction.Property(entity => entity.ReferenceNumber).HasMaxLength(100);
    transaction.Property(entity => entity.Remarks).HasMaxLength(1000);
    ConfigureMoney(transaction.Property(entity => entity.DebitAmount));
    ConfigureMoney(transaction.Property(entity => entity.CreditAmount));
    ConfigureMoney(transaction.Property(entity => entity.RunningBalance));
    transaction.HasIndex(entity => entity.ReversalOfTransactionId);
    transaction.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.Invoice)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.InvoiceId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.MicroLoan)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.MicroLoanId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.AmortizationSchedule)
        .WithMany(entity => entity.Transactions)
        .HasForeignKey(entity => entity.AmortizationScheduleId)
        .OnDelete(DeleteBehavior.Restrict);
    transaction.HasOne(entity => entity.CreatedByUser)
        .WithMany(entity => entity.CreatedTransactions)
        .HasForeignKey(entity => entity.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }
}
