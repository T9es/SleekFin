using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.SleekFin;

public sealed class SleekFinPlugin : BasePlugin<BasePluginConfiguration>
{
    public SleekFinPlugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
    }

    public override Guid Id => Guid.Parse("da36c4ef-1d10-4169-8a68-26b194d5301a");

    public override string Name => "SleekFin";

    public override string Description => "The ultimate Jellyfin Web revamp, with new elements, styles, plus compatible with the most popular plugins.";
}
