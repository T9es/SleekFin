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

        if (SleekFinPlugin.Instance.Configuration.HeaderEnabled)
        {
            contents = InjectAssets(contents, "header", cacheQuery);
        }

        if (SleekFinPlugin.Instance.Configuration.HeroEnabled)
        {
            contents = InjectAssets(contents, "hero", cacheQuery);
        }

        return contents;
    }

    private static string InjectAssets(string contents, string feature, string cacheQuery)
    {
        string marker = $"data-sleekfin-{feature}-asset";
        if (contents.Contains(marker, StringComparison.Ordinal))
        {
            return contents;
        }

        string stylesheet = $"<link rel=\"stylesheet\" href=\"../SleekFin/sleekfin-{feature}.css{cacheQuery}\" {marker}=\"style\" />";
        string script = $"<script defer src=\"../SleekFin/sleekfin-{feature}.js{cacheQuery}\" {marker}=\"script\"></script>";

        return contents
            .Replace("</head>", $"{stylesheet}</head>", StringComparison.Ordinal)
            .Replace("</body>", $"{script}</body>", StringComparison.Ordinal);
    }
}