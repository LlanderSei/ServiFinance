using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ServiFinance.Infrastructure.Migrations;

/// <inheritdoc />
public partial class AddSubscriptionTierNumericPricing : Migration {
  /// <inheritdoc />
  protected override void Up(MigrationBuilder migrationBuilder) {
    migrationBuilder.AddColumn<string>(
        name: "CurrencyCode",
        table: "SubscriptionTiers",
        type: "nvarchar(3)",
        maxLength: 3,
        nullable: false,
        defaultValue: "PHP");

    migrationBuilder.AddColumn<decimal>(
        name: "MonthlyPriceAmount",
        table: "SubscriptionTiers",
        type: "decimal(18,2)",
        precision: 18,
        scale: 2,
        nullable: false,
        defaultValue: 0m);

    migrationBuilder.Sql("""
        WITH ParsedPrice AS (
          SELECT
            Id,
            TRY_CONVERT(
              decimal(18, 2),
              REPLACE(
                SUBSTRING(
                  PriceDisplay,
                  PATINDEX('%[0-9]%', PriceDisplay),
                  PATINDEX('%[^0-9,.]%', SUBSTRING(PriceDisplay, PATINDEX('%[0-9]%', PriceDisplay), 64) + 'X') - 1),
                ',',
                '')) AS ParsedAmount
          FROM SubscriptionTiers
          WHERE PATINDEX('%[0-9]%', PriceDisplay) > 0
        )
        UPDATE tiers
        SET MonthlyPriceAmount = parsed.ParsedAmount,
            CurrencyCode = 'PHP'
        FROM SubscriptionTiers tiers
        INNER JOIN ParsedPrice parsed ON parsed.Id = tiers.Id
        WHERE parsed.ParsedAmount > 0;
        """);
  }

  /// <inheritdoc />
  protected override void Down(MigrationBuilder migrationBuilder) {
    migrationBuilder.DropColumn(
        name: "CurrencyCode",
        table: "SubscriptionTiers");

    migrationBuilder.DropColumn(
        name: "MonthlyPriceAmount",
        table: "SubscriptionTiers");
  }
}
