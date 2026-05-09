using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantSubscriptionChangeScheduling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PendingSubscriptionChangeCancelledAtUtc",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingSubscriptionChangeEffectiveAtUtc",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingSubscriptionChangeRequestedAtUtc",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PendingSubscriptionTierId",
                table: "Tenants",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubscriptionChangeCooldownUntilUtc",
                table: "Tenants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_PendingSubscriptionTierId",
                table: "Tenants",
                column: "PendingSubscriptionTierId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tenants_SubscriptionTiers_PendingSubscriptionTierId",
                table: "Tenants",
                column: "PendingSubscriptionTierId",
                principalTable: "SubscriptionTiers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tenants_SubscriptionTiers_PendingSubscriptionTierId",
                table: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Tenants_PendingSubscriptionTierId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PendingSubscriptionChangeCancelledAtUtc",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PendingSubscriptionChangeEffectiveAtUtc",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PendingSubscriptionChangeRequestedAtUtc",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "PendingSubscriptionTierId",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "SubscriptionChangeCooldownUntilUtc",
                table: "Tenants");
        }
    }
}
