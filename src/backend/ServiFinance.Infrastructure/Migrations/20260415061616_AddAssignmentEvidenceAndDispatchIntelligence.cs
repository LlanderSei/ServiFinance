using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAssignmentEvidenceAndDispatchIntelligence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AssignmentEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PreviousAssignedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AssignedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreviousScheduledStartUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PreviousScheduledEndUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ScheduledStartUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ScheduledEndUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AssignmentStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssignmentEvents_Assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "Assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssignmentEvents_Users_AssignedUserId",
                        column: x => x.AssignedUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssignmentEvents_Users_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssignmentEvents_Users_PreviousAssignedUserId",
                        column: x => x.PreviousAssignedUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssignmentEvidence",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SubmittedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    StoredFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    RelativeUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentEvidence", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssignmentEvidence_Assignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "Assignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssignmentEvidence_Users_SubmittedByUserId",
                        column: x => x.SubmittedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvents_AssignedUserId",
                table: "AssignmentEvents",
                column: "AssignedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvents_AssignmentId",
                table: "AssignmentEvents",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvents_ChangedByUserId",
                table: "AssignmentEvents",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvents_PreviousAssignedUserId",
                table: "AssignmentEvents",
                column: "PreviousAssignedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvents_TenantId",
                table: "AssignmentEvents",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvidence_AssignmentId",
                table: "AssignmentEvidence",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvidence_SubmittedByUserId",
                table: "AssignmentEvidence",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentEvidence_TenantId",
                table: "AssignmentEvidence",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssignmentEvents");

            migrationBuilder.DropTable(
                name: "AssignmentEvidence");
        }
    }
}
