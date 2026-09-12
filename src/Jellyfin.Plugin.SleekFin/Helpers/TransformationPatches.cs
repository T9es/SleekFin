using System.Text.RegularExpressions;
using Jellyfin.Plugin.SleekFin.Configuration;
using Jellyfin.Plugin.SleekFin.Model;

namespace Jellyfin.Plugin.SleekFin.Helpers;

public static class TransformationPatches
{
    private static readonly Regex InjectedStyles = new(
        "<link\\b[^>]*\\bdata-sleekfin-(?:[a-z]+-)?asset=\"[^\"]*\"[^>]*>",
        RegexOptions.CultureInvariant);

    // Matches the deferred asset scripts and the inline boot script, so a repeated transformation
    // replaces them instead of stacking them. The body is matched lazily, which stops each match at
    // its own closing tag and keeps it from swallowing the document content between two injected
    // elements.
    private static readonly Regex InjectedScripts = new(
        "<script\\b[^>]*\\bdata-sleekfin-(?:(?:[a-z]+-)?asset=\"[^\"]*\"|boot\\b)[^>]*>[\\s\\S]*?</script>",
        RegexOptions.CultureInvariant);

    // Jellyfin paints its own detail page long before the deferred bundle runs, so only a
    // synchronous inline script parsed with the head can conceal it from the first frame. It is
    // emitted last in the head, behind the stylesheets that style the concealed state, and the
    // class name below is the one the details bundle adds and removes.
    private const string BootElement =
        @"<script data-sleekfin-boot>(function(){var h=window.location.hash.slice(1).replace(/^!+/,'');"
        + @"var s=h||window.location.pathname,i=s.search(/[?&]/),p=(i<0?s:s.slice(0,i)).replace(/^[!\/]+/,'/');"
        + @"if(/(^|\/)details\/?$/.test(p)){document.documentElement.classList.add('sleekfin-details-concealed');}})();</script>";

    public static string IndexHtml(PatchRequestPayload payload)
    {
        string contents = payload.Contents ?? string.Empty;
        if (string.IsNullOrEmpty(contents)
            || !contents.Contains("</head>", StringComparison.Ordinal)
            || !contents.Contains("</body>", StringComparison.Ordinal))
        {
            return contents;
        }

        var assembly = typeof(SleekFinPlugin).Assembly;
        string version = assembly.GetName().Version?.ToString() ?? "0.1.0.0";
        string buildId = assembly.ManifestModule.ModuleVersionId.ToString("N");
        string cacheQuery = $"?v={version}&b={buildId}";

        contents = InjectedStyles.Replace(contents, string.Empty);
        contents = InjectedScripts.Replace(contents, string.Empty);

        PluginConfiguration configuration = SleekFinPlugin.Instance.Configuration;
        foreach (FrontendAssets.Asset asset in FrontendAssets.Ordered)
        {
            if (!ShouldInject(asset, configuration))
            {
                continue;
            }

            string url = $"../SleekFin/{asset.FileName}{cacheQuery}";
            string element = asset.IsStyle ? $"<link rel=\"stylesheet\" href=\"{url}\" data-sleekfin-asset=\"{asset.FileName}\" />" : $"<script defer src=\"{url}\" data-sleekfin-asset=\"{asset.FileName}\"></script>";
            string closingTag = asset.IsStyle ? "</head>" : "</body>";
            contents = contents.Replace(closingTag, $"{element}{closingTag}", StringComparison.Ordinal);
        }

        contents = contents.Replace("</head>", $"{BootElement}</head>", StringComparison.Ordinal);

        return contents;
    }

    private static bool ShouldInject(FrontendAssets.Asset asset, PluginConfiguration configuration)
    {
        return asset.RequiredFeature switch
        {
            FrontendAssets.Feature.Header => configuration.HeaderEnabled,
            FrontendAssets.Feature.Hero => configuration.HeroEnabled,
            _ => true
        };
    }
}