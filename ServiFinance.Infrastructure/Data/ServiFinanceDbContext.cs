using Microsoft.EntityFrameworkCore;

namespace ServiFinance.Infrastructure.Data;

public sealed class ServiFinanceDbContext(DbContextOptions<ServiFinanceDbContext> options) : DbContext(options) {
}
