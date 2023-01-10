import {addExtra} from 'puppeteer-extra';
import {getUserAgent} from './utils';
import {Browser} from "puppeteer";
import {AxiosRequestConfig} from "axios";

const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const {
  PUPPETEER_HEADLESS = 'true',
  PUPPETEER_IGNORE_HTTPS_ERROR = 'false',
  HTTP_PROXY,
  HTTPS_PROXY
} = process.env;

let chromium:any;
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
}

const puppeteer = addExtra(puppeteerCore);
const stealth = StealthPlugin();
puppeteer.use(stealth);

export async function createBrowser(options: AxiosRequestConfig):Promise <Browser>{
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

  let args = ['--no-sandbox', '--disable-setuid-sandbox', '--user-agent=' + getUserAgent()];
  if(config.puppeteerOptions.args) {
    args = args.concat(config.puppeteerOptions.args)
  }
/*  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }*/

  let puppeteerOptions = {
    headless: PUPPETEER_HEADLESS === 'false',
    ignoreHTTPSErrors,
    defaultViewport: undefined,
    executablePath: undefined,
    ...config.puppeteerOptions,
    args
  };

  if (chromium) {
    puppeteerOptions = {
      ...puppeteerOptions,
      args: chromium.args.concat(args),
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    };
  }
  puppeteerOptions.headless=true;

  return await puppeteer.launch(puppeteerOptions);
}

