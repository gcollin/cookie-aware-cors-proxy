import {createBrowser} from './createBrowser';
import {Cookie, CookieJar} from 'tough-cookie';
import {isCloudflareJSChallenge} from './utils';
import {Url} from "url";
import {AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from "axios";
import {Protocol} from "puppeteer";

const DEFAULT_EXPIRATION_TIME_IN_SECONDS = 3000;

function convertCookieToTough(cookie: Protocol.Network.Cookie): Cookie {
    const {name, value, expires, domain, path, secure,httpOnly, sameSite} = cookie;
   const isExpiresValid = expires && typeof expires === 'number';

    const expiresDate = isExpiresValid
        ? new Date(expires * 1000)
        : new Date(Date.now() + DEFAULT_EXPIRATION_TIME_IN_SECONDS * 1000);

 /*   let cleanedDomain;
    if( domain!=null) {
        cleanedDomain=domain.startsWith('.') ? domain.substring(1) : domain??undefined
    }*/
    return new Cookie({
        key: name,
        value,
        expires: expiresDate,
        domain: domain,
        path: path??undefined,
        secure:secure,
        sameSite:sameSite,
        httpOnly:httpOnly
    });
}

async function toCookieJar(jar: CookieJar, url: string,puppeteerCoookies: Protocol.Network.Cookie[]) {
    for (const cookie of puppeteerCoookies) {
        await jar.setCookie(convertCookieToTough(cookie),url, {});
    }
}

export async function runThroughChrome(options:AxiosRequestConfig, jar:CookieJar):Promise<AxiosResponse> {
    //const jar = options.jar;
    let url = options.url;
    if( url == null) {
        return Promise.reject("No url provided in the option.");
    }
    let browser;

    try {
        browser = await createBrowser(options);
        const page = await browser.newPage();
        let response = await page.goto(url, {
            timeout: 45000,
            waitUntil: 'domcontentloaded'
        });

        let count = 1;
        let content = await page.content();

        while (isCloudflareJSChallenge(content)) {
            response = await page.waitForNavigation({
                timeout: 15000,
                waitUntil: 'domcontentloaded'
            });
            await new Promise((resolve) => setTimeout(resolve, 10000));
            content = await page.content();
            if (count++ === 100) {
                throw new Error('timeout on just a moment');
            }
        }

        try {
            content = await page.content();
            // await new Promise((resolve) => setTimeout(resolve, 10000));
            // content = await page.content();
            const newCookies=await page.cookies();
            await toCookieJar(jar, page.url(), newCookies);
            let cookieString="";
            for (const newCookie of jar.getSetCookieStringsSync(page.url())) {
                cookieString+=newCookie + ': ';
            }

            const ret: {status:number, statusText:string, data:any, config:any, headers:any}= {
                status:200,
                statusText:"OK",
                data:content,
                config:options as InternalAxiosRequestConfig,
                headers:undefined
            };
            if (cookieString.length > 0) {
                ret.headers={
                    'Set-Cookie':cookieString
                }
            }
            return ret;
        } catch (err:any) {
            /*if( err.message==='No element found for selector: #table-apps_length select') {
                toCookieJar(jar, page.url(), await page.cookies());
                return {
                    status:200,
                    statusText:"OK",
                    data:content,
                    headers:{},
                    config:options
                };
            } else {*/
                console.log(err);
                return convertError (err, options);
            //}
        }

    } catch (err) {
        console.log(err);
        return convertError (err, options);
    } finally {
        if (browser)
            await browser.close();
    }
}

function convertError (err:any, config:AxiosRequestConfig): AxiosResponse {
    let errorMsg=err;
    if( typeof err !== "string") {
        errorMsg=err.message??err.content??err.body??err.data;
        if( errorMsg==null) {
            errorMsg=err.toString();
        }
    }
    return {
        status:500,
        statusText:errorMsg,
        data:undefined,
        headers:{},
        config:config as InternalAxiosRequestConfig
    };

}
