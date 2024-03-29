import client from "../client";
import { JSDOM } from "jsdom";
import { sanitizeName } from "../saveEntireManual";

export default async function fetchPre2003AlphabeticalIndex(
  url: string,
  cookieString: string
): Promise<{
  documentList: Pre2003AlphabeticalIndex;
  pageHTML: string;
  modifiedHTML: string;
}> {
  const req = await client({
    method: "GET",
    headers: {
      Cookie: cookieString,
    },
    url,
  });

  const { docList, modifiedHTML } = processPre2003AlphabeticalIndex(req.data);

  return {
    documentList: docList,
    pageHTML: req.data,
    modifiedHTML,
  };
}

export interface Pre2003Document {
  href: string;
  title: string;
}

export type Pre2003AlphabeticalIndex = Pre2003Document[];

function processPre2003AlphabeticalIndex(data: string): {
  docList: Pre2003AlphabeticalIndex;
  modifiedHTML: string;
} {
  const dom = new JSDOM(data);
  const document = dom.window.document;

  // the list starts at this hr element
  const hrList = document.getElementsByTagName("hr");

  if (!hrList.length) {
    throw new Error(
      "Couldn't find hr element in alphabetical index, is this the right page?"
    );
  }

  const documentList: Pre2003AlphabeticalIndex = [];

  let parentElement = hrList[0].nextElementSibling as HTMLDivElement;

  function processDiv(div: HTMLDivElement) {
    for (let i = 0; i < div.children.length; i++) {
      const child = div.children[i];

      // None of the divs in the alphabetical index are closed.
      // Therefore, JSDOM parses them as continuously nested divs.
      if (child.tagName === "DIV") {
        processDiv(child as HTMLDivElement);
        break;
      }

      if (child.tagName !== "P") {
        continue;
      }

      if (child.children.length === 0 || child.children[0].tagName !== "A") {
        continue;
      }

      const aChild = child.firstChild as HTMLAnchorElement;

      // remove sub-ToC links
      if (aChild.target === "_parent") {
        continue;
      }

      const sanitizedTitle = sanitizeName(aChild.textContent!.trim());

      documentList.push({
        href: aChild.href,
        title: sanitizedTitle,
      });

      aChild.href = sanitizedTitle + ".pdf";
    }
  }

  processDiv(parentElement);

  return {
    docList: documentList,
    modifiedHTML: document.documentElement.outerHTML,
  };
}
