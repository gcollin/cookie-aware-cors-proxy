import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios";

const { isProtectedByStormwall, getStormwallCookie } = require('stormwall-bypass');
import { getUserAgent } from './utils';
import { fillCookiesJar } from './fillCookiesJar';
import { isCloudflareJSChallenge, isCloudflareCaptchaChallenge } from './utils';
import {CookieJar} from "tough-cookie";

function isCloudflareIUAMError(error: AxiosError<string>) {
  if (error.response) {
    const { data } = error.response;
    return isCloudflareJSChallenge(data) || isCloudflareCaptchaChallenge(data);
  }
  return false;
}

async function handleError(error:AxiosError<string>, jar:CookieJar):Promise<AxiosResponse> {
  if (isCloudflareIUAMError(error)) {
    if (error.config!=null) {
        let response = await fillCookiesJar(error.request, error.config, jar);
        return response;
    }
  }
  throw error;
}

async function handleResponse(response:AxiosResponse<string>, options:  AxiosRequestConfig, jar:CookieJar){
  const targetUrl = options.url;
  const body = response.data;
  if (isProtectedByStormwall(body) && (targetUrl!=null)) {
    const cookie = getStormwallCookie(body);
    jar.setCookie(cookie, targetUrl);
    response = await axios.request(options);
  }
  return response;
}

async function cloudflareScraper(options:AxiosRequestConfig<string>): Promise<AxiosResponse<any>> {
    const jar= new CookieJar();
    try {
        const response = await axios.request({...options});
        return handleResponse(response, options, jar);
    } catch (err:any) {
        if( err.options!=null) {
            let content = handleError(err, jar);
            return content;
        } else {
            return {
                status:500,
                statusText:"Error "+err,
                headers:{},
                data:undefined,
                config:options
            }
        }
    }
}

export const chromeEngine= {
    request<T = any>(config: AxiosRequestConfig<string>): Promise<AxiosResponse<T>> {
        if( config.headers==null) {
            config.headers={ 'User-Agent': getUserAgent() };
        }else {
            config.headers["User-Agent"]=getUserAgent();
        }
        config.decompress=false;
        return cloudflareScraper(config);
    }
};
