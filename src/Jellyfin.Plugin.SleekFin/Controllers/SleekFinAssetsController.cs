using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Jellyfin.Plugin.SleekFin.Helpers;

namespace Jellyfin.Plugin.SleekFin.Controllers;

[ApiController]
[Route("SleekFin")]
public sealed class SleekFinAssetsController : ControllerBase
{
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
        if (!FrontendAssets.ByFileName.TryGetValue(assetFileName, out FrontendAssets.Asset? asset))
        {
            return NotFound();
        }

        return EmbeddedFile(asset.ResourceName, asset.ContentType);
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