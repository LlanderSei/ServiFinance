using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStripeTenantOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BillingProvider",
                table: "Tenants",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StripeCustomerId",
                table: "Tenants",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripeSubscriptionId",
                table: "Tenants",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlatformTenantRegistrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionTierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    BusinessName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TenantCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DomainSlug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    OwnerFullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    OwnerEmail = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OwnerPasswordHash = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StripeCheckoutSessionId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StripeCustomerId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    StripeSubscriptionId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CheckoutExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProvisionedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FailureReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformTenantRegistrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlatformTenantRegistrations_SubscriptionTiers_SubscriptionTierId",
                        column: x => x.SubscriptionTierId,
                        principalTable: "SubscriptionTiers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PlatformTenantRegistrations_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_DomainSlug",
                table: "PlatformTenantRegistrations",
                column: "DomainSlug");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_OwnerEmail",
                table: "PlatformTenantRegistrations",
                column: "OwnerEmail");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_Status",
                table: "PlatformTenantRegistrations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_StripeCheckoutSessionId",
                table: "PlatformTenantRegistrations",
                column: "StripeCheckoutSessionId",
                unique: true,
                filter: "[StripeCheckoutSessionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_StripeSubscriptionId",
                table: "PlatformTenantRegistrations",
                column: "StripeSubscriptionId",
                unique: true,
                filter: "[StripeSubscriptionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_SubscriptionTierId",
                table: "PlatformTenantRegistrations",
                column: "SubscriptionTierId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformTenantRegistrations_TenantId",
                table: "PlatformTenantRegistrations",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformTenantRegistrations");

            migrationBuilder.DropColumn(
                name: "BillingProvider",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "StripeCustomerId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "StripeSubscriptionId",
                table: "Tenants");
        }
    }
}
