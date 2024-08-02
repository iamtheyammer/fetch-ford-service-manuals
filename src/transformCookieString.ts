interface TransformedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  sameSite: "None";
  secure: boolean;
}

// prohibitedCookies will be removed during parsing
const prohibitedCookies: Set<string> = new Set(["ak_bmsc"]);

// expectedCookies will be checked for existence during parsing
const expectedCookies: [string | RegExp, boolean][] = [
  ["AKA_A2", false],
  ["bm_mi", false],
  ["bm_sv", false],
  ["dtCookie", false],
  ["Ford.TSO.PTSSuite", false],
  [/^OpenIdConnect\.nonce\.[A-z0-9%]+$/, false],
  ["PREFERENCES", false],
  ["TPS%2DMEMBERSHIP", false],
  ["TPS%2DPERM", false],
];

// Cookie domain constants, prevents typos
const FORDSERVICECONTENT_COM = ".fordservicecontent.com";
const DEALERCONNECTION_COM = ".dealerconnection.com";

export default function transformCookieString(cookieString: string): {
  transformedCookies: TransformedCookie[];
  processedCookieString: string;
} {
  const cookiePairs = cookieString
    .split(";")
    .map((c: string) => c.trim().split("="));

  const cookiesFordServiceContent: TransformedCookie[] = [];
  const cookiesDealerConnection: TransformedCookie[] = [];

  cookiePairs.forEach((pair) => {
    if (!pair || pair.length < 2) {
      return;
    }

    const name = pair[0];
    const value = pair.slice(1).join("=");

    if (!name || !value) {
      return;
    }

    // Skip prohibited cookies
    if (prohibitedCookies.has(name)) {
      return;
    }

    // Mark expected cookies as found
    for (let i in expectedCookies) {
      const [cookieName, exists] = expectedCookies[i];
      if (exists) {
        continue;
      }

      if (
        (typeof cookieName === "string" && cookieName === name) ||
        (cookieName instanceof RegExp && cookieName.test(name))
      ) {
        expectedCookies[i][1] = true;
        break;
      }
    }

    // Store cookie
    const cookie: TransformedCookie = {
      name,
      value,
      domain: DEALERCONNECTION_COM,
      path: "/",
      sameSite: "None",
      secure: true,
    };

    // One for each domain
    cookiesDealerConnection.push(cookie);
    cookiesFordServiceContent.push({
      ...cookie,
      domain: FORDSERVICECONTENT_COM,
    });
  });

  expectedCookies.forEach(([name, exists]) => {
    if (!exists) {
      const nameStr = name instanceof RegExp ? name.source : name;
      console.warn(
        `Expected cookie ${nameStr} not found in cookie string. This may affect functionality.`
      );
    }
  });

  const cookies = cookiesFordServiceContent.concat(cookiesDealerConnection);

  return {
    transformedCookies: cookies,
    processedCookieString: cookiesFordServiceContent
      .map((c) => `${c.name}=${c.value}`)
      .join("; "),
  };
}
