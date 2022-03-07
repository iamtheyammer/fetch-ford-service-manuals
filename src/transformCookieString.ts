interface TransformedCookie {
  name: string;
  value: string;
  url: string;
  sameSite: "None";
}

export default function transformCookieString(
  cookieString: string
): TransformedCookie[] {
  const pairs = cookieString
    .split(";")
    .map(function (c) {
      return c.trim().split("=").map(decodeURIComponent);
    })
    .reduce(function (a, b) {
      try {
        a[b[0]] = JSON.parse(b[1]);
      } catch (e) {
        a[b[0]] = b[1];
      }
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

  return cookies.concat(contentCookies);
}
