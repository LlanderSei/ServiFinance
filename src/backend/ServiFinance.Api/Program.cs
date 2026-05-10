using System.Text;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ServiFinance.Api.Endpoints;
using ServiFinance.Api.Infrastructure;
using ServiFinance.Api.Services;
using ServiFinance.Infrastructure.Configuration;
using ServiFinance.Infrastructure.Extensions;

DotEnvLoader.LoadFromCurrentDirectory();

var builder = WebApplication.CreateBuilder(args);
var imgBbApiKey = builder.Configuration["ServiFinance:ExternalServices:ImgBB:ApiKey"]?.Trim()
    ?? builder.Configuration["ExternalServices:ImgBB:ApiKey"]?.Trim()
    ?? builder.Configuration["IMGBB_API_KEY"]?.Trim();
var nominatimUserAgent = builder.Configuration["ServiFinance:ExternalServices:Nominatim:UserAgent"]?.Trim()
    ?? builder.Configuration["ExternalServices:Nominatim:UserAgent"]?.Trim();
var nominatimContactEmail = builder.Configuration["ServiFinance:ExternalServices:Nominatim:ContactEmail"]?.Trim()
    ?? builder.Configuration["ExternalServices:Nominatim:ContactEmail"]?.Trim();
var sessionTokenOptions = builder.Configuration.GetSection(SessionTokenOptions.SectionName).Get<SessionTokenOptions>() ?? new SessionTokenOptions();
if (string.IsNullOrWhiteSpace(sessionTokenOptions.SigningKey)) {
  throw new InvalidOperationException(
      "Missing JWT signing key. Set ServiFinance__Auth__SigningKey in .env or host environment variables.");
}

builder.Services.AddOpenApi();
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.Configure<ImgBbUploadOptions>(options => {
  options.ApiKey = imgBbApiKey ?? string.Empty;
});
builder.Services.AddHttpClient(ImgBbImageUploadService.HttpClientName, client => {
  client.BaseAddress = new Uri("https://api.imgbb.com/");
  client.Timeout = TimeSpan.FromSeconds(20);
  client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
builder.Services.AddSingleton<IImageUploadRateLimiter, MemoryImageUploadRateLimiter>();
builder.Services.AddScoped<IImageUploadService, ImgBbImageUploadService>();
builder.Services.AddHttpClient(NominatimAddressLookupService.HttpClientName, client => {
  client.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");
  client.Timeout = TimeSpan.FromSeconds(10);
  client.DefaultRequestHeaders.UserAgent.ParseAdd(
    !string.IsNullOrWhiteSpace(nominatimUserAgent)
      ? nominatimUserAgent
      : !string.IsNullOrWhiteSpace(nominatimContactEmail)
        ? $"ServiFinance/1.0 ({nominatimContactEmail})"
        : "ServiFinance/1.0"
  );
  client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
  client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en-PH,en;q=0.9");
});
builder.Services.AddScoped<IAddressLookupService, NominatimAddressLookupService>();
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
builder.Services.AddHostedService<SubscriptionRecoveryReconciliationHostedService>();

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

var api = app.MapGroup("/api")
    .AddClientAbortCancellationHandling();
api.MapPlatformApiEndpoints();
api.MapAddressLookupApiEndpoints();
api.MapAuthApiEndpoints(sessionTokenOptions);
api.MapAccountApiEndpoints();
api.MapSuperadminApiEndpoints();
api.MapTenantSmsApiEndpoints();
api.MapAuditApiEndpoints();
api.MapCustomerPortalApiEndpoints();

app.Run();
