import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import fetchManualPage, { FetchManualPageParams } from "./fetchManualPage";
import client from "../client";
import { Page } from "playwright";
import { CLIArgs } from "../processCLIArgs";
import saveStream, { sanitizeName } from "../utils";

export type SaveOptions = Pick<
  CLIArgs,
  "saveHTML" | "ignoreSaveErrors" | "expandPinpoints" | "onlyPath" | "skipExisting"
>;

// Pinpoint tests ship inside the page HTML but collapsed: each test body is a
// <div id="PPTx" style="display:none">, its steps are hidden
// <tr data-content-type="step"> rows, and "click for details" text sits in a
// hidden <span> after its link. Un-hide them all so they print. No clicking, so
// the page can't navigate away. Selectors credit: upstream PR #43 (octoben).
const EXPAND_PINPOINTS_JS = `(() => {
  const show = (el, v) => { el.style.display = v; };
  const headers = document.querySelectorAll(".isipppt").length;
  const bodies = document.querySelectorAll('div[id^="PPT"]');
  bodies.forEach((e) => show(e, "block"));
  const steps = document.querySelectorAll('tr[data-content-type="step"]');
  steps.forEach((e) => show(e, ""));
  const details = document.querySelectorAll('a[data-pptlinktype="clickfordetails"]');
  details.forEach((a) => {
    show(a, "none");
    const next = a.nextElementSibling;
    if (next && next.tagName === "SPAN") show(next, "inline");
  });
  return { headers, bodies: bodies.length, steps: steps.length, details: details.length };
})()`;

// Powertrain pages embed shared ("SPA") pinpoint tests as collapsed
// <span class="spappt" data-spapptfile="2021_GASOLINE_HD"> headers whose body
// PTS loads on click: a POST to the same Proc endpoint with
// searchNumber "<spapptfile>_spappt" and procUid = this page's docID.
// Fetch each one and insert it after its header so it prints with the page.
async function inlineSharedPinpointTests(
  pageHTML: string,
  docID: string,
  fetchPageParams: FetchManualPageParams
): Promise<{ html: string; found: number; inlined: number }> {
  const files = Array.from(
    new Set(
      Array.from(
        pageHTML.matchAll(/class="spappt"[^>]*data-spapptfile="([^"]+)"/g)
      ).map((m) => m[1])
    )
  );
  let html = pageHTML;
  let inlined = 0;
  for (const file of files) {
    try {
      const body = await fetchManualPage({
        ...fetchPageParams,
        searchNumber: `${file}_spappt`,
        procUid: docID,
        diagTool: "FDRS",
        category: "32",
      });
      if (typeof body !== "string" || body.trim().length === 0) {
        console.warn(`-> WARNING: empty SPA pinpoint test ${file} (docID ${docID})`);
        continue;
      }
      // insert right after the header span that carries this file name
      const marker = new RegExp(
        `(<span[^>]*data-spapptfile="${file}"[^>]*>)`
      );
      const at = html.search(marker);
      if (at < 0) continue;
      const close = html.indexOf("<br", at);
      const insertAt = close > at ? close : at;
      html =
        html.slice(0, insertAt) +
        `<div class="spappt-inlined" data-spapptfile="${file}">${body}</div>` +
        html.slice(insertAt);
      inlined++;
    } catch (e) {
      console.warn(`-> WARNING: could not fetch SPA pinpoint test ${file} (docID ${docID}): ${e}`);
    }
  }
  return { html, found: files.length, inlined };
}

export default async function saveEntireManual(
  path: string,
  toc: any,
  fetchPageParams: FetchManualPageParams,
  browserPage: Page,
  options: SaveOptions
) {
  const exploded = Object.entries(toc);

  for (let i = 0; i < exploded.length; i++) {
    const [name, docID] = exploded[i];

    if (typeof docID === "string" && docID.length > 0) {
      if (
        options.onlyPath &&
        !join(path, sanitizeName(name)).includes(options.onlyPath)
      ) {
        continue;
      }
      // download and save document
      if (docID.startsWith("http") && docID.includes(".pdf")) {
        console.log(`Downloading manual PDF ${name} ${docID}`);

        try {
          const pdfReq = await client({
            url: docID,
            responseType: "stream",
          });

          const filePath = join(
            path,
            `/${docID.slice(docID.lastIndexOf("/"))}`
          );
          await saveStream(pdfReq.data, filePath);
        } catch (e) {
          console.error(`Error saving file ${name} with url ${docID}: ${e}`);
        }
        continue;
      } else if (docID.includes("/")) {
        console.error(`Skipping relative path ${docID} for name ${name}`);
        continue;
      }

      console.log(
        `Downloading manual page ${name} as ${
          options.saveHTML ? "HTML, " : ""
        }PDF (docID: ${docID})`
      );
      let filename = sanitizeName(name);
      // 255 is the max filename length on most filesystems, but 200 should be enough regardless
      if (filename.length > 200) {
        filename =
          // 255 = max filename length, 18 = length of " ( truncated).html",
          // docID.length = length of docID

          // including the docID in the filename to prevent collisions as names may differ
          // at the end rather than in the first ~255 characters
          filename.slice(0, 254 - 19 - docID.length) + ` (${docID} truncated)`;

        console.log(`-> Truncating filename, learn more in the README`);
      }

      const pdfPath = join(path, `/${filename}.pdf`);
      if (options.skipExisting && existsSync(pdfPath)) {
        console.log(`-> Skipping, PDF already exists: ${pdfPath}`);
        continue;
      }
      if (options.onlyPath) {
        await mkdir(path, { recursive: true });
      }

      try {
        let pageHTML = await fetchManualPage({
          ...fetchPageParams,
          searchNumber: docID,
        });

        if (options.expandPinpoints && pageHTML.includes('class="spappt"')) {
          const spa = await inlineSharedPinpointTests(
            pageHTML,
            docID,
            fetchPageParams
          );
          pageHTML = spa.html;
          console.log(
            `-> Shared (SPA) pinpoint tests: ${spa.inlined} of ${spa.found} inlined`
          );
        }

        if (options.saveHTML) {
          const htmlPath = resolve(join(path, `/${filename}.html`));
          await writeFile(htmlPath, pageHTML);
        }

        await browserPage.setContent(pageHTML, { waitUntil: "load" });
        // removes this little color-coded thing that doesn't load properly
        // in Playwright, just says "Workshop Manual Graphics Training"...
        await browserPage.evaluate(
          'document.querySelectorAll("body > div > table > tbody > tr > td:nth-child(2)").forEach(e => e.remove())'
        );
        if (options.expandPinpoints) {
          const found = (await browserPage.evaluate(EXPAND_PINPOINTS_JS)) as {
            headers: number;
            bodies: number;
            steps: number;
            details: number;
          };
          if (found.headers > 0 || found.bodies > 0) {
            console.log(
              `-> Expanded pinpoint tests: ${found.headers} headers, ${found.bodies} bodies, ${found.steps} steps, ${found.details} details`
            );
          }
          if (found.headers > found.bodies) {
            console.warn(
              `-> WARNING: ${found.headers} pinpoint headers but only ${found.bodies} bodies in ${name} (docID ${docID}); page layout may differ. Re-run with --saveHTML to inspect.`
            );
          }
        }

        await browserPage.pdf({
          path: pdfPath,
        });
      } catch (e) {
        if (options.ignoreSaveErrors) {
          console.error(
            `Continuing to download after error with ${name} (docID ${docID}):`,
            e
          );
        } else {
          console.error(
            `Encountered an error downloading ${name} (docID ${docID})`
          );
          throw e;
        }
      }
    } else {
      // create folder and traverse
      const newPath = join(path, sanitizeName(name));

      try {
        // with --onlyPath, folders are created only when a document is saved
        if (!options.onlyPath) await mkdir(newPath, { recursive: true });
      } catch (e) {
        if ((e as any).code === "EEXIST") {
          console.log(
            `Not creating folder ${newPath} because it already exists.`
          );
        }
      }

      await saveEntireManual(
        newPath,
        docID,
        fetchPageParams,
        browserPage,
        options
      );
    }
  }
}

// export async function saveURLAsPDF(
//   htmlPath: string,
//   pdfPath: string,
//   page: Page
// ): Promise<void> {
//   await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
//   await page.pdf({
//     path: pdfPath,
//   });
// }
