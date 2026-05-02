using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations;

/// <inheritdoc />
public partial class MoveTenantThemeToSeparateTable : Migration {
  /// <inheritdoc />
  protected override void Up(MigrationBuilder migrationBuilder) {
    migrationBuilder.CreateTable(
        name: "TenantThemes",
        columns: table => new {
          Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
          TenantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
          DisplayName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
          LogoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
          PrimaryColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
          SecondaryColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
          HeaderBackgroundColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
          PageBackgroundColor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
        },
        constraints: table => {
          table.PrimaryKey("PK_TenantThemes", x => x.Id);
          table.ForeignKey(
              name: "FK_TenantThemes_Tenants_TenantId",
              column: x => x.TenantId,
              principalTable: "Tenants",
              principalColumn: "Id",
              onDelete: ReferentialAction.Cascade);
        });

    migrationBuilder.Sql(
        """
        INSERT INTO [TenantThemes] (
          [Id],
          [TenantId],
          [DisplayName],
          [LogoUrl],
          [PrimaryColor],
          [SecondaryColor],
          [HeaderBackgroundColor],
          [PageBackgroundColor]
        )
        SELECT
          NEWID(),
          [Id],
          [DisplayName],
          [LogoUrl],
          [PrimaryColor],
          [SecondaryColor],
          [HeaderBackgroundColor],
          [PageBackgroundColor]
        FROM [Tenants];
        """);

    migrationBuilder.DropColumn(
        name: "DisplayName",
        table: "Tenants");

    migrationBuilder.DropColumn(
        name: "HeaderBackgroundColor",
        table: "Tenants");

    migrationBuilder.DropColumn(
        name: "LogoUrl",
        table: "Tenants");

    migrationBuilder.DropColumn(
        name: "PageBackgroundColor",
        table: "Tenants");

    migrationBuilder.DropColumn(
        name: "PrimaryColor",
        table: "Tenants");

    migrationBuilder.DropColumn(
        name: "SecondaryColor",
        table: "Tenants");

    migrationBuilder.CreateIndex(
        name: "IX_TenantThemes_TenantId",
        table: "TenantThemes",
        column: "TenantId",
        unique: true);
  }

  /// <inheritdoc />
  protected override void Down(MigrationBuilder migrationBuilder) {
    migrationBuilder.AddColumn<string>(
        name: "DisplayName",
        table: "Tenants",
        type: "nvarchar(200)",
        maxLength: 200,
        nullable: true);

    migrationBuilder.AddColumn<string>(
        name: "HeaderBackgroundColor",
        table: "Tenants",
        type: "nvarchar(20)",
        maxLength: 20,
        nullable: true);

    migrationBuilder.AddColumn<string>(
        name: "LogoUrl",
        table: "Tenants",
        type: "nvarchar(500)",
        maxLength: 500,
        nullable: true);

    migrationBuilder.AddColumn<string>(
        name: "PageBackgroundColor",
        table: "Tenants",
        type: "nvarchar(20)",
        maxLength: 20,
        nullable: true);

    migrationBuilder.AddColumn<string>(
        name: "PrimaryColor",
        table: "Tenants",
        type: "nvarchar(20)",
        maxLength: 20,
        nullable: true);

    migrationBuilder.AddColumn<string>(
        name: "SecondaryColor",
        table: "Tenants",
        type: "nvarchar(20)",
        maxLength: 20,
        nullable: true);

    migrationBuilder.Sql(
        """
        UPDATE tenant
        SET
          tenant.[DisplayName] = theme.[DisplayName],
          tenant.[LogoUrl] = theme.[LogoUrl],
          tenant.[PrimaryColor] = theme.[PrimaryColor],
          tenant.[SecondaryColor] = theme.[SecondaryColor],
          tenant.[HeaderBackgroundColor] = theme.[HeaderBackgroundColor],
          tenant.[PageBackgroundColor] = theme.[PageBackgroundColor]
        FROM [Tenants] AS tenant
        INNER JOIN [TenantThemes] AS theme ON theme.[TenantId] = tenant.[Id];
        """);

    migrationBuilder.DropTable(
        name: "TenantThemes");
  }
}
