import axios, {AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from "axios";

import {cleanUpStatusText} from "./createBrowser";
import {getStormwallCookie, isProtectedByStormwall} from 'stormwall-bypass';
import {getUserAgent, isCloudflareCaptchaChallenge, isCloudflareJSChallenge} from './utils';
import {runThroughChrome} from './fillCookiesJar';
import {CookieJar} from "tough-cookie";

function isCloudflareIUAMError(error: AxiosError<string>) {
  if (error.response) {
    const { data } = error.response;
    return isCloudflareJSChallenge(data) || isCloudflareCaptchaChallenge(data);
  }
  return false;
}

async function handleError(error:AxiosError<string>, bypassSandbox:boolean, jar:CookieJar, browserExec?:string):Promise<AxiosResponse> {
  if (isCloudflareIUAMError(error)) {
    if (error.config!=null) {
        let response = await runThroughChrome( error.config, bypassSandbox, browserExec, getUserAgent());
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
    jar.setCookieSync(cookie, targetUrl);
    if (options.headers==null)  options.headers={};
    options.headers.Cookie=jar.getCookieStringSync(targetUrl);
    //addCookieToAxiosRequest (cookie as string, options);
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

async function cloudflareScraper(options:AxiosRequestConfig<string>, bypassSandbox:boolean, browserExec?:string): Promise<AxiosResponse<any>> {
    const jar= new CookieJar();
    try {
        const response = await axios.request(options);
        return handleResponse(response, options, jar);
    } catch (err:any) {
        if( err.options!=null) {
            let content = handleError(err, bypassSandbox, jar, browserExec);
            return content;
        } else {
            return {
                status:500,
                statusText:cleanUpStatusText("Error "+err),
                headers:{},
                data:undefined,
                config:options as InternalAxiosRequestConfig
            }
        }
    }
}

async function chromeScraper(options:AxiosRequestConfig<string>, bypassSandbox:boolean, browserExec?:string): Promise<AxiosResponse<any>> {
    const jar= new CookieJar();
    return runThroughChrome(options, bypassSandbox, browserExec);
}

export const chromeEngine= {

    request<T = any>(engine:string, config: AxiosRequestConfig<string>, bypassSandbox:boolean, browserExec?:string): Promise<AxiosResponse<T>> {
        if (engine==='cloudflare')
            return this.requestCloudFlare(config, bypassSandbox, browserExec);
        else
            return this.requestChrome(config, bypassSandbox, browserExec);
    },

    requestCloudFlare<T = any>(config: AxiosRequestConfig<string>, bypassSandbox:boolean, browserExec?:string): Promise<AxiosResponse<T>> {
        if( config.headers==null) {
            config.headers={ 'User-Agent': getUserAgent() };
        }else {
            config.headers["User-Agent"]=getUserAgent();
        }
        config.responseType='text';
        config.decompress=false;
        return cloudflareScraper(config, bypassSandbox, browserExec);
    },

    requestChrome<T = any>(config: AxiosRequestConfig<string>, bypassSandbox:boolean, browserExec?:string): Promise<AxiosResponse<T>> {
        config.responseType='text';
        config.decompress=false;
        return chromeScraper(config, bypassSandbox, browserExec);
    }
};
