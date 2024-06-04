interface TransformedCookie {
  name: string;
  value: string;
  url: string;
  sameSite: "None";
}

// prohibitedCookies will be removed during parsing
const prohibitedCookies: Set<string> = new Set(["ak_bmsc"]);

// expectedCookies will be checked for existence during parsing
const expectedCookies: { [cookieName: string]: boolean } = {
  CONTENT_AUTH: false,
  CONTENT_PERMISSIONS: false,
  dtCookie: false,
  "Ford.TSO.PTSSuite": false,
  "TPS%2DPERM": false,
  PREFERENCES: false,
  "TPS%2DMEMBERSHIP": false,
  AKA_A2: false,
  bm_mi: false,
  bm_sv: false,
  PTSSession: false,
};

export default function transformCookieString(
  cookieString: string
): TransformedCookie[] {
  const pairs = cookieString
    .split(";")
    .map((c: string) => c.trim().split("=").map(decodeURIComponent))
    .reduce(function (a, b) {
      if (prohibitedCookies.has(b[0])) {
        return a;
      }

      if (expectedCookies[b[0]]) {
        expectedCookies[b[0]] = true;
      }

      a[b[0]] = b.slice(1).join("=");
      return a;
    }, {} as { [cookie: string]: string });

  const cookies = Object.entries(pairs).map(
    ([name, value]): TransformedCookie => ({
      name,
      value: value as string,
      url: "https://www.fordtechservice.dealerconnection.com",
      sameSite: "None",
    })
  );

  const contentCookies = Object.entries(pairs).map(
    ([name, value]): TransformedCookie => ({
      name,
      value: value as string,
      url: "https://www.fordservicecontent.com",
      sameSite: "None",
    })
  );

  Object.entries(expectedCookies).forEach(([name, exists]) => {
    if (!exists) {
      console.warn(
        `Expected cookie ${name} not found in cookie string. This may affect functionality.`
      );
    }
  });

  return cookies.concat(contentCookies);
}
