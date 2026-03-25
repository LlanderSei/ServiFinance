namespace ServiFinance.Web.Components.Layout;

public sealed record SidebarSection(string? Title, IReadOnlyList<SidebarNavItem> Items);
