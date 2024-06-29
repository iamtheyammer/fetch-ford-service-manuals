import { writeFile, readFile, mkdir } from "fs/promises";
import fetchTreeAndCover, {
  FetchTreeAndCoverParams,
} from "./fetchTreeAndCover";
import fetchTableOfContents, {
  WiringFetchParams,
} from "./wiring/fetchTableOfContents";
import saveEntireWiring from "./wiring/saveEntireWiring";
import transformCookieString from "./transformCookieString";
import { chromium, Page } from "playwright";
import { join } from "path";
import saveEntireManual from "./saveEntireManual";
import readConfig, { Config } from "./readConfig";
import processCLIArgs, { CLIArgs } from "./processCLIArgs";
import fetchPre2003AlphabeticalIndex from "./pre-2003/fetchAlphabeticalIndex";
import saveEntirePre2003AlphabeticalIndex from "./pre-2003/saveEntireAlphabeticalIndex";
import client from "./client";

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
    headless: !(process.env.HEADLESS_BROWSER === "false"),
    // proxy: { server: "localhost:8888" },
  });

  const defaultContextParams = {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
  };

  if (doCookieTest) {
    console.log("Attempting to log into PTS...");
    const cookieTestingContext = await browser.newContext(defaultContextParams);
    await cookieTestingContext.addCookies(transformedCookies);
    const cookieTestingPage = await cookieTestingContext.newPage();
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

    await cookieTestingContext.close();
  }

  if (doWorkshopDownload) {
    const workshopContext = await browser.newContext(defaultContextParams);

    if (parseInt(config.workshop.modelYear) >= 2003) {
      const browserPage = await workshopContext.newPage();
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

      await workshopContext.addCookies(transformedCookies);
      const browserPage = await workshopContext.newPage();

      await pre2003Workshop(
        config,
        outputPath,
        rawCookieString,
        browserPage,
        restArgs
      );
    }

    console.log("Saved workshop manual!");
    await workshopContext.close();
  } else {
    console.log("Skipping workshop manual download.");
  }

  if (doWiringDownload) {
    console.log("Saving wiring manual...");

    const wiringContext = await browser.newContext({
      ...defaultContextParams,
    });
    await wiringContext.addCookies(transformedCookies);
    const wiringPage = await wiringContext.newPage();

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

    await wiringContext.close();
  } else {
    console.log("Skipping wiring manual download.");
  }

  console.log("Manual downloaded, closing browser");
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
