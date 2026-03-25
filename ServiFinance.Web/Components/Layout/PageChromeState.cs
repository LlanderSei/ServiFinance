namespace ServiFinance.Web.Components.Layout;

public sealed class PageChromeState {
  private Guid _ownerToken;

  public string Title { get; private set; } = string.Empty;
  public IReadOnlyList<BreadcrumbItem> Breadcrumbs { get; private set; } = Array.Empty<BreadcrumbItem>();
  public IReadOnlyList<HeaderBadge> Badges { get; private set; } = Array.Empty<HeaderBadge>();

  public event Action? Changed;

  public void Update(Guid token, string title, IReadOnlyList<BreadcrumbItem>? breadcrumbs, IReadOnlyList<HeaderBadge>? badges) {
    _ownerToken = token;
    Title = title;
    Breadcrumbs = breadcrumbs ?? Array.Empty<BreadcrumbItem>();
    Badges = badges ?? Array.Empty<HeaderBadge>();
    Changed?.Invoke();
  }

  public void Clear(Guid token) {
    if (_ownerToken != token) {
      return;
    }

    Title = string.Empty;
    Breadcrumbs = Array.Empty<BreadcrumbItem>();
    Badges = Array.Empty<HeaderBadge>();
    Changed?.Invoke();
  }
}
