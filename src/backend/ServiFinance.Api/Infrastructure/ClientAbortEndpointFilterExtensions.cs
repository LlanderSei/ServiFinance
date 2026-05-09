namespace ServiFinance.Api.Infrastructure;

using Microsoft.Data.SqlClient;

internal static class ClientAbortEndpointFilterExtensions {
  private const int ClientClosedRequestStatusCode = 499;

  public static RouteGroupBuilder AddClientAbortCancellationHandling(this RouteGroupBuilder group) {
    group.AddEndpointFilter(async (context, next) => {
      try {
        return await next(context);
      }
      catch (OperationCanceledException) when (context.HttpContext.RequestAborted.IsCancellationRequested) {
        return CompleteClientClosedRequest(context.HttpContext);
      }
      catch (SqlException ex) when (IsClientAbortSqlCancellation(context.HttpContext, ex)) {
        return CompleteClientClosedRequest(context.HttpContext);
      }
    });

    return group;
  }

  private static IResult CompleteClientClosedRequest(HttpContext httpContext) {
    if (!httpContext.Response.HasStarted) {
      httpContext.Response.StatusCode = ClientClosedRequestStatusCode;
    }

    return Results.Empty;
  }

  private static bool IsClientAbortSqlCancellation(HttpContext httpContext, SqlException exception) {
    if (!httpContext.RequestAborted.IsCancellationRequested) {
      return false;
    }

    if (IsSqlCancellationMessage(exception.Message)) {
      return true;
    }

    foreach (SqlError error in exception.Errors) {
      if (IsSqlCancellationMessage(error.Message)) {
        return true;
      }
    }

    return false;
  }

  private static bool IsSqlCancellationMessage(string? message) {
    if (string.IsNullOrWhiteSpace(message)) {
      return false;
    }

    return message.Contains("Operation cancelled by user", StringComparison.OrdinalIgnoreCase) ||
        message.Contains("Operation canceled by user", StringComparison.OrdinalIgnoreCase) ||
        (
          message.Contains("A severe error occurred on the current command", StringComparison.OrdinalIgnoreCase) &&
          message.Contains("discarded", StringComparison.OrdinalIgnoreCase)
        );
  }
}
