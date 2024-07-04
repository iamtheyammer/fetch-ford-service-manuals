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
const expectedCookies: { [cookieName: string]: boolean } = {
  CONTENT_AUTH: false,
  CONTENT_PERMISSIONS: false,
  dtCookie: false,
  "Ford.TSO.PTSSuite": false,
  PREFERENCES: false,
  AKA_A2: false,
  bm_mi: false,
  bm_sv: false,
  "TPS%2DMEMBERSHIP": false,
  "TPS%2DPERM": false,
};

// Cookie domain constants, prevents typos
const WWW_FORDTECHSERVICE_DEALERCONNECTION_COM =
  ".www.fordtechservice.dealerconnection.com";
const FORDTECHSERVICE_DEALERCONNECTION_COM =
  ".fordtechservice.dealerconnection.com";
const FORDSERVICECONTENT_COM = ".fordservicecontent.com";
const DEALERCONNECTION_COM = ".dealerconnection.com";

const cookieDomains: { [cookieName: string]: string[] } = {
  AKA_A2: [FORDTECHSERVICE_DEALERCONNECTION_COM, FORDSERVICECONTENT_COM],
  CONTENT_AUTH: [FORDSERVICECONTENT_COM],
  CONTENT_PERMISSIONS: [FORDSERVICECONTENT_COM],
  FeaturesAttributes: [FORDTECHSERVICE_DEALERCONNECTION_COM],
  "Ford.TSO.PTSSuite": [WWW_FORDTECHSERVICE_DEALERCONNECTION_COM],
  PERSISTENT: [FORDTECHSERVICE_DEALERCONNECTION_COM],
  PREFERENCES: [FORDTECHSERVICE_DEALERCONNECTION_COM],
  PTSSession: [WWW_FORDTECHSERVICE_DEALERCONNECTION_COM],
  "TPS%2DMEMBERSHIP": [FORDTECHSERVICE_DEALERCONNECTION_COM],
  "TPS%2DPERM": [FORDTECHSERVICE_DEALERCONNECTION_COM],
  bm_mi: [FORDTECHSERVICE_DEALERCONNECTION_COM, FORDSERVICECONTENT_COM],
  bm_sv: [FORDTECHSERVICE_DEALERCONNECTION_COM],
  dtCookie: [DEALERCONNECTION_COM, FORDSERVICECONTENT_COM],
};

export default function transformCookieString(cookieString: string): {
  transformedCookies: TransformedCookie[];
  processedCookieString: string;
} {
  const pairs = cookieString
    .split(";")
    .map((c: string) => c.trim().split("="))
    .reduce((acc, curr) => {
      // Skip prohibited cookies
      if (prohibitedCookies.has(curr[0])) {
        return acc;
      }

      if (!curr || curr.length < 2) {
        return acc;
      }

      // Mark expected cookies as found
      if (expectedCookies[curr[0]] === false) {
        expectedCookies[curr[0]] = true;
      }

      // Store cookie
      acc[curr[0]] = curr.slice(1).join("=");
      return acc;
    }, {} as { [cookie: string]: string });

  const cookies = Object.entries(pairs).map(
    ([name, value]): TransformedCookie => ({
      name,
      value: value as string,
      domain: FORDTECHSERVICE_DEALERCONNECTION_COM,
      path: "/",
      sameSite: "None",
      secure: true,
    })
  );

  const domainedCookies: TransformedCookie[] = [];

  for (const cookie of cookies) {
    if (cookieDomains[cookie.name]) {
      cookieDomains[cookie.name].forEach((domain) => {
        domainedCookies.push({
          ...cookie,
          domain,
          // path: "/"
        });
      });
    } else {
      domainedCookies.push({
        ...cookie,
        domain: FORDSERVICECONTENT_COM,
        // path: "/"
      });
      domainedCookies.push({
        ...cookie,
        domain: DEALERCONNECTION_COM,
        // path: "/"
      });
    }
  }

  Object.entries(expectedCookies).forEach(([name, exists]) => {
    if (!exists) {
      console.warn(
        `Expected cookie ${name} not found in cookie string. This may affect functionality.`
      );
    }
  });

  return {
    transformedCookies: domainedCookies,
    processedCookieString: cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; "),
  };
}
