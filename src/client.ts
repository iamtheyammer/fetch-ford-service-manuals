import axios from "axios";

import { ENV_USE_PROXY, USER_AGENT } from "./constants";

const client = axios.create({
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "text/html, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.05",
    "Accept-Encoding": "gzip, deflate, br",
    Origin: "https://www.fordtechservice.dealerconnection.com",
    Connection: "keep-alive",
    Referer: "https://www.fordtechservice.dealerconnection.com/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    "Sec-GPC": "1",
  },
  proxy: ENV_USE_PROXY
    ? {
        protocol: "http",
        host: "localhost",
        port: 8888,
      }
    : false,
});

export default client;
