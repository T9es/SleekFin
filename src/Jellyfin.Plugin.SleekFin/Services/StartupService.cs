using System.Reflection;
using System.Runtime.Loader;
using Jellyfin.Plugin.SleekFin.Helpers;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.SleekFin.Services;

public sealed class StartupService : IScheduledTask
{
    private static readonly Guid IndexHtmlTransformationId = Guid.Parse("56ac767e-ef47-4716-a585-9737a1813269");
    private readonly ILogger<StartupService> _logger;

    public StartupService(ILogger<StartupService> logger)
    {
        _logger = logger;
    }

    public string Name => "SleekFin Startup";

    public string Key => "Jellyfin.Plugin.SleekFin.Startup";

    public string Description => "Registers SleekFin with Jellyfin Web.";

    public string Category => "Startup Services";

    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        try
        {
            Assembly? fileTransformationAssembly = AssemblyLoadContext.All
                .SelectMany(context => context.Assemblies)
                .FirstOrDefault(assembly => assembly.GetName().Name?.Contains(".FileTransformation", StringComparison.Ordinal) == true);

            if (fileTransformationAssembly is null)
            {
                _logger.LogWarning("SleekFin requires the File Transformation plugin to inject assets.");
                return Task.CompletedTask;
            }

            Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            MethodInfo? registerTransformation = pluginInterfaceType?.GetMethod(
                "RegisterTransformation",
                BindingFlags.Public | BindingFlags.Static,
                binder: null,
                types: [typeof(JObject)],
                modifiers: null);

            if (registerTransformation is null || registerTransformation.ReturnType != typeof(void))
            {
                _logger.LogWarning("SleekFin could not find the supported File Transformation registration contract.");
                return Task.CompletedTask;
            }

            var registration = new JObject
            {
                ["id"] = IndexHtmlTransformationId,
                ["fileNamePattern"] = "index.html",
                ["callbackAssembly"] = GetType().Assembly.FullName,
                ["callbackClass"] = typeof(TransformationPatches).FullName,
                ["callbackMethod"] = nameof(TransformationPatches.IndexHtml)
            };

            registerTransformation.Invoke(null, [registration]);
            _logger.LogInformation("SleekFin registered its Jellyfin Web transformation.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "SleekFin could not register with File Transformation; Jellyfin Web will remain unchanged.");
        }

        return Task.CompletedTask;
    }

    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo
        {
            Type = TaskTriggerInfoType.StartupTrigger
        };
    }
}