using Jellyfin.Plugin.SleekFin.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.SleekFin.Controllers;

[ApiController]
[Route("SleekFin/Hero")]
[Authorize]
public sealed class SleekFinHeroController : ControllerBase
{
    [HttpGet("Settings")]
    public ActionResult GetSettings()
    {
        PluginConfiguration configuration = SleekFinPlugin.Instance.Configuration;
        Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        return Ok(new
        {
            enabled = configuration.HeroEnabled,
            contentOrder = HeroContentOrder.Normalize(configuration.HeroContentOrder),
            randomized = configuration.HeroRandomized
        });
    }
}