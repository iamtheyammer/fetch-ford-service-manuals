import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

export interface CLIArgs {
  configPath: string;
  outputPath: string;
  cookiePath: string;
  doWorkshopDownload: boolean;
  doWiringDownload: boolean;
  doParamsValidation: boolean;
  doCookieTest: boolean;
  saveHTML: boolean;
  ignoreSaveErrors: boolean;
  browserMode: "managed" | "remote";
  remoteDebuggingUrl: string;
}

export default function processCLIArgs(): CLIArgs {
  const optionConfig = [
    {
      name: "configFile",
      alias: "c",
      type: String,
    },
    {
      name: "cookieString",
      alias: "s",
      type: String,
    },
    {
      name: "outputPath",
      alias: "o",
      type: String,
    },
    {
      name: "noWorkshop",
      type: Boolean,
      default: false,
    },
    {
      name: "noWiring",
      type: Boolean,
      default: false,
    },
    {
      name: "noParamsValidation",
      type: Boolean,
      default: false,
    },
    {
      name: "noCookieTest",
      type: Boolean,
      default: false,
    },
    {
      name: "saveHTML",
      type: Boolean,
      default: false,
    },
    {
      name: "ignoreSaveErrors",
      alias: "i",
      type: Boolean,
      default: false,
    },
    {
      name: "browserMode",
      type: String,
      defaultValue: "managed",
    },
    {
      name: "remoteDebuggingUrl",
      type: String,
    },
    {
      name: "help",
      type: Boolean,
    },
  ];

  const sections = [
    {
      header: "Ford Workshop Manual Downloader",
      content:
        "Download the full Ford workshop manual for your car. Must have a valid PTS subscription.",
    },
    {
      header: "Options",
      optionList: [
        {
          name: "configFile -c",
          typeLabel: "{underline /path/to/config.json}",
          description: "{bold Required.} Path to your config file.",
        },
        {
          name: "cookieString -s",
          typeLabel: "{underline /path/to/cookieString.txt}",
          description:
            "{bold Required when using managed mode.} Path to the file that contains your PTS Cookie Header.",
        },
        {
          name: "outputPath -o",
          typeLabel: "{underline /path/for/manual}",
          description:
            "{bold Required.} Directory where you'd like the manual to download to. Should be an empty directory.",
        },
        {
          name: "noWorkshop",
          typeLabel: " ",
          description: "Skip downloading the Workshop Manual.",
        },
        {
          name: "noWiring",
          typeLabel: " ",
          description: "Skip downloading the Wiring Diagrams.",
        },
        {
          name: "noParamsValidation",
          typeLabel: " ",
          description: "Skip validating the configFile.",
        },
        {
          name: "noCookieTest",
          typeLabel: " ",
          description:
            "Skip trying to log into PTS before downloading manuals.",
        },
        {
          name: "saveHTML",
          typeLabel: " ",
          description:
            "Save .html files along with .pdf files. Default: false.",
        },
        {
          name: "ignoreSaveErrors",
          typeLabel: " ",
          description:
            "Ignore errors and continue downloading the manual when there's an error saving or PDF-ing a page. Default: false.",
        },
        {
          name: "browserMode",
          typeLabel: "{underline managed|remote}",
          description:
            "Choose whether Codex starts its own browser (managed) or connects to your Chrome session (remote). Default: managed.",
        },
        {
          name: "remoteDebuggingUrl",
          typeLabel: "{underline http://127.0.0.1:9222}",
          description:
            "Remote debugging endpoint to connect to when browserMode is remote. Defaults to http://127.0.0.1:9222.",
        },
        {
          name: "help",
          typeLabel: " ",
          description: "Print this usage guide.",
        },
      ],
    },
  ];

  const usage = commandLineUsage(sections);

  try {
    const options = commandLineArgs(optionConfig);
    if (options.help) {
      console.log(usage);
      process.exit(0);
    }

    if (!options.configFile || !options.outputPath) {
      console.error("Missing required args!");
      // console.log(options);
      console.log(usage);
      process.exit(1);
    }

    const requestedModeRaw =
      typeof options.browserMode === "string"
        ? options.browserMode.toLowerCase()
        : "managed";
    if (requestedModeRaw !== "managed" && requestedModeRaw !== "remote") {
      console.error(
        `Unsupported browserMode "${options.browserMode}". Use "managed" or "remote".`
      );
      process.exit(1);
    }
    const browserMode = requestedModeRaw as "managed" | "remote";

    if (browserMode === "managed" && !options.cookieString) {
      console.error("cookieString is required when using managed mode!");
      console.log(usage);
      process.exit(1);
    }

    return {
      configPath: options.configFile,
      outputPath: options.outputPath,
      cookiePath: options.cookieString,
      doWorkshopDownload: !options.noWorkshop,
      doWiringDownload: !options.noWiring,
      doParamsValidation: !options.noParamsValidation,
      doCookieTest: !options.noCookieTest,
      saveHTML: !!options.saveHTML,
      ignoreSaveErrors: !!options.ignoreSaveErrors,
      browserMode,
      remoteDebuggingUrl: options.remoteDebuggingUrl || "http://127.0.0.1:9222",
    };
  } catch (e: any) {
    console.error(e);
    console.log(usage);
    process.exit(1);
  }
}
