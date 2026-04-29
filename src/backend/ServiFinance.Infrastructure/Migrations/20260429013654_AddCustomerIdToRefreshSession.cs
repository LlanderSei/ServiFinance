using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerIdToRefreshSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CustomerId",
                table: "RefreshSessions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshSessions_CustomerId",
                table: "RefreshSessions",
                column: "CustomerId");

            migrationBuilder.AddForeignKey(
                name: "FK_RefreshSessions_Customers_CustomerId",
                table: "RefreshSessions",
                column: "CustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RefreshSessions_Customers_CustomerId",
                table: "RefreshSessions");

            migrationBuilder.DropIndex(
                name: "IX_RefreshSessions_CustomerId",
                table: "RefreshSessions");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "RefreshSessions");
        }
    }
}
