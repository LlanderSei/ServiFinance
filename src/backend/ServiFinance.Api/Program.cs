using System.Text;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ServiFinance.Api.Endpoints;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Extensions;

DotEnvLoader.LoadFromCurrentDirectory();

var builder = WebApplication.CreateBuilder(args);
var sessionTokenOptions = builder.Configuration.GetSection(SessionTokenOptions.SectionName).Get<SessionTokenOptions>() ?? new SessionTokenOptions();
if (string.IsNullOrWhiteSpace(sessionTokenOptions.SigningKey)) {
  throw new InvalidOperationException(
      "Missing JWT signing key. Set ServiFinance__Auth__SigningKey in .env or host environment variables.");
}

builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddCors(options => {
  options.AddPolicy("ServiFinanceFrontendClients", policy => {
    policy.SetIsOriginAllowed(ProgramEndpointSupport.IsAllowedFrontendOrigin)
        .AllowAnyHeader()
        .AllowAnyMethod();
  });
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options => {
      options.LoginPath = "/";
      options.AccessDeniedPath = "/forbidden";
      options.SlidingExpiration = true;
    })
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options => {
      options.TokenValidationParameters = new TokenValidationParameters {
        ValidateIssuer = true,
        ValidIssuer = sessionTokenOptions.Issuer,
        ValidateAudience = true,
        ValidAudience = sessionTokenOptions.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(sessionTokenOptions.SigningKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1)
      };
    });
builder.Services.AddAuthorization();
builder.Services.AddServiFinanceSqlServer(builder.Configuration);

var app = builder.Build();
await app.Services.EnsureServiFinanceDatabaseAsync();

if (!app.Environment.IsDevelopment()) {
  app.UseExceptionHandler("/error", createScopeForErrors: true);
  app.UseHsts();
  app.UseHttpsRedirection();
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.MapOpenApi();

app.UseCors("ServiFinanceFrontendClients");
app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapFrontendAppEndpoints();
app.MapWebAccountEndpoints();

var api = app.MapGroup("/api");
api.MapPlatformApiEndpoints();
api.MapAuthApiEndpoints(sessionTokenOptions);
api.MapSuperadminApiEndpoints();
api.MapTenantSmsApiEndpoints();
api.MapCustomerPortalApiEndpoints();

app.Run();
