import axios, {AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from "axios";

import {isProtectedByStormwall, getStormwallCookie} from 'stormwall-bypass';
import { getUserAgent } from './utils';
import { runThroughChrome } from './fillCookiesJar';
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
        let response = await runThroughChrome( error.config, jar);
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
    addCookieToAxiosRequest (cookie as string, options);
    response = await axios.request(options);
  }
  return response;
}

function addCookieToAxiosRequest (cookie: string, options:AxiosRequestConfig):void {
    if (options.headers==null) {
        options.headers={ Cookie: cookie};
    }
    else if (options.headers['Cookie']==null) {
        options.headers.Cookie=cookie;
    } else {
        options.headers.Cookie = options.headers.Cookie+'; '+cookie;
    }
}

async function cloudflareScraper(options:AxiosRequestConfig<string>): Promise<AxiosResponse<any>> {
    const jar= new CookieJar();
    try {
        const response = await axios.request(options);
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
                config:options as InternalAxiosRequestConfig
            }
        }
    }
}

async function chromeScraper(options:AxiosRequestConfig<string>): Promise<AxiosResponse<any>> {
    const jar= new CookieJar();
    return runThroughChrome(options, jar);
}

export const chromeEngine= {

    request<T = any>(engine:string, config: AxiosRequestConfig<string>): Promise<AxiosResponse<T>> {
        if (engine==='cloudflare')
            return this.requestCloudFlare(config);
        else
            return this.requestChrome(config);
    },

    requestCloudFlare<T = any>(config: AxiosRequestConfig<string>): Promise<AxiosResponse<T>> {
        if( config.headers==null) {
            config.headers={ 'User-Agent': getUserAgent() };
        }else {
            config.headers["User-Agent"]=getUserAgent();
        }
        config.responseType='text';
        config.decompress=false;
        return cloudflareScraper(config);
    },

    requestChrome<T = any>(config: AxiosRequestConfig<string>): Promise<AxiosResponse<T>> {
        config.responseType='text';
        config.decompress=false;
        return chromeScraper(config);
    }
};
