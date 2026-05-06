using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceCosting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "Invoices",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "InvoiceLines",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "InvoiceLines",
                type: "nvarchar(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "InvoiceLines",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Specification",
                table: "InvoiceLines",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ServiceCostPresets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    DefaultSpecification = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    DefaultQuantity = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    DefaultUnitPrice = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceCostPresets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceCostPresets_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ServiceCostSheets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ServiceRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IsTaxEnabled = table.Column<bool>(type: "bit", nullable: false),
                    TaxLabel = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    TaxRate = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinalizedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceCostSheets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceCostSheets_ServiceRequests_ServiceRequestId",
                        column: x => x.ServiceRequestId,
                        principalTable: "ServiceRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantCostingPolicies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TaxLabel = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    DefaultTaxRate = table.Column<decimal>(type: "decimal(6,2)", precision: 6, scale: 2, nullable: false),
                    TaxEnabledByDefault = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantCostingPolicies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantCostingPolicies_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceCostLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ServiceCostSheetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ServiceCostPresetId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Specification = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(12,2)", precision: 12, scale: 2, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceCostLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceCostLines_ServiceCostPresets_ServiceCostPresetId",
                        column: x => x.ServiceCostPresetId,
                        principalTable: "ServiceCostPresets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ServiceCostLines_ServiceCostSheets_ServiceCostSheetId",
                        column: x => x.ServiceCostSheetId,
                        principalTable: "ServiceCostSheets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostLines_ServiceCostPresetId",
                table: "ServiceCostLines",
                column: "ServiceCostPresetId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostLines_ServiceCostSheetId_SortOrder",
                table: "ServiceCostLines",
                columns: new[] { "ServiceCostSheetId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostLines_TenantId",
                table: "ServiceCostLines",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostPresets_TenantId",
                table: "ServiceCostPresets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostPresets_TenantId_Category_SortOrder",
                table: "ServiceCostPresets",
                columns: new[] { "TenantId", "Category", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostSheets_ServiceRequestId",
                table: "ServiceCostSheets",
                column: "ServiceRequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCostSheets_TenantId",
                table: "ServiceCostSheets",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantCostingPolicies_TenantId",
                table: "TenantCostingPolicies",
                column: "TenantId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ServiceCostLines");

            migrationBuilder.DropTable(
                name: "TenantCostingPolicies");

            migrationBuilder.DropTable(
                name: "ServiceCostPresets");

            migrationBuilder.DropTable(
                name: "ServiceCostSheets");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "InvoiceLines");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "InvoiceLines");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "InvoiceLines");

            migrationBuilder.DropColumn(
                name: "Specification",
                table: "InvoiceLines");
        }
    }
}
