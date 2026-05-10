using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMlsLoanLateFeePolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LoanLateFeeEnabled",
                table: "TenantCostingPolicies",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LoanLateFeeFlatAmount",
                table: "TenantCostingPolicies",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 100m);

            migrationBuilder.AddColumn<int>(
                name: "LoanLateFeeGracePeriodDays",
                table: "TenantCostingPolicies",
                type: "int",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<decimal>(
                name: "LoanLateFeeRatePercent",
                table: "TenantCostingPolicies",
                type: "decimal(6,2)",
                precision: 6,
                scale: 2,
                nullable: false,
                defaultValue: 2m);

            migrationBuilder.AddColumn<decimal>(
                name: "LateFeeAmount",
                table: "AmortizationSchedules",
                type: "decimal(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "LateFeeAppliedAtUtc",
                table: "AmortizationSchedules",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoanLateFeeEnabled",
                table: "TenantCostingPolicies");

            migrationBuilder.DropColumn(
                name: "LoanLateFeeFlatAmount",
                table: "TenantCostingPolicies");

            migrationBuilder.DropColumn(
                name: "LoanLateFeeGracePeriodDays",
                table: "TenantCostingPolicies");

            migrationBuilder.DropColumn(
                name: "LoanLateFeeRatePercent",
                table: "TenantCostingPolicies");

            migrationBuilder.DropColumn(
                name: "LateFeeAmount",
                table: "AmortizationSchedules");

            migrationBuilder.DropColumn(
                name: "LateFeeAppliedAtUtc",
                table: "AmortizationSchedules");
        }
    }
}
