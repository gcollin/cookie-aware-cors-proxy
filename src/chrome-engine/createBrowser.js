"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrowser = void 0;
const puppeteer_extra_1 = require("puppeteer-extra");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const utils_1 = require("./utils");
const { PUPPETEER_HEADLESS = 'true', PUPPETEER_IGNORE_HTTPS_ERROR = 'false', HTTP_PROXY, HTTPS_PROXY } = process.env;
let chromium;
let puppeteerCore;
try {
    puppeteerCore = require('puppeteer');
}
catch (e) { }
if (!puppeteerCore) {
    try {
        chromium = require('chrome-aws-lambda');
        puppeteerCore = chromium.puppeteer;
    }
    catch (e) {
        console.log(e);
        throw new Error('Missing puppeteer dependency (yarn add puppeteer or yarn add puppeteer-core chrome-aws-lambda)');
    }
}
const puppeteer = (0, puppeteer_extra_1.addExtra)(puppeteerCore);
const stealth = StealthPlugin();
puppeteer.use(stealth);
function createBrowser(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { proxy = HTTP_PROXY || HTTPS_PROXY, browserWSEndpoint, browserUrl, puppeteerOptions: userPuppeteerOptions = {} } = options;
        const ignoreHTTPSErrors = PUPPETEER_IGNORE_HTTPS_ERROR === 'true';
        if (browserWSEndpoint || browserUrl) {
            return puppeteer.connect({ browserWSEndpoint, browserURL: browserUrl, ignoreHTTPSErrors });
        }
        let args = ['--no-sandbox', '--disable-setuid-sandbox', '--user-agent=' + (0, utils_1.getUserAgent)()];
        if (userPuppeteerOptions.args) {
            args = args.concat(userPuppeteerOptions.args);
        }
        if (proxy) {
            args.push(`--proxy-server=${proxy}`);
        }
        let puppeteerOptions = Object.assign(Object.assign({ headless: PUPPETEER_HEADLESS === 'false', ignoreHTTPSErrors }, userPuppeteerOptions), { args });
        if (chromium) {
            puppeteerOptions = Object.assign(Object.assign({}, puppeteerOptions), { args: chromium.args.concat(args), defaultViewport: chromium.defaultViewport, executablePath: yield chromium.executablePath, headless: chromium.headless });
        }
        puppeteerOptions.headless = true;
        return yield puppeteer.launch(puppeteerOptions);
    });
}
exports.createBrowser = createBrowser;
