import { writeFile, readFile, mkdir } from "fs/promises";
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
  BrowserContextOptions,
  BrowserContext,
} from "playwright";
import { join } from "path";
import saveEntireManual from "./workshop/saveEntireManual";
import readConfig, { Config } from "./readConfig";
import processCLIArgs, { CLIArgs } from "./processCLIArgs";
import fetchPre2003AlphabeticalIndex from "./pre-2003/fetchAlphabeticalIndex";
import saveEntirePre2003AlphabeticalIndex from "./pre-2003/saveEntireAlphabeticalIndex";
import client from "./client";
import {
  USER_AGENT,
  SEC_CH_UA,
  ENV_USE_PROXY,
  ENV_HEADLESS_BROWSER,
} from "./constants";

async function run({
  configPath,
  outputPath,
  cookiePath,
  doWorkshopDownload,
  doWiringDownload,
  doParamsValidation,
  doCookieTest,
  ...restArgs
}: CLIArgs) {
  const config = await readConfig(configPath, doParamsValidation);

  // create output dir
  try {
    await mkdir(outputPath, { recursive: true });
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      console.error(`Error creating output directory ${outputPath}: ${e}`);
      process.exit(1);
    }
  }

  console.log("Processing cookies...");
  const rawCookieString = (
    await readFile(cookiePath, { encoding: "utf-8" })
  ).trim();
  const { transformedCookies, processedCookieString } =
    transformCookieString(rawCookieString);

  // Add the cookie string to the Axios client
  // It'll be sent with every request automatically
  client.defaults.headers.Cookie = processedCookieString;

  console.log("Creating a headless chromium instance...");
  const browser = await chromium.launch({
    // fix getting wiring SVGs
    args: ["--disable-web-security"],
    headless: ENV_HEADLESS_BROWSER,
    proxy: ENV_USE_PROXY ? { server: "localhost:8888" } : undefined,
  });

  // getBrowserContext applies modifications required for Headless Chrome to
  // work with PTS. This includes setting the User-Agent and sec-ch-ua headers,
  // and adding the cookies.
  const getBrowserContext = async (): Promise<BrowserContext> => {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      extraHTTPHeaders: {
        // Without this, Playwright will put "HeadlessChrome" in here and PTS will reject the request
        // When headers here conflict with default headers, the ones here take precedence.
        // HOWEVER, these headers are only used for direct requests from `page.goto()`.
        // This means that they are NOT used when the browser is redirected.
        "sec-ch-ua": SEC_CH_UA,
      },
    });

    // Mask the sec-ch-ua header on all non-file routes.
    await context.route(
      (url) => url.protocol !== "file:",
      async (route) => {
        const headers = await route.request().allHeaders();
        headers["sec-ch-ua"] = SEC_CH_UA;
        await route.continue({ headers });
      }
    );

    // Add cookies
    await context.addCookies(transformedCookies);

    return context;
  };

  const context = await getBrowserContext();

  if (doCookieTest) {
    // no newline after write
    process.stdout.write("Attempting to log into PTS...");
    const cookieTestingPage = await context.newPage();
    await cookieTestingPage.goto(
      "https://www.fordtechservice.dealerconnection.com",
      { waitUntil: "load" }
    );
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
      await browserPage.route("FordEcat.jpg", (route) => route.abort());

      await modernWorkshop(config, outputPath, browserPage, restArgs);
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

      await context.addCookies(transformedCookies);
      const browserPage = await context.newPage();

      await pre2003Workshop(
        config,
        outputPath,
        rawCookieString,
        browserPage,
        restArgs
      );
    }

    console.log("Saved workshop manual!");
  } else {
    console.log("Skipping workshop manual download.");
  }

  if (doWiringDownload) {
    console.log("Saving wiring manual...");

    await context.addCookies(transformedCookies);
    const wiringPage = await context.newPage();

    const wiringParams: WiringFetchParams = {
      ...config.wiring,
      book: config.workshop.WiringBookCode,
      contentlanguage: config.workshop.contentlanguage,
      contentmarket: config.workshop.contentmarket,
      languageCode: config.workshop.languageOdysseyCode,
    };

    console.log("Fetching wiring table of contents...");

    const wiringToC = await fetchTableOfContents(wiringParams);

    await saveEntireWiring(
      outputPath,
      config.workshop,
      wiringParams,
      wiringToC,
      wiringPage
    );
  } else {
    console.log("Skipping wiring manual download.");
  }

  console.log("Manual downloaded, closing browser");
  await context.close();
  await browser.close();
}

async function modernWorkshop(
  config: Config,
  outputPath: string,
  browserPage: Page,
  restArgs: any
) {
  console.log("Downloading and processing table of contents...");
  const tocFetchParams: FetchTreeAndCoverParams = {
    ...config.workshop,
    CategoryDescription: "GSIXML",
    category: "33",
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
    restArgs
  );
}

async function pre2003Workshop(
  config: Config,
  outputPath: string,
  rawCookieString: string,
  browserPage: Page,
  restArgs: any
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
    restArgs
  );
}

const args = processCLIArgs();
run(args).then(() => process.exit(0));
