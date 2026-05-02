using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanPaymentReversalLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReversalOfTransactionId",
                table: "Transactions",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_ReversalOfTransactionId",
                table: "Transactions",
                column: "ReversalOfTransactionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_ReversalOfTransactionId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ReversalOfTransactionId",
                table: "Transactions");
        }
    }
}
