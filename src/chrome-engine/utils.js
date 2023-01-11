"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCloudflareCaptchaChallenge = exports.isCloudflareJSChallenge = exports.extract = exports.getUserAgent = void 0;
const USER_AGENT_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
const USER_AGENT_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
const USER_AGENT_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
function getUserAgent() {
    const { platform } = process;
    if (platform === 'darwin') {
        return USER_AGENT_MAC;
    }
    if (platform === 'win32') {
        return USER_AGENT_WINDOWS;
    }
    return USER_AGENT_LINUX;
}
exports.getUserAgent = getUserAgent;
function extract(src, regexp, errorMessage) {
    const match = src.match(regexp);
    if (match) {
        return match[1];
    }
    if (errorMessage != null)
        throw new Error(errorMessage);
}
exports.extract = extract;
function isCloudflareJSChallenge(body) {
    return body.includes('Checking your browser before accessing') || body.includes('managed_checking_msg') || body.includes('Just a moment...') || body.includes('Please stand by');
}
exports.isCloudflareJSChallenge = isCloudflareJSChallenge;
function isCloudflareCaptchaChallenge(body) {
    return body.includes('cf_captcha_kind');
}
exports.isCloudflareCaptchaChallenge = isCloudflareCaptchaChallenge;
