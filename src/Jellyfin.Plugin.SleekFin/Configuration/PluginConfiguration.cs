using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.SleekFin.Configuration;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public bool HeaderEnabled { get; set; } = true;

    public bool HeroEnabled { get; set; } = true;

    public string HeroContentOrder { get; set; } = "ContinueWatching,NextUp,LatestMovies,LatestShows,Favorites";

    public bool HeroRandomized { get; set; }
}