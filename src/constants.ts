// Emulated user agent string
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36";

// Emulated Sec-Ch-Ua header
export const SEC_CH_UA = '"Not/A)Brand";v="24", "Chromium";v="99"';

// Whether to use a proxy for requests
export const ENV_USE_PROXY = process.env.USE_PROXY === "true";

// Whether to launch the browser in headless mode
export const ENV_HEADLESS_BROWSER = process.env.HEADLESS_BROWSER !== "false";
