import {CookieJar, CoreOptions, Options, RequestResponse, RequiredUriUrl, UriOptions, UrlOptions} from "request";

const request = require('request-promise-native');
const { isProtectedByStormwall, getStormwallCookie } = require('stormwall-bypass');
import { getUserAgent } from './utils';
import { fillCookiesJar } from './fillCookiesJar';
import { isCloudflareJSChallenge, isCloudflareCaptchaChallenge } from './utils';
import {RequestError} from "request-promise-native/errors";
import {RequestPromiseOptions} from "request-promise-native";

function isCloudflareIUAMError(error: RequestError) {
  if (error.response) {
    const { body } = error.response;
    return isCloudflareJSChallenge(body) || isCloudflareCaptchaChallenge(body);
  }
  return false;
}

async function handleError(error:RequestError):Promise<{status:number, statusText:string, data?:any, cookies?:any}> {
  if (isCloudflareIUAMError(error)) {
    const { options } = error;
    let content = await fillCookiesJar(request, options);
    return content;
  }
  throw error;
}

async function handleResponse(response:RequestResponse, options:  RequiredUriUrl & RequestPromiseOptions){
  const jar = options.jar as CookieJar;
  const targetUrl = (options as UriOptions).uri??(options as UrlOptions).url;
  const body = response.body || response;
  if (isProtectedByStormwall(body)) {
    const cookie = getStormwallCookie(body);
    jar.setCookie(cookie, targetUrl);
    let response = await request(options);
    return response.body;
  }
  return body;
}

async function cloudflareScraper(options:RequiredUriUrl & RequestPromiseOptions) {
    try {
        const response = await request({...options});
        return handleResponse(response, options);
    } catch (err:any) {
        if( err.options!=null) {
            let content = handleError(err);
            return content;
        }
    }
}

const defaultParams = {
  jar: request.jar(),
  headers: { 'User-Agent': getUserAgent() },
  gzip: true
};

export const chromeEngine = request.defaults(defaultParams, cloudflareScraper);
