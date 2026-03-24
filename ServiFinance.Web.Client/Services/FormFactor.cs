using ServiFinance.Shared.Services;

namespace ServiFinance.Web.Client.Services {
  public class FormFactor : IFormFactor {
    public string GetFormFactor() {
      return "WebAssembly";
    }

    public string GetPlatform() {
      return Environment.OSVersion.ToString();
    }
  }
}
