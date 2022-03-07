import { writeFile, mkdir } from "fs/promises";
import fetchTreeAndCover, {
  FetchTreeAndCoverParams,
} from "./fetchTreeAndCover";
import fetchTableOfContents, {
  FetchWiringTableOfContents,
} from "./wiring/fetchTableOfContents";
import saveEntireWiring from "./wiring/saveEntireWiring";
import transformCookieString from "./transformCookieString";
import { chromium } from "playwright";
import { join } from "path";
import saveEntireManual from "./saveEntireManual";
import readConfig from "./readConfig";
import processCLIArgs, { CLIArgs } from "./processCLIArgs";

async function run({configPath, outputPath, cookieString}: CLIArgs) {
  const config = await readConfig(configPath);

  // create output dir
  try {
    await mkdir(outputPath, {recursive: true})
  } catch(e:any) {
    if(e.code !== "EEXIST") {
      console.error(`Error creating output directory ${outputPath}: ${e}`);
      process.exit(1);
    }
  }

  const tocFetchParams: FetchTreeAndCoverParams = {
    ...config.workshop,
    CategoryDescription: "GSIXML",
    category: "33",
  };

  console.log("Creating a headless chromium instance...");
  const browser = await chromium.launch({
    // fix getting wiring SVGs
    args: ["--disable-web-security"],
  });

  const pageParams = {
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
  };
  const browserPage = await browser.newPage(pageParams);
  browserPage.route("FordEcat.jpg", (route) => route.abort());

  console.log("Downloading and processing table of contents...");
  const { tableOfContents, pageHTML } = await fetchTreeAndCover(tocFetchParams);

  await writeFile(
    join(outputPath, "toc.json"),
    JSON.stringify(tableOfContents, null, 2)
  );
  await writeFile(join(outputPath, "cover.html"), pageHTML);

  console.log("Saving manual files...");
  await saveEntireManual(outputPath, tableOfContents, config.workshop, browserPage);

  console.log("Saving wiring manual...");

  const transformedCookieString = transformCookieString(cookieString);

  const wiringContext = await browser.newContext({
    ...pageParams,
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

  console.log("Manual downloaded, closing browser");
  await browser.close();
}

const args = processCLIArgs();
run(args);
