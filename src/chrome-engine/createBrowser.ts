import puppeteer from "puppeteer-extra";
import { Browser, PuppeteerLaunchOptions } from "puppeteer";
import { AxiosRequestConfig } from "axios";

import StealthPlugin from "puppeteer-extra-plugin-stealth";

const { PUPPETEER_HEADLESS = "true", HTTP_PROXY, HTTPS_PROXY } = process.env;

/*let chromium:any;
let puppeteerCore;
try {
  puppeteerCore = require('puppeteer');
} catch (e) {}

if (!puppeteerCore) {
  try {
    chromium = require('chrome-aws-lambda');
    puppeteerCore = chromium.puppeteer;
  } catch (e) {
    console.log(e);
    throw new Error(
      'Missing puppeteer dependency (yarn add puppeteer or yarn add puppeteer-core chrome-aws-lambda)'
    );
  }
}*/

puppeteer.use(StealthPlugin());

export async function createBrowser(
  options: AxiosRequestConfig,
  bypassSandbox: boolean,
  browserExec?:string,
  userAgent?: string
): Promise<Browser> {
  const config = {
    proxy: HTTP_PROXY || HTTPS_PROXY,
    browserWSEndpoint: undefined,
    browserUrl: undefined,
    puppeteerOptions: { args: undefined, dumpio: false },
  };

  if (config.browserWSEndpoint || config.browserUrl) {
    return puppeteer.connect({
      browserWSEndpoint: config.browserWSEndpoint,
      browserURL: config.browserUrl,
    });
  }

  let args = [];
  if (bypassSandbox) {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  if (userAgent != null) {
    args.push("--user-agent=" + userAgent);
  }
  if (config.puppeteerOptions.args) {
    args = args.concat(config.puppeteerOptions.args);
  }
  /*  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }*/

  //  const execPath=puppeteer.executablePath();
  const puppeteerOptions: PuppeteerLaunchOptions = {
    headless: PUPPETEER_HEADLESS === "false",
    defaultViewport: undefined,
    browser:'chrome',
    channel: 'chrome',
    ...config.puppeteerOptions,
    args,
  };

  if ((browserExec!=null) && (browserExec.length>0)) {
    puppeteerOptions.executablePath=browserExec;
  }
  // console.debug("Using Chromium/Chrome from :", puppeteerOptions.executablePath);

  /*if (chromium) {
    puppeteerOptions = {
      ...puppeteerOptions,
      args: chromium.args.concat(args),
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    };
  }*/
  puppeteerOptions.headless = true;
  puppeteerOptions.dumpio = false;

  return await puppeteer.launch(puppeteerOptions);
}

export function cleanUpStatusText(msg: string): string {
  return msg?.replace(/\n|\r/g, " ").substring(0, Math.min(50, msg.length - 1));
}
