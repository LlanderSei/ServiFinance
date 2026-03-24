using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using ServiFinance.Shared.Services;
using ServiFinance.Web.Client.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

// Add device-specific services used by the ServiFinance.Shared project
builder.Services.AddSingleton<IFormFactor, FormFactor>();

await builder.Build().RunAsync();
