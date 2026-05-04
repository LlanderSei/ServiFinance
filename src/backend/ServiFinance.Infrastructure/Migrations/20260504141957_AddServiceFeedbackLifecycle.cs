using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceFeedbackLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CompletedAtUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FeedbackExpiresAtUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FeedbackSubmittedAtUtc",
                table: "ServiceRequests",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FeedbackSuggestionCategory",
                table: "ServiceRequests",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE serviceRequests
                SET CompletedAtUtc = completion.CompletedAtUtc
                FROM ServiceRequests serviceRequests
                INNER JOIN (
                    SELECT ServiceRequestId, MIN(ChangedAtUtc) AS CompletedAtUtc
                    FROM StatusLogs
                    WHERE Status IN ('Completed', 'Closed')
                    GROUP BY ServiceRequestId
                ) completion ON completion.ServiceRequestId = serviceRequests.Id
                WHERE serviceRequests.CompletedAtUtc IS NULL;

                UPDATE ServiceRequests
                SET FeedbackExpiresAtUtc = DATEADD(day, 7, CompletedAtUtc)
                WHERE CompletedAtUtc IS NOT NULL
                    AND FeedbackExpiresAtUtc IS NULL;

                UPDATE ServiceRequests
                SET FeedbackSubmittedAtUtc = COALESCE(CompletedAtUtc, CreatedAtUtc)
                WHERE Rating IS NOT NULL
                    AND FeedbackSubmittedAtUtc IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_TenantId_CompletedAtUtc",
                table: "ServiceRequests",
                columns: new[] { "TenantId", "CompletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_TenantId_FeedbackSubmittedAtUtc",
                table: "ServiceRequests",
                columns: new[] { "TenantId", "FeedbackSubmittedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_TenantId_CompletedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_TenantId_FeedbackSubmittedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "CompletedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "FeedbackExpiresAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "FeedbackSubmittedAtUtc",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "FeedbackSuggestionCategory",
                table: "ServiceRequests");
        }
    }
}
