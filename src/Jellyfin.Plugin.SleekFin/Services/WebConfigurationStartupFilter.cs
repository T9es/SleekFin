using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace Jellyfin.Plugin.SleekFin.Services;

public sealed class WebConfigurationStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(async (context, nextMiddleware) =>
            {
                if ((HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method))
                    && context.Request.Path.Value?.EndsWith("/web/config.json", StringComparison.OrdinalIgnoreCase) == true)
                {
                    // File Transformation 3.0.1 skips callbacks when static-file validators produce a 304.
                    context.Request.Headers.Remove("If-None-Match");
                    context.Request.Headers.Remove("If-Modified-Since");
                }

                await nextMiddleware().ConfigureAwait(false);
            });

            next(app);
        };
    }
}
