import puppeteer from 'puppeteer-extra';
import {Browser, PuppeteerLaunchOptions} from 'puppeteer';
import {AxiosRequestConfig} from "axios";

import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const {
  PUPPETEER_HEADLESS = 'true',
  PUPPETEER_IGNORE_HTTPS_ERROR = 'false',
  HTTP_PROXY,
  HTTPS_PROXY
} = process.env;

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

export async function createBrowser(options: AxiosRequestConfig, userAgent?:string):Promise <Browser>{
  const config= {
    proxy: HTTP_PROXY || HTTPS_PROXY,
    browserWSEndpoint: undefined,
    browserUrl:undefined,
    puppeteerOptions: {args:undefined}
  };
  const ignoreHTTPSErrors = PUPPETEER_IGNORE_HTTPS_ERROR === 'true';

  if (config.browserWSEndpoint || config.browserUrl) {
    return puppeteer.connect({ browserWSEndpoint:config.browserWSEndpoint, browserURL:config.browserUrl, ignoreHTTPSErrors });
  }

  let args = ['--no-sandbox', '--disable-setuid-sandbox']
  if (userAgent!=null) {
    args.push('--user-agent=' + userAgent);
  }
  if(config.puppeteerOptions.args) {
    args = args.concat(config.puppeteerOptions.args)
  }
/*  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }*/

//  const execPath=puppeteer.executablePath();
  let puppeteerOptions:PuppeteerLaunchOptions = {
    headless: PUPPETEER_HEADLESS === 'false',
    ignoreHTTPSErrors,
    defaultViewport: undefined,
    channel: 'chrome',
    executablePath: '/usr/lib/chromium/chromium',
    ...config.puppeteerOptions,
    args
  };

  /*if (chromium) {
    puppeteerOptions = {
      ...puppeteerOptions,
      args: chromium.args.concat(args),
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    };
  }*/
  puppeteerOptions.headless=true;

  return await puppeteer.launch(puppeteerOptions);
}

