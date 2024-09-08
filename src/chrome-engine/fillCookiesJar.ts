import { createBrowser, cleanUpStatusText } from "./createBrowser";
import { Cookie } from "tough-cookie";
import { isCloudflareJSChallenge } from "./utils";
import {
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { Protocol } from "puppeteer";

const DEFAULT_EXPIRATION_TIME_IN_SECONDS = 3000;

function convertCookieToTough(cookie: Protocol.Network.Cookie): Cookie {
  const { name, value, expires, domain, path, secure, httpOnly, sameSite } =
    cookie;
  const isExpiresValid = expires && typeof expires === "number";

  const expiresDate = isExpiresValid
    ? new Date(expires * 1000)
    : new Date(Date.now() + DEFAULT_EXPIRATION_TIME_IN_SECONDS * 1000);

  /*   let cleanedDomain;
    if( domain!=null) {
        cleanedDomain=domain.startsWith('.') ? domain.substring(1) : domain??undefined
    }*/
  return new Cookie({
    key: name,
    value,
    expires: expiresDate,
    domain: domain,
    path: path ?? undefined,
    secure: secure,
    sameSite: sameSite,
    httpOnly: httpOnly,
  });
}

function cookieAsString(foundCookie: Protocol.Network.Cookie) {
  const ret = new Cookie({
    key: foundCookie.name,
    value: foundCookie.value,
    path: foundCookie.path,
    secure: foundCookie.secure,
    sameSite: foundCookie.sameSite,
    httpOnly: foundCookie.httpOnly,
    domain: foundCookie.domain,
  });
  if (foundCookie.expires != null && foundCookie.expires != -1)
    ret.expires = new Date(foundCookie.expires);
  else ret.expires = "Infinity";
  return ret.toString();
}

export function transformCookie(originalText: string): string {
  const cookie = Cookie.parse(originalText);
  if (cookie == null) {
    return originalText; // If the cookie cannot be parsed, just send it
  }

  cookie.domain = null; // Remove all the domain stuff
  cookie.sameSite = "None"; // Ensure the browser will send the cookie all the time
  cookie.secure = false; // Force non secure cookies
  cookie.path = "/"; // Remove the path argument
  return cookie.toString();
}

export async function runThroughChrome(
  options: AxiosRequestConfig,
  bypassSandbox: boolean,
  browserExec?:string,
  userAgent?: string
): Promise<AxiosResponse> {
  //const jar = options.jar;
  let url = options.url;
  if (url == null) {
    return Promise.reject("No url provided in the option.");
  }
  let browser;

  try {
    browser = await createBrowser(options, bypassSandbox, browserExec, userAgent);
    const page = await browser.newPage();
    let response = await page.goto(url, {
      timeout: 45000,
      waitUntil: "domcontentloaded",
    });

    let count = 1;
    let content = await page.content();

    while (isCloudflareJSChallenge(content)) {
      response = await page.waitForNavigation({
        timeout: 15000,
        waitUntil: "domcontentloaded",
      });
      await new Promise((resolve) => setTimeout(resolve, 10000));
      content = await page.content();
      if (count++ === 100) {
        throw new Error("timeout on just a moment");
      }
    }

    try {
      //            content = await page.content();
      // await new Promise((resolve) => setTimeout(resolve, 10000));
      // content = await page.content();
      // Retrieve all the cookies, not just the ones accessible through javascript
      let newCookies: Protocol.Network.Cookie[] = [];
      const client = await page.target().createCDPSession();
      try {
        newCookies = (await client.send("Network.getAllCookies")).cookies;
      } finally {
        await client.detach();
      }

      const cookiesString = [];
      for (const foundCookie of newCookies) {
        cookiesString.push(cookieAsString(foundCookie));
      }

      const ret: {
        status: number;
        statusText: string;
        data: any;
        config: any;
        headers: any;
      } = {
        status: 200,
        statusText: "OK",
        data: content,
        config: options as InternalAxiosRequestConfig,
        headers: undefined,
      };
      if (cookiesString.length > 0) {
        ret.headers = {
          "Set-Cookie": cookiesString,
        };
      }
      return ret;
    } catch (err: any) {
      /*if( err.message==='No element found for selector: #table-apps_length select') {
                toCookieJar(jar, page.url(), await page.cookies());
                return {
                    status:200,
                    statusText:"OK",
                    data:content,
                    headers:{},
                    config:options
                };
            } else {*/
      console.log(err);
      return convertError(err, options);
      //}
    }
  } catch (err) {
    console.log(err);
    return convertError(err, options);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing the Chrome Bowser:", error);
      }
    }
  }
}

function convertError(err: any, config: AxiosRequestConfig): AxiosResponse {
  let errorMsg = err;
  if (typeof err !== "string") {
    errorMsg = err.message ?? err.content ?? err.body ?? err.data;
    if (errorMsg == null) {
      errorMsg = err.toString();
    }
  }

  // Ensure status text is valid
  return {
    status: 500,
    statusText: cleanUpStatusText(errorMsg),
    data: errorMsg,
    headers: {},
    config: config as InternalAxiosRequestConfig,
  };
}
