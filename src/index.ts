import { writeFile, readFile, mkdir, access } from "fs/promises";
import fetchTreeAndCover, {
  FetchTreeAndCoverParams,
} from "./workshop/fetchTreeAndCover";
import fetchTableOfContents, {
  WiringFetchParams,
} from "./wiring/fetchTableOfContents";
import saveEntireWiring from "./wiring/saveEntireWiring";
import transformCookieString from "./transformCookieString";
import {
  chromium,
  Page,
  BrowserContext,
  LaunchOptions,
  Browser,
} from "playwright";
import { join } from "path";
import saveEntireManual, { SaveOptions } from "./workshop/saveEntireManual";
import readConfig, { Config } from "./readConfig";
import processCLIArgs, { CLIArgs } from "./processCLIArgs";
import fetchPre2003AlphabeticalIndex from "./pre-2003/fetchAlphabeticalIndex";
import saveEntirePre2003AlphabeticalIndex from "./pre-2003/saveEntireAlphabeticalIndex";
import client, { setCookies } from "./client";
import {
  USER_AGENT,
  SEC_CH_UA,
  ENV_USE_PROXY,
  ENV_HEADLESS_BROWSER,
} from "./constants";

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

type BrowserCookies = Awaited<ReturnType<BrowserContext["cookies"]>>;

const COOKIE_SOURCE_URLS = [
  "https://www.fordtechservice.dealerconnection.com",
  "https://www.fordservicecontent.com",
];

const serializeCookies = (cookies: BrowserCookies): string =>
  cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

const getCookieHeaderFromContext = async (
  context: BrowserContext
): Promise<string> => {
  for (const url of COOKIE_SOURCE_URLS) {
    const header = serializeCookies(await context.cookies(url));
    if (header) {
      return header;
    }
  }

  const fallback = serializeCookies(
    (await context.cookies()).filter((cookie) =>
      cookie.domain
        ? cookie.domain.includes("dealerconnection.com") ||
          cookie.domain.includes("fordservicecontent.com")
        : false
    )
  );

  return fallback;
};

async function run({
  configPath,
  outputPath,
  cookiePath,
  doWorkshopDownload,
  doWiringDownload,
  doParamsValidation,
  doCookieTest,
  saveHTML,
  ignoreSaveErrors,
  browserMode,
  remoteDebuggingUrl,
}: CLIArgs) {
  const config = await readConfig(configPath, doParamsValidation);
  const saveOptions: SaveOptions = { saveHTML, ignoreSaveErrors };
  const isRemoteBrowser = browserMode === "remote";
  let rawCookieString = "";
  let transformedCookies: Parameters<BrowserContext["addCookies"]>[0] = [];
  let processedCookieString = "";

  if (!isRemoteBrowser) {
    console.log("Processing cookies...");
    rawCookieString = (await readFile(cookiePath, { encoding: "utf-8" }))
      .trim()
      .replaceAll("\n", " ");
    const cookieData = transformCookieString(rawCookieString);
    transformedCookies = cookieData.transformedCookies;
    processedCookieString = cookieData.processedCookieString;

    // Add the cookie string to the Axios client
    // It'll be sent with every request automatically
    setCookies(processedCookieString);
  } else {
    console.log("Using cookies from the connected Chrome session...");
  }

  // create output dir
  try {
    await mkdir(outputPath, { recursive: true });
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      console.error(`Error creating output directory ${outputPath}: ${e}`);
      process.exit(1);
    }
  }

  const cacheDir = join(process.cwd(), ".cache");
  try {
    await mkdir(cacheDir, { recursive: true });
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      console.error(`Error creating cache directory ${cacheDir}: ${e}`);
      process.exit(1);
    }
  }

  const storageStatePath = join(cacheDir, "playwright-storage-state.json");
  const storageStateExists = await fileExists(storageStatePath);
  let browser: Browser;
  if (isRemoteBrowser) {
    console.log(
      `Connecting to an existing Chrome instance at ${remoteDebuggingUrl}...`
    );
    try {
      browser = await chromium.connectOverCDP(remoteDebuggingUrl);
    } catch (error) {
      console.error(
        `Failed to connect to Chrome via ${remoteDebuggingUrl}. ` +
          "Make sure Chrome is started with --remote-debugging-port and retry."
      );
      console.error(error);
      process.exit(1);
    }
  } else {
    console.log("Creating a chromium instance...");
    const launchArgs: LaunchOptions["args"] = [
      // fix getting wiring SVGs while keeping the rest of the browser close to stock
      "--disable-web-security",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=Translate,BackForwardCache",
      "--start-maximized",
      "--disable-extensions",
      "--no-default-browser-check",
      "--no-first-run",
    ];

    browser = await chromium.launch({
      args: launchArgs,
      headless: ENV_HEADLESS_BROWSER,
      proxy: ENV_USE_PROXY ? { server: "localhost:8888" } : undefined,
      // Remove obvious automation flags from the launched Chrome instance
      ignoreDefaultArgs: ["--enable-automation"],
    });
  }

  // getBrowserContext applies modifications required for Headless Chrome to
  // work with PTS. This includes setting the User-Agent and sec-ch-ua headers,
  // and adding the cookies.
  const viewport = { width: 1366, height: 768 } as const;

  const applyStealthTweaks = async (context: BrowserContext) => {
    // Run before any page scripts to mask common automation fingerprints
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "platform", { get: () => "Win32" });
      Object.defineProperty(navigator, "language", { get: () => "en-US" });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 8,
      });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
      // window.chrome ??= { runtime: {} } as any;
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          { name: "Chrome PDF Plugin" },
          { name: "Chrome PDF Viewer" },
          { name: "Native Client" },
        ],
      });

      // const originalQuery = window.navigator.permissions.query;
      // window.navigator.permissions.query = (parameters) =>
      //   parameters.name === "notifications"
      //     ? Promise.resolve({ state: Notification.permission })
      //     : originalQuery(parameters);

      // Strip headless token if the UA ever includes it
      if (navigator.userAgent.includes("HeadlessChrome")) {
        const patchedUA = navigator.userAgent.replace(
          "HeadlessChrome",
          "Chrome"
        );
        Object.defineProperty(navigator, "userAgent", {
          get: () => patchedUA,
        });
      }
    });
  };

  const applyContextDefaults = async (
    context: BrowserContext,
    options: { applyStealth: boolean; addCookies: boolean }
  ): Promise<void> => {
    if (options.applyStealth) {
      await applyStealthTweaks(context);

      await context.route(
        (url) => url.protocol !== "file:",
        async (route) => {
          const headers = await route.request().allHeaders();
          headers["sec-ch-ua"] = SEC_CH_UA;
          await route.continue({ headers });
        }
      );
    }

    if (options.addCookies && transformedCookies.length) {
      await context.addCookies(transformedCookies);
    }
  };

  const createManagedContext = async (): Promise<BrowserContext> => {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport,
      screen: viewport,
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "America/New_York",
      colorScheme: "light",
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        "sec-ch-ua": SEC_CH_UA,
        "accept-language": "en,zh-CN;q=0.9,zh;q=0.8",
      },
      storageState: storageStateExists ? storageStatePath : undefined,
    });
    await applyContextDefaults(context, {
      applyStealth: true,
      addCookies: true,
    });
    return context;
  };

  const getRemoteContext = async (): Promise<BrowserContext> => {
    const existingContexts = browser.contexts();
    if (!existingContexts.length) {
      console.warn(
        "No existing Chrome contexts were found. Creating a fresh one; log into PTS manually if needed."
      );
    }
    const context =
      existingContexts[0] ??
      (await browser.newContext({
        viewport,
        screen: viewport,
      }));
    await applyContextDefaults(context, {
      applyStealth: false,
      addCookies: false,
    });
    return context;
  };

  const context = isRemoteBrowser
    ? await getRemoteContext()
    : await createManagedContext();

  if (isRemoteBrowser) {
    const remoteCookieHeader = await getCookieHeaderFromContext(context);
    if (!remoteCookieHeader) {
      console.error(
        "Could not find any PTS cookies inside the connected Chrome session. " +
          "Please log into PTS in that browser and try again."
      );
      process.exit(1);
    }

    rawCookieString = remoteCookieHeader.trim();
    const cookieData = transformCookieString(rawCookieString);
    transformedCookies = cookieData.transformedCookies;
    processedCookieString = cookieData.processedCookieString;
    setCookies(processedCookieString);
    console.log("Loaded cookies from the active Chrome session.");
  }

  const addCookiesToContext = async (): Promise<void> => {
    if (!isRemoteBrowser && transformedCookies.length) {
      await context.addCookies(transformedCookies);
    }
  };

  const preparePage = async (page: Page): Promise<void> => {
    if (isRemoteBrowser) {
      await page.setViewportSize(viewport);
    }
  };

  if (doCookieTest) {
    // no newline after write
    process.stdout.write("Attempting to log into PTS...");
    const cookieTestingPage = await context.newPage();
    await preparePage(cookieTestingPage);

    try {
      await cookieTestingPage.goto(
        "https://www.fordtechservice.dealerconnection.com",
        { waitUntil: "load" }
      );
    } catch (e) {
      // Wait until user presses enter
      process.stdout.write("Press Enter to continue...");
      await new Promise((resolve) => process.stdin.once("data", resolve));
      console.log("Continuing...");

      await cookieTestingPage.goto(
        "https://www.fordtechservice.dealerconnection.com",
        { waitUntil: "load" }
      );
    }

    if (cookieTestingPage.url().includes("subscriptionExpired")) {
      console.error(
        "Looks like your PTS subscription has expired. " +
          "Re-subscribe to download manuals. If you just want to download a workshop manual, " +
          "you may be able to do so without re-subscribing: run the script with --noCookieTest."
      );
      const expiryDate = await cookieTestingPage.evaluate(
        'document.querySelector("#pts-page > ul > li > b")?.innerText?.trim()'
      );
      if (expiryDate) {
        console.error(expiryDate);
      }
      process.exit(1);
    } else if (
      !cookieTestingPage
        .url()
        .startsWith("https://www.fordtechservice.dealerconnection.com")
    ) {
      console.error("Failed to log in with the provided cookies.");
      process.exit(1);
    }
    console.log("ok!");
    await cookieTestingPage.close();
  }

  if (doWorkshopDownload) {
    if (parseInt(config.workshop.modelYear) >= 2003) {
      const browserPage = await context.newPage();
      await preparePage(browserPage);
      await browserPage.route("FordEcat.jpg", (route) => route.abort());

      try {
        await modernWorkshop(config, outputPath, browserPage, saveOptions);
      } finally {
        await browserPage.close();
      }
    } else {
      console.log(
        "Downloading pre-2003 workshop manual, please see README for details..."
      );

      if (
        config.pre_2003.alphabeticalIndexURL ===
        "https://www.fordservicecontent.com/pubs/content/....."
      ) {
        console.error(
          "Please set the URL for the pre-2003 alphabetical index in the config file."
        );
        process.exit(1);
      }

      await addCookiesToContext();
      const browserPage = await context.newPage();
      await preparePage(browserPage);

      try {
        await pre2003Workshop(
          config,
          outputPath,
          rawCookieString,
          browserPage,
          saveOptions
        );
      } finally {
        await browserPage.close();
      }
    }

    console.log("Saved workshop manual!");
  } else {
    console.log("Skipping workshop manual download.");
  }

  if (doWiringDownload) {
    console.log("Saving wiring manual...");

    await addCookiesToContext();
    const wiringPage = await context.newPage();
    await preparePage(wiringPage);

    const wiringParams: WiringFetchParams = {
      ...config.wiring,
      book: config.workshop.WiringBookCode,
      contentlanguage: config.workshop.contentlanguage,
      contentmarket: config.workshop.contentmarket,
      languageCode: config.workshop.languageOdysseyCode,
    };

    console.log("Fetching wiring table of contents...");

    const wiringToC = await fetchTableOfContents(wiringParams);

    try {
      await saveEntireWiring(
        outputPath,
        config.workshop,
        wiringParams,
        wiringToC,
        wiringPage
      );
    } finally {
      await wiringPage.close();
    }
  } else {
    console.log("Skipping wiring manual download.");
  }

  if (isRemoteBrowser) {
    console.log("Manual downloaded, leaving remote Chrome session running.");
  } else {
    console.log("Manual downloaded, closing browser");
    await context.storageState({ path: storageStatePath });
    await context.close();
    await browser.close();
  }
}

async function modernWorkshop(
  config: Config,
  outputPath: string,
  browserPage: Page,
  saveOptions: SaveOptions
) {
  console.log("Downloading and processing table of contents...");
  const tocFetchParams: FetchTreeAndCoverParams = {
    ...config.workshop,
    CategoryDescription: "GSIXML",
    category: "32",
    environment: config.wiring.environment,
  };
  const { tableOfContents, pageHTML } = await fetchTreeAndCover(tocFetchParams);

  await writeFile(
    join(outputPath, "toc.json"),
    JSON.stringify(tableOfContents, null, 2)
  );
  const coverPath = join(outputPath, "cover");
  await writeFile(coverPath + ".html", pageHTML);

  console.log("Saving manual files...");
  await saveEntireManual(
    outputPath,
    tableOfContents,
    config.workshop,
    browserPage,
    saveOptions
  );
}

async function pre2003Workshop(
  config: Config,
  outputPath: string,
  rawCookieString: string,
  browserPage: Page,
  saveOptions: SaveOptions
) {
  console.log("Downloading and processing alphabetical index...");
  const { documentList, pageHTML, modifiedHTML } =
    await fetchPre2003AlphabeticalIndex(
      config.pre_2003.alphabeticalIndexURL,
      rawCookieString
    );

  // usable ToC
  await writeFile(join(outputPath, "AAA_Table_Of_Contents.html"), modifiedHTML);
  // original ToC
  await writeFile(
    join(outputPath, "AA_originalTableOfContents.html"),
    pageHTML
  );
  // JSON ToC
  await writeFile(
    join(outputPath, "AA_alphabeticalIndex.json"),
    JSON.stringify(documentList, null, 2)
  );

  console.log("Saving manual files...");
  await saveEntirePre2003AlphabeticalIndex(
    outputPath,
    documentList,
    browserPage,
    saveOptions
  );
}

const args = processCLIArgs();
run(args).then(() => process.exit(0));
