using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.SleekFin.Controllers;

[ApiController]
[Route("SleekFin")]
public sealed class SleekFinAssetsController : ControllerBase
{
    private static readonly IReadOnlyDictionary<string, string> AssetFolders = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["sleekfin-theme.css"] = "Theme",
        ["sleekfin-theme.js"] = "Theme",
        ["sleekfin-icons.js"] = "Components",
        ["sleekfin-components.css"] = "Components",
        ["sleekfin-components.js"] = "Components",
        ["sleekfin-header.css"] = "Header",
        ["sleekfin-header.js"] = "Header",
        ["sleekfin-hero.css"] = "Hero",
        ["sleekfin-hero.js"] = "Hero",
        ["sleekfin-media.css"] = "Media",
        ["sleekfin-media.js"] = "Media",
        ["sleekfin-details.css"] = "Details",
        ["sleekfin-details.js"] = "Details"
    };

    private static readonly HashSet<string> FontFileNames = new(StringComparer.Ordinal)
    {
        "inter-cyrillic-ext.woff2",
        "inter-cyrillic.woff2",
        "inter-greek-ext.woff2",
        "inter-greek.woff2",
        "inter-vietnamese.woff2",
        "inter-latin-ext.woff2",
        "inter-latin.woff2"
    };

    [HttpGet("{assetFileName}")]
    [AllowAnonymous]
    public ActionResult GetAsset(string assetFileName)
    {
        if (!AssetFolders.TryGetValue(assetFileName, out string? folder))
        {
            return NotFound();
        }

        string contentType = assetFileName.EndsWith(".css", StringComparison.Ordinal)
            ? "text/css; charset=utf-8"
            : "text/javascript; charset=utf-8";
        return EmbeddedFile($"Jellyfin.Plugin.SleekFin.Inject.{folder}.{assetFileName}", contentType);
    }

    [HttpGet("fonts/{fontFileName}")]
    [AllowAnonymous]
    public ActionResult GetFont(string fontFileName)
    {
        if (!FontFileNames.Contains(fontFileName))
        {
            return NotFound();
        }

        return EmbeddedFile($"Jellyfin.Plugin.SleekFin.Inject.Fonts.{fontFileName}", "font/woff2");
    }

    private ActionResult EmbeddedFile(string resourceName, string contentType)
    {
        Stream? resourceStream = typeof(SleekFinPlugin).Assembly.GetManifestResourceStream(resourceName);
        if (resourceStream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return File(resourceStream, contentType);
    }
}