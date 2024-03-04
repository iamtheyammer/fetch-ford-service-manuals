import { mkdir, writeFile, access } from "fs/promises";
import { join, resolve } from "path";
import fetchManualPage, { FetchManualPageParams } from "./fetchManualPage";
import client from "./client";
import { createWriteStream } from "fs";
import { Page } from "playwright";
import saveStream from "./saveStream";
import { type as osType } from "os";
import { CLIArgs } from "./processCLIArgs";

// NTFS and FAT have many restricted characters in filenames.
// We need to remove these here because keys in this
// tree will be used to create file and folder names.
// https://en.wikipedia.org/wiki/Filename#Comparison_of_filename_limitations

// Slashes are not included here so that the names in cover.html match the ones here.
// They are removed in saveEntireManual as files are written to disk.

// Emdashes (\u2013) are included as they are multi-byte and throw off length
// calculations where 1 character is expected to be 1 byte.
const nameRegex =
  osType() === "Windows_NT" ? /[<>:"\\/|?*\0\u2013]/g : /[\\/\0\u2013]/g;
const sanitizeName = (name: string): string => name.replace(nameRegex, "-");

export type SaveOptions = Pick<CLIArgs, "saveHTML" | "ignoreSaveErrors">;

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

    if (typeof docID === "string") {
      // download and save document
      if (docID.startsWith("http") && docID.includes(".pdf")) {
        console.log(`Downloading manual PDF ${name} ${docID}`);

        try {
          const url = new URL(docID);
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

      try {
        const pageHTML = await fetchManualPage({
          ...fetchPageParams,
          searchNumber: docID,
        });

        if (options.saveHTML) {
          const htmlPath = resolve(join(path, `/${filename}.html`));
          await writeFile(htmlPath, pageHTML);
        }

        await saveHTMLAsPDF(
          pageHTML,
          join(path, `/${filename}.pdf`),
          browserPage
        );
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

export async function saveHTMLAsPDF(
  htmlContent: string,
  pdfPath: string,
  page: Page
): Promise<void> {
  await page.setContent(htmlContent, { waitUntil: "load" });
  await page.pdf({
    path: pdfPath,
  });
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
