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
exports.fillCookiesJar = void 0;
const createBrowser_1 = require("./createBrowser");
const tough_cookie_1 = require("tough-cookie");
const utils_1 = require("./utils");
const DEFAULT_EXPIRATION_TIME_IN_SECONDS = 3000;
function convertCookieToTough(cookie) {
    const { key, value, expires, domain, path } = cookie;
    const isExpiresValid = expires && typeof expires === 'number';
    const expiresDate = isExpiresValid
        ? new Date(expires * 1000)
        : new Date(Date.now() + DEFAULT_EXPIRATION_TIME_IN_SECONDS * 1000);
    let cleanedDomain;
    if (domain != null) {
        cleanedDomain = domain.startsWith('.') ? domain.substring(1) : domain !== null && domain !== void 0 ? domain : undefined;
    }
    return new tough_cookie_1.Cookie({
        key: key,
        value,
        expires: expiresDate,
        domain: cleanedDomain,
        path: path !== null && path !== void 0 ? path : undefined
    });
}
function fillCookiesJar(request, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const jar = options.jar;
        let url = options.url || options.uri;
        if (typeof url !== 'string') {
            url = url.toString();
        }
        let browser;
        let cookies;
        try {
            browser = yield (0, createBrowser_1.createBrowser)(options);
            const page = yield browser.newPage();
            let response = yield page.goto(url, {
                timeout: 45000,
                waitUntil: 'domcontentloaded'
            });
            let count = 1;
            let content = yield page.content();
            while ((0, utils_1.isCloudflareJSChallenge)(content)) {
                response = yield page.waitForNavigation({
                    timeout: 15000,
                    waitUntil: 'domcontentloaded'
                });
                yield new Promise((resolve) => setTimeout(resolve, 10000));
                content = yield page.content();
                if (count++ === 100) {
                    throw new Error('timeout on just a moment');
                }
            }
            try {
                content = yield page.content();
                yield page.select('#table-apps_length select', "5000");
                yield new Promise((resolve) => setTimeout(resolve, 10000));
                content = yield page.content();
                cookies = yield page.cookies();
                return {
                    status: 200,
                    statusText: "OK",
                    data: content,
                    cookies: cookies
                };
            }
            catch (err) {
                if (err.message === 'No element found for selector: #table-apps_length select') {
                    cookies = yield page.cookies();
                    return {
                        status: 200,
                        statusText: "OK",
                        data: content,
                        cookies: cookies
                    };
                }
                else {
                    console.log(err);
                    return convertError(err);
                }
            }
        }
        catch (err) {
            console.log(err);
            return convertError(err);
        }
        finally {
            if (browser)
                yield browser.close();
        }
    });
}
exports.fillCookiesJar = fillCookiesJar;
function convertError(err) {
    var _a, _b, _c;
    let errorMsg = err;
    if (typeof err !== "string") {
        errorMsg = (_c = (_b = (_a = err.message) !== null && _a !== void 0 ? _a : err.content) !== null && _b !== void 0 ? _b : err.body) !== null && _c !== void 0 ? _c : err.data;
        if (errorMsg == null) {
            errorMsg = err.toString();
        }
    }
    return {
        status: 500,
        statusText: errorMsg
    };
}
