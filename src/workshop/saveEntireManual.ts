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
  | "saveHTML"
  | "ignoreSaveErrors"
  | "expandInteractive"
  | "followDiagnosticLinks"
>;

interface DiagnosticLink {
  id: string;
  title?: string;
}

// Extract diagnostic/pinpoint test link docIDs from HTML
function extractDiagnosticLinks(html: string): DiagnosticLink[] {
  const links: DiagnosticLink[] = [];
  const seenIds = new Set<string>();

  // Pattern 1: Links with searchNumber parameter
  // Example: <a href="?searchNumber=G1234567">Pinpoint Test N</a>
  const searchNumberPattern = /searchNumber[=:]([A-Z0-9]+)/gi;
  let match;
  while ((match = searchNumberPattern.exec(html)) !== null) {
    const docId = match[1];
    if (!seenIds.has(docId)) {
      seenIds.add(docId);

      // Try to find the title from nearby text
      const contextStart = Math.max(0, match.index - 200);
      const contextEnd = Math.min(html.length, match.index + 200);
      const context = html.substring(contextStart, contextEnd);

      // Look for "Pinpoint Test" or similar patterns
      const titleMatch = context.match(
        /(?:Pinpoint Test|GO to|Test|Procedure)\s+([A-Z0-9\s\-:]+)/i
      );
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      links.push({
        id: docId,
        title: title ? `Pinpoint Test ${title}` : undefined,
      });
    }
  }

  // Pattern 2: Links in onclick handlers
  // Example: onclick="showDiagnostic('G1234567')"
  const onclickPattern = /onclick=["'].*?['"]G([0-9]{7})["']/gi;
  while ((match = onclickPattern.exec(html)) !== null) {
    const docId = `G${match[1]}`;
    if (!seenIds.has(docId)) {
      seenIds.add(docId);
      links.push({ id: docId });
    }
  }

  // Pattern 3: Direct docID references in diagnostic context
  // Only match G-prefixed docIDs that appear in diagnostic-related text
  const diagnosticContextPattern =
    /(pinpoint|test|diagnostic|procedure|dtc).*?(G[0-9]{7})/gi;
  while ((match = diagnosticContextPattern.exec(html)) !== null) {
    const docId = match[2];
    if (!seenIds.has(docId)) {
      seenIds.add(docId);
      links.push({ id: docId });
    }
  }

  return links;
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
      const pdfAlreadyExists = existsSync(pdfPath);

      // Check if we need to scan for diagnostic links even if PDF exists
      const shouldScanForLinks =
        options.followDiagnosticLinks &&
        (path.includes("Diagnosis") || path.includes("Testing"));

      // Skip if PDF exists and we don't need to scan for links
      if (pdfAlreadyExists && !shouldScanForLinks) {
        console.log(
          `Skipping manual page ${name} (already exists) (docID: ${docID})`
        );
        continue;
      }

      if (pdfAlreadyExists && shouldScanForLinks) {
        console.log(
          `Skipping PDF for ${name} (already exists), but scanning for linked diagnostics (docID: ${docID})`
        );
      } else {
        console.log(
          `Downloading manual page ${name} as ${
            options.saveHTML ? "HTML, " : ""
          }PDF (docID: ${docID})`
        );
      }

      try {
        const pageHTML = await fetchManualPage({
          ...fetchPageParams,
          searchNumber: docID,
        });

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

        // Expand interactive elements if requested
        if (options.expandInteractive) {
          try {
            console.log(
              `-> Expanding interactive elements for ${name} (docID: ${docID})`
            );

            // Expand all pinpoint test sections and hidden content
            await browserPage.evaluate(() => {
              // 1. Expand all pinpoint test sections (main collapsed sections)
              // These are the collapsible sections with class "isipppt"
              const pinpointHeaders = document.querySelectorAll('.isipppt');
              console.log(`Found ${pinpointHeaders.length} pinpoint test headers`);
              pinpointHeaders.forEach((header) => {
                try {
                  (header as HTMLElement).click();
                } catch (e) {
                  console.error('Error clicking pinpoint header:', e);
                }
              });

              // 2. Force display all pinpoint test content divs
              // Pattern: <div id="PPTA" style="display:none"> where A-Z
              const pinpointDivs = document.querySelectorAll('div[id^="PPT"]');
              console.log(`Found ${pinpointDivs.length} pinpoint test content divs`);
              pinpointDivs.forEach((div) => {
                (div as HTMLElement).style.display = 'block';
              });

              // 3. Show all hidden pinpoint test steps
              // Pattern: <tr data-content-type="step" style="display:none;">
              const stepRows = document.querySelectorAll('tr[data-content-type="step"]');
              console.log(`Found ${stepRows.length} pinpoint test step rows`);
              stepRows.forEach((row) => {
                (row as HTMLElement).style.display = '';
              });

              // 4. Expand "Click for details" links and show their hidden content
              const clickForDetailsLinks = document.querySelectorAll('a[data-pptlinktype="clickfordetails"]');
              console.log(`Found ${clickForDetailsLinks.length} click-for-details links`);
              clickForDetailsLinks.forEach((link) => {
                try {
                  // Hide the link
                  (link as HTMLElement).style.display = 'none';
                  // Show the next sibling span which contains the hidden text
                  const nextSpan = link.nextElementSibling;
                  if (nextSpan && nextSpan.tagName === 'SPAN') {
                    (nextSpan as HTMLElement).style.display = 'inline';
                  }
                } catch (e) {
                  console.error('Error expanding click-for-details:', e);
                }
              });

              // 5. Click other expandable elements (generic catch-all)
              const selectors = [
                'a[href*="details"]',
                'a[onclick*="show"]',
                'a[onclick*="expand"]',
                'a[onclick*="display"]',
                ".expandable",
                '[onclick*="Details"]',
                '[onclick*="Show"]',
              ];

              selectors.forEach((selector) => {
                document.querySelectorAll(selector).forEach((el) => {
                  try {
                    if (!(el as HTMLElement).closest('[data-pptlinktype="clickfordetails"]')) {
                      (el as HTMLElement).click();
                    }
                  } catch (e) {
                    // Ignore click errors
                  }
                });
              });
            });

            // Wait for potential AJAX requests and animations
            await browserPage.waitForTimeout(3000);

            // Try to wait for network to be idle (with short timeout)
            try {
              await browserPage.waitForLoadState("networkidle", {
                timeout: 5000,
              });
            } catch (e) {
              // Ignore timeout, continue anyway
            }
          } catch (e) {
            console.error(
              `-> Warning: Error expanding interactive elements: ${e}`
            );
            // Continue to PDF generation even if expansion fails
          }
        }

        // Only generate PDF if it doesn't already exist
        if (!pdfAlreadyExists) {
          await browserPage.pdf({
            path: pdfPath,
          });
        }

        // Follow diagnostic links if requested and we're in a diagnostic section
        if (
          options.followDiagnosticLinks &&
          (path.includes("Diagnosis") || path.includes("Testing"))
        ) {
          try {
            console.log(
              `-> Scanning for linked diagnostic procedures in ${name}`
            );

            // Extract diagnostic link docIDs from the HTML
            const linkedDocIDs = extractDiagnosticLinks(pageHTML);

            if (linkedDocIDs.length > 0) {
              console.log(
                `-> Found ${linkedDocIDs.length} linked diagnostic procedures`
              );

              // Download each linked diagnostic page
              for (const linkedDocID of linkedDocIDs) {
                const linkedFilename = sanitizeName(
                  `${linkedDocID.title || linkedDocID.id}`
                );
                const linkedPdfPath = join(path, `/${linkedFilename}.pdf`);

                // Check if already exists (resume capability)
                if (existsSync(linkedPdfPath)) {
                  console.log(
                    `-> Skipping linked diagnostic ${
                      linkedDocID.title || linkedDocID.id
                    } (already exists)`
                  );
                  continue;
                }

                console.log(
                  `-> Downloading linked diagnostic: ${
                    linkedDocID.title || linkedDocID.id
                  }`
                );

                try {
                  const linkedPageHTML = await fetchManualPage({
                    ...fetchPageParams,
                    searchNumber: linkedDocID.id,
                  });

                  if (options.saveHTML) {
                    const linkedHtmlPath = resolve(
                      join(path, `/${linkedFilename}.html`)
                    );
                    await writeFile(linkedHtmlPath, linkedPageHTML);
                  }

                  await browserPage.setContent(linkedPageHTML, {
                    waitUntil: "load",
                  });
                  await browserPage.evaluate(
                    'document.querySelectorAll("body > div > table > tbody > tr > td:nth-child(2)").forEach(e => e.remove())'
                  );

                  await browserPage.pdf({
                    path: linkedPdfPath,
                  });
                } catch (linkError) {
                  console.error(
                    `-> Error downloading linked diagnostic ${linkedDocID.id}:`,
                    linkError
                  );
                  if (!options.ignoreSaveErrors) {
                    throw linkError;
                  }
                }
              }
            }
          } catch (e) {
            console.error(`-> Warning: Error following diagnostic links: ${e}`);
            if (!options.ignoreSaveErrors) {
              throw e;
            }
          }
        }
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
        await mkdir(newPath, { recursive: true });
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
