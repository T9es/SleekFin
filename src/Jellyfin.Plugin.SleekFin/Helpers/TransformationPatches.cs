using Jellyfin.Plugin.SleekFin.Model;

namespace Jellyfin.Plugin.SleekFin.Helpers;

public static class TransformationPatches
{
    private const string AssetMarker = "data-sleekfin-header-asset";

    public static string IndexHtml(PatchRequestPayload payload)
    {
        string contents = payload.Contents ?? string.Empty;
        if (!SleekFinPlugin.Instance.Configuration.HeaderEnabled
            || string.IsNullOrEmpty(contents)
            || contents.Contains(AssetMarker, StringComparison.Ordinal)
            || !contents.Contains("</head>", StringComparison.Ordinal)
            || !contents.Contains("</body>", StringComparison.Ordinal))
        {
            return contents;
        }

        var assembly = typeof(SleekFinPlugin).Assembly;
        string version = assembly.GetName().Version?.ToString() ?? "0.1.0.0";
        string buildId = assembly.ManifestModule.ModuleVersionId.ToString("N");
        string cacheQuery = $"?v={version}&b={buildId}";
        string stylesheet = $"<link rel=\"stylesheet\" href=\"../SleekFin/sleekfin-header.css{cacheQuery}\" {AssetMarker}=\"style\" />";
        string script = $"<script defer src=\"../SleekFin/sleekfin-header.js{cacheQuery}\" {AssetMarker}=\"script\"></script>";

        return contents
            .Replace("</head>", $"{stylesheet}</head>", StringComparison.Ordinal)
            .Replace("</body>", $"{script}</body>", StringComparison.Ordinal);
    }
}