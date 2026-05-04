using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerServiceRequestLogistics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "ServiceRequests",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancellationRequestedAtUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAtUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactName",
                table: "ServiceRequests",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "ServiceRequests",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "NeededByUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PreferredScheduleEndUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PreferredScheduleStartUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ServiceAddress",
                table: "ServiceRequests",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ServiceMode",
                table: "ServiceRequests",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CustomerContactOptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    ContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerContactOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CustomerContactOptions_Customers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Customers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_TenantId_NeededByUtc",
                table: "ServiceRequests",
                columns: new[] { "TenantId", "NeededByUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_TenantId_PreferredScheduleStartUtc",
                table: "ServiceRequests",
                columns: new[] { "TenantId", "PreferredScheduleStartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_CustomerContactOptions_CustomerId",
                table: "CustomerContactOptions",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerContactOptions_TenantId",
                table: "CustomerContactOptions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerContactOptions_TenantId_CustomerId_Label",
                table: "CustomerContactOptions",
                columns: new[] { "TenantId", "CustomerId", "Label" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CustomerContactOptions");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_TenantId_NeededByUtc",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_TenantId_PreferredScheduleStartUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CancellationRequestedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CancelledAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ContactName",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ContactPhone",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "NeededByUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "PreferredScheduleEndUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "PreferredScheduleStartUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServiceAddress",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ServiceMode",
                table: "ServiceRequests");
        }
    }
}
