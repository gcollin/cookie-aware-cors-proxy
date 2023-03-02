import puppeteer from 'puppeteer-extra';
import {Browser, PuppeteerLaunchOptions} from 'puppeteer';
import {AxiosRequestConfig} from "axios";

import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from "fs";
import {BrowserFetcher} from "puppeteer-core";
import path from "path";
import * as os from "os";

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
    puppeteerOptions: {args:undefined, dumpio:false}
  };
  const ignoreHTTPSErrors = PUPPETEER_IGNORE_HTTPS_ERROR === 'true';

  if (config.browserWSEndpoint || config.browserUrl) {
    return puppeteer.connect({ browserWSEndpoint:config.browserWSEndpoint, browserURL:config.browserUrl, ignoreHTTPSErrors });
  }

  let args = []
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

    // Try to find the best executablePath
  const fetcher = new BrowserFetcher({product:'chrome',  path:path.join(os.homedir(),'.cache/puppeteer/chrome')});

  const revisions=fetcher.localRevisions().sort((a, b) => {
    return Number.parseInt(b).valueOf() - Number.parseInt(a).valueOf();
  });

  if( revisions.length==0) {
      // Prefer chrome to chromium if it exists
    if (fs.existsSync('/opt/google/chrome/chrome')) {
      puppeteerOptions.executablePath='/opt/google/chrome/chrome';
    }
  } else {
    puppeteerOptions.executablePath=fetcher.revisionInfo(revisions[0]).executablePath;
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
  puppeteerOptions.headless=true;
  puppeteerOptions.dumpio=false;

  return await puppeteer.launch(puppeteerOptions);
}


export function cleanUpStatusText (msg:string): string {
  return msg?.replace(/\n|\r/g, ' ').substring(0, Math.min(50, msg.length-1))
}
