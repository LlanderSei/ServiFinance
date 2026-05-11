using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMlsLoanApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovalRemarks",
                table: "MicroLoans",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovalRequestedAtUtc",
                table: "MicroLoans",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovalRequestedByUserId",
                table: "MicroLoans",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovalReviewedAtUtc",
                table: "MicroLoans",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovalReviewedByUserId",
                table: "MicroLoans",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovalStatus",
                table: "MicroLoans",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.AddColumn<string>(
                name: "ReferenceNumber",
                table: "MicroLoans",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remarks",
                table: "MicroLoans",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoanApprovalRemarks",
                table: "Invoices",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LoanApprovalRequestedAtUtc",
                table: "Invoices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LoanApprovalRequestedByUserId",
                table: "Invoices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LoanApprovalReviewedAtUtc",
                table: "Invoices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "LoanApprovalReviewedByUserId",
                table: "Invoices",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LoanApprovalStatus",
                table: "Invoices",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Not Requested");

            migrationBuilder.CreateIndex(
                name: "IX_MicroLoans_ApprovalRequestedByUserId",
                table: "MicroLoans",
                column: "ApprovalRequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MicroLoans_ApprovalReviewedByUserId",
                table: "MicroLoans",
                column: "ApprovalReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_LoanApprovalRequestedByUserId",
                table: "Invoices",
                column: "LoanApprovalRequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_LoanApprovalReviewedByUserId",
                table: "Invoices",
                column: "LoanApprovalReviewedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Users_LoanApprovalRequestedByUserId",
                table: "Invoices",
                column: "LoanApprovalRequestedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Invoices_Users_LoanApprovalReviewedByUserId",
                table: "Invoices",
                column: "LoanApprovalReviewedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MicroLoans_Users_ApprovalRequestedByUserId",
                table: "MicroLoans",
                column: "ApprovalRequestedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MicroLoans_Users_ApprovalReviewedByUserId",
                table: "MicroLoans",
                column: "ApprovalReviewedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Users_LoanApprovalRequestedByUserId",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_Invoices_Users_LoanApprovalReviewedByUserId",
                table: "Invoices");

            migrationBuilder.DropForeignKey(
                name: "FK_MicroLoans_Users_ApprovalRequestedByUserId",
                table: "MicroLoans");

            migrationBuilder.DropForeignKey(
                name: "FK_MicroLoans_Users_ApprovalReviewedByUserId",
                table: "MicroLoans");

            migrationBuilder.DropIndex(
                name: "IX_MicroLoans_ApprovalRequestedByUserId",
                table: "MicroLoans");

            migrationBuilder.DropIndex(
                name: "IX_MicroLoans_ApprovalReviewedByUserId",
                table: "MicroLoans");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_LoanApprovalRequestedByUserId",
                table: "Invoices");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_LoanApprovalReviewedByUserId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "ApprovalRemarks",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "ApprovalRequestedAtUtc",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "ApprovalRequestedByUserId",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "ApprovalReviewedAtUtc",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "ApprovalReviewedByUserId",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "ApprovalStatus",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "ReferenceNumber",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "Remarks",
                table: "MicroLoans");

            migrationBuilder.DropColumn(
                name: "LoanApprovalRemarks",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "LoanApprovalRequestedAtUtc",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "LoanApprovalRequestedByUserId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "LoanApprovalReviewedAtUtc",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "LoanApprovalReviewedByUserId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "LoanApprovalStatus",
                table: "Invoices");
        }
    }
}
