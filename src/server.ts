import express, { NextFunction, Request, Response} from 'express';
import axios, {AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from "axios";
import {Stream} from "stream";
import {chromeEngine} from './chrome-engine/chromeEngine';
import {Cookie} from "tough-cookie";
import { argv } from 'process';
import * as http from "http";
import {transformCookie} from "./chrome-engine/fillCookiesJar";

const PORT=process.env.CACP_PORT||3000;
const REDIRECT_PATH=process.env.CACP_REDIRECT_PATH||'/proxy';
const REDIRECT_HOST=process.env.CACP_REDIRECT_HOST;
const DEBUG_MODE=process.env.CACP_DEBUG==='TRUE';
const LOG_MODE=process.env.CACP_LOG==='TRUE';
const NGINX_PATH=process.env.CACP_NGINX_PATH||'/proxy';
const BYPASS_CHROME_SANDBOX=process.env.CACP_BYPASS_SANDBOX=='TRUE';

export const app = express();
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

export function extractDomain(url: string): string {

    let domain= url.substring(url.indexOf('//')+2, url.indexOf('/', url.indexOf('//')+2));
    if (domain.indexOf(':')!=-1)
        domain = domain.substring(0, domain.indexOf(':'));
    return domain;
}

function modifyCookieField(cookieText: string, fieldKey: string, fieldValue?: string): string {
    if( fieldValue==null) {
        // we remove the field
        const startDomainField = cookieText.indexOf(fieldKey);
        if( startDomainField!=-1) {
            let tempCookie = cookieText.substring(0, startDomainField);
            const endField=cookieText.indexOf(';', startDomainField + fieldKey.length + 1);
            if (endField!=-1) {
                tempCookie = tempCookie + cookieText.substring( endField + 1);
            }
            return tempCookie;
        } else {
            return cookieText;
        }
    }
    else {
        // We replace the value or add the field
        const startDomainField = cookieText.indexOf(fieldKey);
        if (startDomainField != -1) {
            // We replace the value
            let tempCookie = cookieText.substring(0, startDomainField + fieldKey.length);
            if (fieldValue!='')
                tempCookie = tempCookie + '=' + fieldValue;
            const endField = cookieText.indexOf(';', startDomainField + fieldKey.length);
            if (endField!=-1) {
                tempCookie = tempCookie+ cookieText.substring(endField);
            }
            return tempCookie;
        } else {
            // We add the field at the end of the cookie
            cookieText = cookieText + '; ' + fieldKey;
            if( fieldValue!='')
                cookieText= cookieText+ '=' + fieldValue;
            return cookieText;
        }
    }
}

/*function toRequestConfig(config: AxiosRequestConfig<any>): CoreOptions {
    const ret:CoreOptions={};
    ret.method=config.method;
    ret.headers=config.headers;
    ret.body=config.data;
    ret.followRedirect=false;
    return ret;
}*/

app.all(NGINX_PATH+'/**', async (req: Request, res: Response, next) => {
    return handleProxyRequest(req, res, next);
});

function remapUrl(url: string|null, redirectUrl: string, path: string, targetUrlOrigin: string, pathFromUrl:boolean): string {
    if (url!=null) {
        let urlParam="";
        if (url.startsWith('http')) {
            // Absolute url
            urlParam=url;
        } else if( url.startsWith('/')){
            // Url with root path
            urlParam = targetUrlOrigin+url;
        } else {
            // Url with relative path
            urlParam = path+(path.endsWith('/'))?"":"/"+url;
        }
        if (pathFromUrl==false) {
            return redirectUrl+urlParam;
        } else {
            return redirectUrl+'?url='+encodeURIComponent(urlParam);
        }
    }
    throw new Error ("Cannot remap a null url");
}

export async function handleProxyRequest (req: Request, res: Response, next: NextFunction): Promise<void> {
    let debugMode=false;
    let logMode=false;
    let redirectUrl = REDIRECT_HOST;
    let pathFromUrl = false;
    if( redirectUrl==null) {
        redirectUrl=req.protocol+'://'+req.get('host');
    }

    redirectUrl=redirectUrl+REDIRECT_PATH;
    if (!redirectUrl.endsWith('/'))
        redirectUrl=redirectUrl+'/';

    // Makes log for the same request easy to find
    const logId=(new Date()).getTime().toString(36) + Math.random().toString(36).slice(2)+': ';

    //console.log(req.path);
    try {
        // Set CORS headers: allow all origins, methods, and headers: you may want to lock this down in a production environment
        res.header("Access-Control-Allow-Origin", req.header('origin'));
        res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
        res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));
        res.header("Access-Control-Allow-Credentials","true");

        let path=req.originalUrl;

        // Dynamically enable / disable log (=just url of calls are logged) or debug mode (full log)
        debugMode=DEBUG_MODE;
        if( path.startsWith(NGINX_PATH))
            path = path.substring(NGINX_PATH.length);
            // Support for debug mode just by appending /debug in the proxy url
        if( path.startsWith('/debug')) {
            path = path.substring('/debug'.length);
            redirectUrl=redirectUrl+'debug/'
            debugMode=true;
        } else if (req.header('CACP_DEBUG')=='TRUE') {
            debugMode=true;
        }

        // Support for log mode just by appending /debug in the proxy url
        logMode=LOG_MODE;
        if( path.startsWith('/log')) {
            path = path.substring('/log'.length);
            redirectUrl=redirectUrl+'log/'
            logMode=true;
        } else if (req.header('CACP_LOG')=="TRUE") {
            logMode=true;
        }

            // Immediatly return yes on cors requests
        if( req.method.toLowerCase()=='options') {
            // If it's a CORS request, just answer yes to anything
            if (logMode) {
                console.log(logId + "CORS request received and allowed for " + req.method + ':' + req.url);
            }
            if (debugMode) {
                console.log(logId+"Sending CORS request response  ",convertForLog(res));
            }
            res.status(200).send();
            return;
        }


        // Generate the Axios config to call the server
        const config:AxiosRequestConfig<any> = {};

            // Is the target path sent as a parameter ?
        if( req.query['url']!=null) {
            path = decodeURIComponent(req.query['url'] as string);
            pathFromUrl=true;
            if (debugMode) {
                console.log('Using path from url parameter: ', path);
            }
        }

        // Find the url of the server to call
        if( path.startsWith('/'))
            path=path.substring(1);
        if (path == '') {
            res.sendFile('./pages/index.html', {root:__dirname});
            return;
        } else if( !path.startsWith('http')) {
            console.warn("Ignoring relative url path "+path);
            if (debugMode)
                console.debug('Ignoring relative url path '+path+' for request', req);
            res.sendStatus(404).send();
            return;
        }

        // Sometimes proxy mess up the url
        const protocolIndex=path.indexOf(':/');
        if (path.charAt(protocolIndex+2)!='/') {
            path=path.substring(0,protocolIndex+1)+'/'+path.substring(protocolIndex+1);
        }

        const targetUrl = new URL(path);

        config.url=path;
        config.method=req.method;
        config.headers={};
            // We send back the redirects to the client
        config.maxRedirects=0;

            // Any http error from the server will be sent back to the client
        config.validateStatus= function (status) {
            return true;
        }

        config.responseType='stream';
        config.decompress=false;

            // We copy the headers from the client to the server
            // except for host that needs to be the server's host (and not the proxy's host)
        for (const headerKey in req.headers) {
            if( headerKey.toLowerCase()=='host') {
                //config.headers[headerKey]=targetUrl.host;
                delete config.headers[headerKey];
                if (debugMode) {
                    console.log(logId+"Removing Host header");
                }

            } else if( headerKey.toLowerCase()=='origin') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to '+targetUrl.origin);
                }
                config.headers[headerKey]=targetUrl.origin;
                // Ignore them
            } else if(headerKey.toLowerCase()=='referer') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to '+targetUrl.origin+'/');
                }
                config.headers[headerKey]=targetUrl.origin+'/';
                // Ignore them
            } /*else if( headerKey.toLowerCase()=='sec-fetch-mode') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to navigate');
                }
                config.headers[headerKey]='navigate';
            }*/ else if( headerKey.toLowerCase()=='sec-fetch-site') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to same-site');
                }
                config.headers[headerKey]='same-site';
            } /*else if( headerKey.toLowerCase()=='sec-fetch-dest') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to document');
                }
                config.headers[headerKey]='document';
            }*/ else if( headerKey.toLowerCase()=='connection') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to keep-alive');
                }
                config.headers[headerKey]='keep-alive';
            }  else {
                config.headers[headerKey]=req.headers[headerKey];
            }

//            config.headers['Referrer-Policy']='strict-origin-when-cross-origin';
            //console.log("Header:"+headerKey);
        }

        if( req.method.toLowerCase()!='get')
            config.data=req.body;

        if( debugMode)
            console.log(logId+"Sending request: ", config);
        if( logMode)
            console.log(logId+"Sending request: "+config.method+':'+config.url);

        let response:AxiosResponse|null=null;

        if ((req.query['engine']!=null) && (req.query['engine'] as string).toLowerCase()!=='standard') {
            const engine=(req.query['engine'] as string).toLowerCase();
            if( engine==='chrome' || engine==='cloudflare') {
                const chromeResult = await chromeEngine.request(engine, config, BYPASS_CHROME_SANDBOX);
                if (chromeResult!=null) {
                    response = chromeResult;
                } else {
                    response={
                        status:500,
                        statusText:"Error ",
                        data:undefined,
                        headers:{},
                        config:config as InternalAxiosRequestConfig
                    }
                }
            } else {
                res.status(400).statusMessage='Engine type '+req.query['engine'] as string +' is not supported';
                if( debugMode)
                    console.log(logId+"Unknown engine type received "+req.query['engine'] as string, config);
                if( logMode)
                    console.log(logId+"Unknown engine type received "+req.query['engine'] as string);
                res.send();
                return;
            }
        } else {
            response = await axios.request<any, AxiosResponse<Stream>>(config);
        }

        if( response==null) {
            res.status(500).statusMessage="No Response...";
            res.send();
            return;
        }

        const responseStatus = response.status;
        const responseBody= response.data;
        if( debugMode)
            console.log(logId+"Received response: ", convertForLog(response));
        if( logMode)
            console.log(logId+"Received response: ", responseStatus);
        for (const headerKey in response.headers) {
            if( headerKey.toLowerCase()=='set-cookie') {  // We have special handling for cookies
                const newCookies = new Array<string>();
                // Change some values of the cookies to make it work with the browser across the proxy
                for (let cookieText of response.headers[headerKey]!) {
                    const originalText=cookieText;
                    cookieText = transformCookie (originalText);
                    if (debugMode)
                        console.log (logId+"Replaced cookie "+originalText+" to "+cookieText);
                    newCookies.push(cookieText);
                }
                res.header(headerKey, newCookies);
            } else
                res.header(headerKey,response.headers[headerKey]);
        }

        res.status(responseStatus);
        res.statusMessage=response.statusText;
            // Handle the locations of the redirect
        if (responseStatus>=300 && responseStatus< 400) {
            const rootLocation=response.headers['location'];
            res.header("location",remapUrl (rootLocation, redirectUrl, path, targetUrl.origin, pathFromUrl));
            if (debugMode)
                console.log (logId+"Replaced Redirect location "+rootLocation+" to "+res.getHeader('location'));

        }
        if (debugMode)
            console.log(logId+"Sending response: ", convertForLog(res));
        if (logMode)
            console.log(logId+"Sending response: ", res.statusCode);

        if (responseBody!=null) {
            if (responseBody.pipe!=null) {
                // Is it s stream ?
                responseBody.pipe(res).on('finish', () => {
                    next();
                }).on('error', (err: any)=> {
                    if (debugMode)
                        console.log(logId+"Error sending response: ", err);
                    if (logMode)
                        console.log(logId+"Error sending response: ", err.toString());
                    next(err);
                });
            } else {
                res.send(responseBody);
            }
        } else {
            res.send();
        }

    } catch (error) {
        try {
        if (axios.isAxiosError(error)) {
            handleAxiosError(res,error, logId);
        } else {
            handleUnexpectedError(res, error, logId);
        }
        } catch (errorInError) {
            // Even error handling crashes, just send error 500
            res.sendStatus(500);
        }
    }

}

function handleAxiosError(res: Response, error: AxiosError<any, any>, logId:string='') {
    console.error(logId+"Received Error", convertForLog(error));
    if( error.response) {
        res.status(error.response.status).send(error);
    } else {
        res.status(500).send(error);
    }
}

function handleUnexpectedError(res: Response, error: unknown,logId:string='') {
    console.error(logId+"Received Unknown Error", error );
    res.status(500).send(error);
}

function convertForLog (item:AxiosError<any,any> | AxiosResponse | Response ): any {
    const ret:any={};
    if( item instanceof AxiosError) {
        const axiosError = item as AxiosError;
        if( axiosError.response!=null) {
            return convertForLog(axiosError.response);
        } else {
            ret.status=500;
            ret.message='No responses received.';
            if( axiosError.config!=null) {
                ret.url=axiosError.config.url;
                ret.method=axiosError.config.method;
                ret.headers=axiosError.config.headers;

            }
        }
    } else if (((item as any).config==null) &&
            ((item as any).toJSON==null)) {
            // It's an express response
        const expressResponse = item as Response;
        ret.status=expressResponse.statusCode;
        ret.message=expressResponse.statusMessage;
        if (expressResponse.req!=null) {
            ret.url=expressResponse.req.url;
            ret.method=expressResponse.req.method;
            ret.headers=expressResponse.req.headers;
        }
    } else  {
        const axiosResponse = item as AxiosResponse;
        ret.status=axiosResponse.status;
        ret.message=axiosResponse.statusText;
        if (axiosResponse.config!=null) {
            ret.url=axiosResponse.config.url;
            ret.method=axiosResponse.config.method;
            ret.headers=axiosResponse.config.headers;
        }
        if( axiosResponse.data==null) {
            ret.bodyType='Empty body';
        } else if (axiosResponse.data.pipe != null) {
            ret.bodyType='Body is a stream';
        } else {
            ret.bodyType='Body is string data';
            try {
                const bodyText = axiosResponse.data.toString();
                ret.bodyLength=bodyText.length;
            } catch (error) {
                ret.bodyType='Body is unknown data';
            }
        }
    }
    return ret;
}

let proxyServer:http.Server|null=null;

export function getProxyServer (): http.Server {
    if( proxyServer!=null)
        return proxyServer
    else throw new Error("No proxy Server created");
}

if( argv[2]==='testChrome') {

    let url = 'https://dont-code.net';
    if( argv[3] != null) {
        url = argv[3];
    }
    chromeEngine.request('chrome', {url:url, method:'get'}, BYPASS_CHROME_SANDBOX).then(value => {
       console.log('Response received with status: '+value.status);
       console.log(value.data);
       if( value.status==200) {
           console.log('Succesfully called external website.');
           process.exit(0);
       }
       else {
           console.error('Error '+value.status+' calling external website.');
           process.exit(1);
       }
    }).catch(reason => {
        console.error('Error calling external website:', reason);
        process.exit(-1);
    });

} else {
    proxyServer=app.listen(PORT, () => {
        console.log('Application started on port '+PORT+ ' with redirection "'+(REDIRECT_HOST?REDIRECT_HOST+REDIRECT_PATH:'proxy')+'".');
    });
}
