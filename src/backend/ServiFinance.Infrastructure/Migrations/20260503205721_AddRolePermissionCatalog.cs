using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRolePermissionCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPermissionSetLocked",
                table: "Roles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsSystemRole",
                table: "Roles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PlatformScope",
                table: "Roles",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Rank",
                table: "Roles",
                type: "int",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PermissionKey = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    GrantedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Roles_TenantId_PlatformScope_Rank",
                table: "Roles",
                columns: new[] { "TenantId", "PlatformScope", "Rank" });

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_RoleId",
                table: "RolePermissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_TenantId",
                table: "RolePermissions",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_TenantId_RoleId_PermissionKey",
                table: "RolePermissions",
                columns: new[] { "TenantId", "RoleId", "PermissionKey" },
                unique: true);

            migrationBuilder.Sql("""
                UPDATE Roles
                SET PlatformScope = 'Root',
                    Rank = 0,
                    IsSystemRole = 1,
                    IsPermissionSetLocked = 1
                WHERE Name = 'SuperAdmin';

                UPDATE Roles
                SET PlatformScope = 'OwnerAdmin',
                    Rank = CASE Name WHEN 'Owner' THEN 5 ELSE 10 END,
                    IsSystemRole = 1,
                    IsPermissionSetLocked = 1
                WHERE Name IN ('Administrator', 'Owner');

                UPDATE Roles
                SET PlatformScope = 'SMS',
                    Rank = CASE Name WHEN 'SMS Dispatcher' THEN 40 WHEN 'SMS Technician' THEN 60 ELSE 50 END,
                    IsSystemRole = 1,
                    IsPermissionSetLocked = 0
                WHERE Name IN ('Staff', 'SMS Staff', 'SMS Dispatcher', 'SMS Technician');

                UPDATE legacy
                SET Name = 'SMS Staff'
                FROM Roles legacy
                WHERE legacy.Name = 'Staff'
                    AND NOT EXISTS (
                        SELECT 1
                        FROM Roles smsStaff
                        WHERE smsStaff.TenantId = legacy.TenantId
                            AND smsStaff.Name = 'SMS Staff'
                    );

                UPDATE Roles
                SET PlatformScope = 'MLS',
                    Rank = CASE Name WHEN 'MLS Cashier' THEN 80 ELSE 70 END,
                    IsSystemRole = 1,
                    IsPermissionSetLocked = 0
                WHERE Name IN ('MLS Staff', 'MLS Cashier');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropIndex(
                name: "IX_Roles_TenantId_PlatformScope_Rank",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "IsPermissionSetLocked",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "IsSystemRole",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "PlatformScope",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "Rank",
                table: "Roles");
        }
    }
}
