import { writeFile, readFile, mkdir } from "fs/promises";
import fetchTreeAndCover, {
  FetchTreeAndCoverParams,
} from "./fetchTreeAndCover";
import fetchTableOfContents, {
  FetchWiringTableOfContents,
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

async function run({
  configPath,
  outputPath,
  cookiePath,
  ...restArgs
}: CLIArgs) {
  const config = await readConfig(configPath);

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
  const cookieString = (
    await readFile(cookiePath, { encoding: "utf-8" })
  ).trim();
  const transformedCookieString = transformCookieString(cookieString);

  console.log("Creating a headless chromium instance...");
  const browser = await chromium.launch({
    // fix getting wiring SVGs
    args: ["--disable-web-security"],
    headless: true,
  });

  const workshopContextParams = {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
  };
  const workshopContext = await browser.newContext(workshopContextParams);

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

    await workshopContext.addCookies(transformedCookieString);
    const browserPage = await workshopContext.newPage();

    await pre2003Workshop(
      config,
      outputPath,
      cookieString,
      browserPage,
      restArgs
    );
  }

  console.log("Saved workshop manual!");
  await workshopContext.close();

  console.log("Saving wiring manual...");

  const wiringContext = await browser.newContext({
    ...workshopContextParams,
    viewport: {
      width: 2560,
      height: 1440,
    },
  });
  await wiringContext.addCookies(transformedCookieString);
  const wiringPage = await wiringContext.newPage();

  // wiringPage.on("requestfinished", async resp => {
  //   if(!resp.url().includes(".svg")) return;
  //   const respData = await resp.allHeaders()
  //   console.log(resp.url());
  //   console.log(respData);
  //   const response = await resp.response();
  //   console.log((await response!.body()).toString())
  // })
  // wiringPage.on("console", console.log)

  const wiringParams: FetchWiringTableOfContents = {
    ...config.wiring,
    book: config.workshop.WiringBookCode,
    contentlanguage: config.workshop.contentlanguage,
    contentmarket: config.workshop.contentmarket,
  };

  const wiringToC = await fetchTableOfContents(wiringParams, cookieString);

  await saveEntireWiring(
    outputPath,
    config.workshop,
    wiringParams,
    wiringToC,
    cookieString,
    wiringPage
  );

  await wiringContext.close();

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
run(args);
