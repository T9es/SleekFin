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
            randomized = configuration.HeroRandomized,
            slidesShown = configuration.HeroSlidesShown,
            contentAlignment = configuration.HeroContentAlignment,
            verticalAlignment = configuration.HeroVerticalAlignment,
            mobileHeight = configuration.HeroMobileHeight,
            desktopHeight = configuration.HeroDesktopHeight,
            contentMaxWidth = configuration.HeroContentMaxWidth,
            titleTreatment = configuration.HeroTitleTreatment,
            backdropFit = configuration.HeroBackdropFit,
            backdropFocusX = configuration.HeroBackdropFocusX,
            backdropFocusY = configuration.HeroBackdropFocusY,
            backdropOpacity = configuration.HeroBackdropOpacity,
            titleSize = configuration.HeroTitleSize,
            titleWeight = configuration.HeroTitleWeight,
            titleCase = configuration.HeroTitleCase,
            descriptionSize = configuration.HeroDescriptionSize,
            descriptionWeight = configuration.HeroDescriptionWeight,
            descriptionColor = configuration.HeroDescriptionColor,
            descriptionLines = configuration.HeroDescriptionLines,
            titleColor = configuration.HeroTitleColor,
            buttonHeight = configuration.HeroButtonHeight,
            primaryButtonBackgroundColor = configuration.HeroPrimaryButtonBackgroundColor,
            primaryButtonTextColor = configuration.HeroPrimaryButtonTextColor,
            primaryButtonOpacity = configuration.HeroPrimaryButtonOpacity,
            secondaryButtonBackgroundColor = configuration.HeroSecondaryButtonBackgroundColor,
            secondaryButtonOpacity = configuration.HeroSecondaryButtonOpacity,
            buttonCornerStyle = configuration.HeroButtonCornerStyle,
            secondaryButtonTextColor = configuration.HeroSecondaryButtonTextColor,
            autoRotateSeconds = configuration.HeroAutoRotateSeconds,
            transitionStyle = configuration.HeroTransitionStyle,
            transitionDurationMs = configuration.HeroTransitionDurationMs,
            swipeEnabled = configuration.HeroSwipeEnabled,
            vignetteStrength = configuration.HeroVignetteStrength
        });
    }
}