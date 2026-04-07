using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMsmeTierModuleEntitlements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BusinessSizeSegment",
                table: "Tenants",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SubscriptionEdition",
                table: "Tenants",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BusinessSizeSegment",
                table: "SubscriptionTiers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SubscriptionEdition",
                table: "SubscriptionTiers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ModuleCatalog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModuleCatalog", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionTierModules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubscriptionTierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PlatformModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccessLevel = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionTierModules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SubscriptionTierModules_ModuleCatalog_PlatformModuleId",
                        column: x => x.PlatformModuleId,
                        principalTable: "ModuleCatalog",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SubscriptionTierModules_SubscriptionTiers_SubscriptionTierId",
                        column: x => x.SubscriptionTierId,
                        principalTable: "SubscriptionTiers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ModuleCatalog_Code",
                table: "ModuleCatalog",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionTierModules_PlatformModuleId",
                table: "SubscriptionTierModules",
                column: "PlatformModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionTierModules_SubscriptionTierId_PlatformModuleId",
                table: "SubscriptionTierModules",
                columns: new[] { "SubscriptionTierId", "PlatformModuleId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SubscriptionTierModules");

            migrationBuilder.DropTable(
                name: "ModuleCatalog");

            migrationBuilder.DropColumn(
                name: "BusinessSizeSegment",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SubscriptionEdition",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BusinessSizeSegment",
                table: "SubscriptionTiers");

            migrationBuilder.DropColumn(
                name: "SubscriptionEdition",
                table: "SubscriptionTiers");
        }
    }
}
