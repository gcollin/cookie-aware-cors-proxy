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
exports.chromeEngine = void 0;
const request = require('request-promise-native');
const { isProtectedByStormwall, getStormwallCookie } = require('stormwall-bypass');
const utils_1 = require("./utils");
const fillCookiesJar_1 = require("./fillCookiesJar");
const utils_2 = require("./utils");
function isCloudflareIUAMError(error) {
    if (error.response) {
        const { body } = error.response;
        return (0, utils_2.isCloudflareJSChallenge)(body) || (0, utils_2.isCloudflareCaptchaChallenge)(body);
    }
    return false;
}
function handleError(error) {
    return __awaiter(this, void 0, void 0, function* () {
        if (isCloudflareIUAMError(error)) {
            const { options } = error;
            let content = yield (0, fillCookiesJar_1.fillCookiesJar)(request, options);
            return content;
        }
        throw error;
    });
}
function handleResponse(response, options) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const jar = options.jar;
        const targetUrl = (_a = options.uri) !== null && _a !== void 0 ? _a : options.url;
        const body = response.body || response;
        if (isProtectedByStormwall(body)) {
            const cookie = getStormwallCookie(body);
            jar.setCookie(cookie, targetUrl);
            let response = yield request(options);
            return response.body;
        }
        return body;
    });
}
function cloudflareScraper(options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield request(Object.assign({}, options));
            return handleResponse(response, options);
        }
        catch (err) {
            if (err.options != null) {
                let content = handleError(err);
                return content;
            }
        }
    });
}
const defaultParams = {
    jar: request.jar(),
    headers: { 'User-Agent': (0, utils_1.getUserAgent)() },
    gzip: true
};
exports.chromeEngine = request.defaults(defaultParams, cloudflareScraper);
