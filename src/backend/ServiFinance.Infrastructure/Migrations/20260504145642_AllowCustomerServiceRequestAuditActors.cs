using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AllowCustomerServiceRequestAuditActors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_Users_CreatedByUserId",
                table: "ServiceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_StatusLogs_Users_ChangedByUserId",
                table: "StatusLogs");

            migrationBuilder.DropIndex(
                name: "IX_StatusLogs_ChangedByUserId",
                table: "StatusLogs");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CreatedByUserId",
                table: "ServiceRequests");

            migrationBuilder.AlterColumn<Guid>(
                name: "ChangedByUserId",
                table: "StatusLogs",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "ChangedByCustomerId",
                table: "StatusLogs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedByUserId",
                table: "ServiceRequests",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByCustomerId",
                table: "ServiceRequests",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE serviceRequest
                SET CreatedByCustomerId = serviceRequest.CreatedByUserId,
                    CreatedByUserId = NULL
                FROM ServiceRequests serviceRequest
                INNER JOIN Customers customer ON customer.Id = serviceRequest.CreatedByUserId
                WHERE serviceRequest.CreatedByCustomerId IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM Users appUser
                      WHERE appUser.Id = serviceRequest.CreatedByUserId
                  );

                UPDATE statusLog
                SET ChangedByCustomerId = statusLog.ChangedByUserId,
                    ChangedByUserId = NULL
                FROM StatusLogs statusLog
                INNER JOIN Customers customer ON customer.Id = statusLog.ChangedByUserId
                WHERE statusLog.ChangedByCustomerId IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM Users appUser
                      WHERE appUser.Id = statusLog.ChangedByUserId
                  );
                """);

            migrationBuilder.CreateIndex(
                name: "IX_StatusLogs_ChangedByCustomerId",
                table: "StatusLogs",
                column: "ChangedByCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_StatusLogs_ChangedByUserId",
                table: "StatusLogs",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CreatedByCustomerId",
                table: "ServiceRequests",
                column: "CreatedByCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CreatedByUserId",
                table: "ServiceRequests",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_Customers_CreatedByCustomerId",
                table: "ServiceRequests",
                column: "CreatedByCustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StatusLogs_Customers_ChangedByCustomerId",
                table: "StatusLogs",
                column: "ChangedByCustomerId",
                principalTable: "Customers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_Users_CreatedByUserId",
                table: "ServiceRequests",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StatusLogs_Users_ChangedByUserId",
                table: "StatusLogs",
                column: "ChangedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_Customers_CreatedByCustomerId",
                table: "ServiceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_StatusLogs_Customers_ChangedByCustomerId",
                table: "StatusLogs");

            migrationBuilder.DropForeignKey(
                name: "FK_ServiceRequests_Users_CreatedByUserId",
                table: "ServiceRequests");

            migrationBuilder.DropForeignKey(
                name: "FK_StatusLogs_Users_ChangedByUserId",
                table: "StatusLogs");

            migrationBuilder.DropIndex(
                name: "IX_StatusLogs_ChangedByCustomerId",
                table: "StatusLogs");

            migrationBuilder.DropIndex(
                name: "IX_StatusLogs_ChangedByUserId",
                table: "StatusLogs");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CreatedByCustomerId",
                table: "ServiceRequests");

            migrationBuilder.DropIndex(
                name: "IX_ServiceRequests_CreatedByUserId",
                table: "ServiceRequests");

            migrationBuilder.DropColumn(
                name: "ChangedByCustomerId",
                table: "StatusLogs");

            migrationBuilder.DropColumn(
                name: "CreatedByCustomerId",
                table: "ServiceRequests");

            migrationBuilder.AlterColumn<Guid>(
                name: "ChangedByUserId",
                table: "StatusLogs",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedByUserId",
                table: "ServiceRequests",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StatusLogs_ChangedByUserId",
                table: "StatusLogs",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceRequests_CreatedByUserId",
                table: "ServiceRequests",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ServiceRequests_Users_CreatedByUserId",
                table: "ServiceRequests",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StatusLogs_Users_ChangedByUserId",
                table: "StatusLogs",
                column: "ChangedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
