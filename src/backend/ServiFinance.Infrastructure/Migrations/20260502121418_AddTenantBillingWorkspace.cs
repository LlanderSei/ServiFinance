using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantBillingWorkspace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TenantBillingRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubmittedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    BillingPeriodLabel = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CoverageStartUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CoverageEndUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DueDateUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AmountDue = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    AmountSubmitted = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ReferenceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ReviewRemarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ProofOriginalFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    ProofStoredFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    ProofContentType = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    ProofRelativeUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SubmittedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReviewedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantBillingRecords", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantBillingRecords_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantBillingRecords_Users_SubmittedByUserId",
                        column: x => x.SubmittedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TenantBillingRecords_SubmittedByUserId",
                table: "TenantBillingRecords",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantBillingRecords_TenantId",
                table: "TenantBillingRecords",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantBillingRecords_TenantId_DueDateUtc",
                table: "TenantBillingRecords",
                columns: new[] { "TenantId", "DueDateUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TenantBillingRecords");
        }
    }
}
