import {addExtra} from 'puppeteer-extra';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import {getUserAgent} from './utils';
import {Browser} from "puppeteer";
import {Options} from "request-promise-native";

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

export async function createBrowser(options: any):Promise <Browser>{
  const {
    proxy = HTTP_PROXY || HTTPS_PROXY,
    browserWSEndpoint,
    browserUrl,
    puppeteerOptions: userPuppeteerOptions = {}
  } = options;
  const ignoreHTTPSErrors = PUPPETEER_IGNORE_HTTPS_ERROR === 'true';

  if (browserWSEndpoint || browserUrl) {
    return puppeteer.connect({ browserWSEndpoint, browserURL:browserUrl, ignoreHTTPSErrors });
  }

  let args = ['--no-sandbox', '--disable-setuid-sandbox', '--user-agent=' + getUserAgent()];
  if(userPuppeteerOptions.args) {
    args = args.concat(userPuppeteerOptions.args)
  }
  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }

  let puppeteerOptions = {
    headless: PUPPETEER_HEADLESS === 'false',
    ignoreHTTPSErrors,
    ...userPuppeteerOptions,
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

