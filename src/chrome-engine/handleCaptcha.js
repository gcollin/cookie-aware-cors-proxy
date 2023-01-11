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
exports.handleCaptcha = void 0;
const utils_1 = require("./utils");
const solvehCaptcha = require('hcaptcha-solver');
const SITE_KEY_REGEXP = /sitekey="([^"]+)/;
const CHALLENGE_FORM_ACTION_REGEXP = /id="challenge-form" action="([^"]+)/;
const CHALLENGE_FORM_REGEXP = /<form class="challenge-form[^>]*>([\s\S]*?)<\/form>/;
const INPUT_REGEXP = /<\s*input(.*?)[^>]*>/gm;
const NAME_REGEXP = /name="([^"]*)/;
const ID_REGEXP = /id="([^"]*)/;
const VALUE_REGEXP = /value="([^"]*)/;
function extractChallengeData(content) {
    const challengeForm = (0, utils_1.extract)(content, CHALLENGE_FORM_REGEXP, "could'nt find challenge form");
    let match;
    const postData = {};
    const inputRegexp = new RegExp(INPUT_REGEXP);
    while ((match = inputRegexp.exec(challengeForm)) !== null) {
        const input = match[0];
        let idOrName = (0, utils_1.extract)(input, ID_REGEXP);
        if (!idOrName) {
            idOrName = (0, utils_1.extract)(input, NAME_REGEXP);
        }
        if (idOrName) {
            const value = (0, utils_1.extract)(input, VALUE_REGEXP) || '';
            postData[idOrName] = encodeURIComponent(value);
        }
    }
    return postData;
}
function handleCaptcha(content, request, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let { uri, url, solveCaptcha } = options;
        url = url || uri;
        const siteKey = (0, utils_1.extract)(content, SITE_KEY_REGEXP, "could't find the site key");
        const challengeFormAction = (0, utils_1.extract)(content, CHALLENGE_FORM_ACTION_REGEXP, "could't find the challenge form action");
        const postData = extractChallengeData(content);
        const captchaResponse = solveCaptcha
            ? yield solveCaptcha(siteKey, url, content)
            : yield solvehCaptcha(url);
        if (captchaResponse) {
            postData['g-captcha-response'] = captchaResponse;
            postData['h-captcha-response'] = captchaResponse;
            const { href } = new URL(challengeFormAction, url);
            yield request(Object.assign(Object.assign({}, options), { method: 'POST', simple: false, uri: href.replace('&amp;', '&'), headers: Object.assign(Object.assign({}, options.headers), { 'content-type': 'application/x-www-form-urlencoded' }), form: postData }));
        }
        else {
            throw new Error("solveCaptcha didn't returned a captcha");
        }
    });
}
exports.handleCaptcha = handleCaptcha;
module.exports = handleCaptcha;
