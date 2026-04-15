using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AllowStandaloneMicroLoans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MicroLoans_InvoiceId",
                table: "MicroLoans");

            migrationBuilder.AlterColumn<Guid>(
                name: "InvoiceId",
                table: "MicroLoans",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.CreateIndex(
                name: "IX_MicroLoans_InvoiceId",
                table: "MicroLoans",
                column: "InvoiceId",
                unique: true,
                filter: "[InvoiceId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MicroLoans_InvoiceId",
                table: "MicroLoans");

            migrationBuilder.AlterColumn<Guid>(
                name: "InvoiceId",
                table: "MicroLoans",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MicroLoans_InvoiceId",
                table: "MicroLoans",
                column: "InvoiceId",
                unique: true);
        }
    }
}
