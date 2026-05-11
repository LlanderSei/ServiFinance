using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPersistentAuthProtection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuthProtectionRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecordKey = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Scope = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenantDomainSlug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IdentityHash = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    FailureCount = table.Column<int>(type: "int", nullable: false),
                    WindowStartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    WindowExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LockedUntilUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastFailedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuthProtectionRecords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuthProtectionRecords_Kind_Scope_TenantDomainSlug_LockedUntilUtc",
                table: "AuthProtectionRecords",
                columns: new[] { "Kind", "Scope", "TenantDomainSlug", "LockedUntilUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AuthProtectionRecords_RecordKey",
                table: "AuthProtectionRecords",
                column: "RecordKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuthProtectionRecords_WindowExpiresAtUtc",
                table: "AuthProtectionRecords",
                column: "WindowExpiresAtUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuthProtectionRecords");
        }
    }
}
