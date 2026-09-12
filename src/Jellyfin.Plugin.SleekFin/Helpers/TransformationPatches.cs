using Jellyfin.Plugin.SleekFin.Model;

namespace Jellyfin.Plugin.SleekFin.Helpers;

public static class TransformationPatches
{
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

        contents = InjectAssets(contents, "theme", cacheQuery);
        contents = InjectAssets(contents, "icons", cacheQuery, false);
        contents = InjectAssets(contents, "components", cacheQuery);

        if (SleekFinPlugin.Instance.Configuration.HeaderEnabled)
        {
            contents = InjectAssets(contents, "header", cacheQuery);
        }

        if (SleekFinPlugin.Instance.Configuration.HeroEnabled)
        {
            contents = InjectAssets(contents, "hero", cacheQuery);
        }

        contents = InjectAssets(contents, "media", cacheQuery);
        contents = InjectAssets(contents, "details", cacheQuery);

        return contents;
    }

    private static string InjectAssets(string contents, string feature, string cacheQuery, bool includeStyles = true)
    {
        string marker = $"data-sleekfin-{feature}-asset";
        if (includeStyles && !contents.Contains($"{marker}=\"style\"", StringComparison.Ordinal))
        {
            string stylesheet = $"<link rel=\"stylesheet\" href=\"../SleekFin/sleekfin-{feature}.css{cacheQuery}\" {marker}=\"style\" />";
            contents = contents.Replace("</head>", $"{stylesheet}</head>", StringComparison.Ordinal);
        }

        if (!contents.Contains($"{marker}=\"script\"", StringComparison.Ordinal))
        {
            string script = $"<script defer src=\"../SleekFin/sleekfin-{feature}.js{cacheQuery}\" {marker}=\"script\"></script>";
            contents = contents.Replace("</body>", $"{script}</body>", StringComparison.Ordinal);
        }

        return contents;
    }
}