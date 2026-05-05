using Microsoft.EntityFrameworkCore;
using ServiFinance.Domain;

namespace ServiFinance.Infrastructure.Data;

public sealed partial class ServiFinanceDbContext {
  private void ConfigureCustomers(ModelBuilder modelBuilder) {
    var customer = modelBuilder.Entity<Customer>();
    customer.ToTable("Customers");
    ConfigureTenantOwned(customer);
    customer.Property(entity => entity.CustomerCode).HasMaxLength(50);
    customer.Property(entity => entity.FullName).HasMaxLength(200);
    customer.Property(entity => entity.MobileNumber).HasMaxLength(50);
    customer.Property(entity => entity.Email).HasMaxLength(EmailMaxLength);
    customer.Property(entity => entity.PasswordHash).HasMaxLength(PasswordHashMaxLength);
    customer.Property(entity => entity.Address).HasMaxLength(500);
    customer.Property(entity => entity.AddressDetails).HasMaxLength(500);
    customer.HasIndex(entity => new { entity.TenantId, entity.CustomerCode }).IsUnique();
    customer.HasOne(entity => entity.Tenant)
        .WithMany(entity => entity.Customers)
        .HasForeignKey(entity => entity.TenantId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureCustomerContactOptions(ModelBuilder modelBuilder) {
    var customerContactOption = modelBuilder.Entity<CustomerContactOption>();
    customerContactOption.ToTable("CustomerContactOptions");
    ConfigureTenantOwned(customerContactOption);
    customerContactOption.Property(entity => entity.Label).HasMaxLength(120);
    customerContactOption.Property(entity => entity.ContactName).HasMaxLength(200);
    customerContactOption.Property(entity => entity.PhoneNumber).HasMaxLength(50);
    customerContactOption.Property(entity => entity.Address).HasMaxLength(500);
    customerContactOption.Property(entity => entity.AddressDetails).HasMaxLength(500);
    customerContactOption.HasIndex(entity => new { entity.TenantId, entity.CustomerId, entity.Label });
    customerContactOption.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.ContactOptions)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Cascade);
  }

  private void ConfigureServiceRequests(ModelBuilder modelBuilder) {
    var serviceRequest = modelBuilder.Entity<ServiceRequest>();
    serviceRequest.ToTable("ServiceRequests");
    ConfigureTenantOwned(serviceRequest);
    serviceRequest.Property(entity => entity.RequestNumber).HasMaxLength(50);
    serviceRequest.Property(entity => entity.ItemType).HasMaxLength(100);
    serviceRequest.Property(entity => entity.ItemDescription).HasMaxLength(500);
    serviceRequest.Property(entity => entity.IssueDescription).HasMaxLength(1000);
    serviceRequest.Property(entity => entity.ServiceMode).HasMaxLength(50);
    serviceRequest.Property(entity => entity.ServiceAddress).HasMaxLength(500);
    serviceRequest.Property(entity => entity.ServiceAddressDetails).HasMaxLength(500);
    serviceRequest.Property(entity => entity.ContactName).HasMaxLength(200);
    serviceRequest.Property(entity => entity.ContactPhone).HasMaxLength(50);
    serviceRequest.Property(entity => entity.Priority).HasMaxLength(50);
    serviceRequest.Property(entity => entity.CurrentStatus).HasMaxLength(50);
    serviceRequest.Property(entity => entity.FeedbackComments).HasMaxLength(FeedbackCommentsMaxLength);
    serviceRequest.Property(entity => entity.FeedbackSuggestionCategory).HasMaxLength(80);
    serviceRequest.Property(entity => entity.CancellationReason).HasMaxLength(500);
    serviceRequest.HasIndex(entity => new { entity.TenantId, entity.RequestNumber }).IsUnique();
    serviceRequest.HasIndex(entity => new { entity.TenantId, entity.CompletedAtUtc });
    serviceRequest.HasIndex(entity => new { entity.TenantId, entity.FeedbackSubmittedAtUtc });
    serviceRequest.HasIndex(entity => new { entity.TenantId, entity.PreferredScheduleStartUtc });
    serviceRequest.HasIndex(entity => new { entity.TenantId, entity.NeededByUtc });
    serviceRequest.HasOne(entity => entity.Customer)
        .WithMany(entity => entity.ServiceRequests)
        .HasForeignKey(entity => entity.CustomerId)
        .OnDelete(DeleteBehavior.Restrict);
    serviceRequest.HasOne(entity => entity.CreatedByUser)
        .WithMany(entity => entity.CreatedServiceRequests)
        .HasForeignKey(entity => entity.CreatedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
    serviceRequest.HasOne(entity => entity.CreatedByCustomer)
        .WithMany(entity => entity.CreatedServiceRequests)
        .HasForeignKey(entity => entity.CreatedByCustomerId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureServiceRequestAttachments(ModelBuilder modelBuilder) {
    var serviceRequestAttachment = modelBuilder.Entity<ServiceRequestAttachment>();
    serviceRequestAttachment.ToTable("ServiceRequestAttachments");
    ConfigureTenantOwned(serviceRequestAttachment);
    serviceRequestAttachment.Property(entity => entity.OriginalFileName).HasMaxLength(260);
    serviceRequestAttachment.Property(entity => entity.StoredFileName).HasMaxLength(260);
    serviceRequestAttachment.Property(entity => entity.ContentType).HasMaxLength(120);
    serviceRequestAttachment.Property(entity => entity.RelativeUrl).HasMaxLength(500);
    serviceRequestAttachment.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.Attachments)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Cascade);
    serviceRequestAttachment.HasOne(entity => entity.SubmittedByCustomer)
        .WithMany()
        .HasForeignKey(entity => entity.SubmittedByCustomerId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureStatusLogs(ModelBuilder modelBuilder) {
    var statusLog = modelBuilder.Entity<StatusLog>();
    statusLog.ToTable("StatusLogs");
    ConfigureTenantOwned(statusLog);
    statusLog.Property(entity => entity.Status).HasMaxLength(50);
    statusLog.Property(entity => entity.Remarks).HasMaxLength(1000);
    statusLog.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.StatusLogs)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Cascade);
    statusLog.HasOne(entity => entity.ChangedByUser)
        .WithMany(entity => entity.StatusLogs)
        .HasForeignKey(entity => entity.ChangedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
    statusLog.HasOne(entity => entity.ChangedByCustomer)
        .WithMany(entity => entity.StatusLogs)
        .HasForeignKey(entity => entity.ChangedByCustomerId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureAssignments(ModelBuilder modelBuilder) {
    var assignment = modelBuilder.Entity<Assignment>();
    assignment.ToTable("Assignments");
    ConfigureTenantOwned(assignment);
    assignment.Property(entity => entity.AssignmentStatus).HasMaxLength(50);
    assignment.HasOne(entity => entity.ServiceRequest)
        .WithMany(entity => entity.Assignments)
        .HasForeignKey(entity => entity.ServiceRequestId)
        .OnDelete(DeleteBehavior.Cascade);
    assignment.HasOne(entity => entity.AssignedUser)
        .WithMany(entity => entity.AssignedAssignments)
        .HasForeignKey(entity => entity.AssignedUserId)
        .OnDelete(DeleteBehavior.Restrict);
    assignment.HasOne(entity => entity.AssignedByUser)
        .WithMany(entity => entity.CreatedAssignments)
        .HasForeignKey(entity => entity.AssignedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureAssignmentEvents(ModelBuilder modelBuilder) {
    var assignmentEvent = modelBuilder.Entity<AssignmentEvent>();
    assignmentEvent.ToTable("AssignmentEvents");
    ConfigureTenantOwned(assignmentEvent);
    assignmentEvent.Property(entity => entity.EventType).HasMaxLength(50);
    assignmentEvent.Property(entity => entity.AssignmentStatus).HasMaxLength(50);
    assignmentEvent.Property(entity => entity.Remarks).HasMaxLength(1000);
    assignmentEvent.HasOne(entity => entity.Assignment)
        .WithMany(entity => entity.Events)
        .HasForeignKey(entity => entity.AssignmentId)
        .OnDelete(DeleteBehavior.Cascade);
    assignmentEvent.HasOne(entity => entity.PreviousAssignedUser)
        .WithMany()
        .HasForeignKey(entity => entity.PreviousAssignedUserId)
        .OnDelete(DeleteBehavior.Restrict);
    assignmentEvent.HasOne(entity => entity.AssignedUser)
        .WithMany()
        .HasForeignKey(entity => entity.AssignedUserId)
        .OnDelete(DeleteBehavior.Restrict);
    assignmentEvent.HasOne(entity => entity.ChangedByUser)
        .WithMany(entity => entity.AssignmentEvents)
        .HasForeignKey(entity => entity.ChangedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }

  private void ConfigureAssignmentEvidence(ModelBuilder modelBuilder) {
    var assignmentEvidence = modelBuilder.Entity<AssignmentEvidence>();
    assignmentEvidence.ToTable("AssignmentEvidence");
    ConfigureTenantOwned(assignmentEvidence);
    assignmentEvidence.Property(entity => entity.Note).HasMaxLength(2000);
    assignmentEvidence.Property(entity => entity.OriginalFileName).HasMaxLength(260);
    assignmentEvidence.Property(entity => entity.StoredFileName).HasMaxLength(260);
    assignmentEvidence.Property(entity => entity.ContentType).HasMaxLength(120);
    assignmentEvidence.Property(entity => entity.RelativeUrl).HasMaxLength(500);
    assignmentEvidence.HasOne(entity => entity.Assignment)
        .WithMany(entity => entity.EvidenceItems)
        .HasForeignKey(entity => entity.AssignmentId)
        .OnDelete(DeleteBehavior.Cascade);
    assignmentEvidence.HasOne(entity => entity.SubmittedByUser)
        .WithMany(entity => entity.AssignmentEvidenceItems)
        .HasForeignKey(entity => entity.SubmittedByUserId)
        .OnDelete(DeleteBehavior.Restrict);
  }
}
