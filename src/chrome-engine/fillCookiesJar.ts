import {CookieJar, OptionsWithUrl, Request} from "request";

import {createBrowser} from './createBrowser';
import {Cookie} from 'tough-cookie';
import {handleCaptcha} from './handleCaptcha';
import {isCloudflareJSChallenge} from './utils';
import {Options, OptionsWithUri} from "request-promise-native";
import {Url} from "url";

const DEFAULT_EXPIRATION_TIME_IN_SECONDS = 3000;

function convertCookieToTough(cookie: Cookie) {
    const {key, value, expires, domain, path} = cookie;
    const isExpiresValid = expires && typeof expires === 'number';

    const expiresDate = isExpiresValid
        ? new Date(expires * 1000)
        : new Date(Date.now() + DEFAULT_EXPIRATION_TIME_IN_SECONDS * 1000);

    let cleanedDomain;
    if( domain!=null) {
        cleanedDomain=domain.startsWith('.') ? domain.substring(1) : domain??undefined
    }
    return new Cookie({
        key: key,
        value,
        expires: expiresDate,
        domain: cleanedDomain,
        path: path??undefined
    });
}

export async function fillCookiesJar(request: Request, options:Options):Promise<{status:number, statusText:string, data?:any, cookies?:any}> {
    const jar = options.jar;
    let url = (options as OptionsWithUrl).url || (options as OptionsWithUri).uri;
    if (typeof url !== 'string') {
        url = (url as Url).toString();
    }
    let browser;

    let cookies;
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
            await page.select('#table-apps_length select', "5000");
            await new Promise((resolve) => setTimeout(resolve, 10000));
            content = await page.content();
            cookies = await page.cookies();
            return {
                status:200,
                statusText:"OK",
                data:content,
                cookies: cookies
            };
        } catch (err:any) {
            if( err.message==='No element found for selector: #table-apps_length select') {
                cookies = await page.cookies();
                return {
                    status:200,
                    statusText:"OK",
                    data:content,
                    cookies: cookies
                };
            } else {
                console.log(err);
                return convertError (err);
            }
        }

    } catch (err) {
        console.log(err);
        return convertError (err);
    } finally {
        if (browser)
            await browser.close();
    }
}

function convertError (err:any): {status:number, statusText:string} {
    let errorMsg=err;
    if( typeof err !== "string") {
        errorMsg=err.message??err.content??err.body??err.data;
        if( errorMsg==null) {
            errorMsg=err.toString();
        }
    }
    return {
        status:500,
        statusText:errorMsg
    };

}
