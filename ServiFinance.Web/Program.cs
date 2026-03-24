using ServiFinance.Shared.Services;
using ServiFinance.Infrastructure.Extensions;
using ServiFinance.Web.Components;
using ServiFinance.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents()
    .AddInteractiveWebAssemblyComponents();

// Add device-specific services used by the ServiFinance.Shared project
builder.Services.AddSingleton<IFormFactor, FormFactor>();
builder.Services.AddServiFinanceSqlServer(builder.Configuration);

var app = builder.Build();
await app.Services.EnsureServiFinanceDatabaseAsync();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment()) {
  app.UseWebAssemblyDebugging();
}
else {
  app.UseExceptionHandler("/Error", createScopeForErrors: true);
  // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
  app.UseHsts();
}
app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();

app.UseAntiforgery();

app.MapStaticAssets();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(
        typeof(ServiFinance.Shared._Imports).Assembly,
        typeof(ServiFinance.Web.Client._Imports).Assembly);

app.Run();
