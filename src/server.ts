import express, {Request, Response} from 'express';
import axios, {AxiosError, AxiosRequestConfig, AxiosResponse} from "axios";
import {Stream} from "stream";
import {CoreOptions, RequestResponse} from "request";
import {chromeEngine} from './chrome-engine/chromeEngine';

const PORT=process.env.CACP_PORT||3000;
const PROXY_PATH=process.env.CACP_PROXY_PATH||'/proxy';
const REDIRECT_HOST=process.env.CACP_REDIRECT_HOST;
const DEBUG_MODE=process.env.CACP_DEBUG==='TRUE';
const LOG_MODE=process.env.CACP_LOG==='TRUE';

const app = express();
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

function extractDomain(url: string): string {

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

function toRequestConfig(config: AxiosRequestConfig<any>): CoreOptions {
    const ret:CoreOptions={};
    ret.method=config.method;
    ret.headers=config.headers;
    ret.body=config.data;
    ret.followRedirect=false;
    return ret;
}

app.all('/proxy/**', async (req: Request, res: Response, next) => {
    let debugMode=false;
    let logMode=false;
    let redirectUrl = REDIRECT_HOST;
    if( redirectUrl==null) {
        redirectUrl=req.protocol+'://'+req.get('host');
    }

    redirectUrl=redirectUrl+PROXY_PATH;
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
        if( path.startsWith(PROXY_PATH))
            path = path.substring(PROXY_PATH.length);
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
                config.headers[headerKey]=targetUrl.host;
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
            } else if( headerKey.toLowerCase()=='sec-fetch-site') {
                if (debugMode) {
                    console.log(logId+"Changing "+headerKey+' from '+req.headers[headerKey]+' to same-site');
                }
                config.headers[headerKey]='same-site';
            } else if( headerKey.toLowerCase()=='sec-fetch-dest') {
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

        let response:AxiosResponse|RequestResponse|null=null;

        if (req.query['engine']!=null) {
            if( (req.query['engine'] as string).toLowerCase()==='chrome') {
                const reqConfig = toRequestConfig (config);
                const chromeResult = await chromeEngine(config.url, reqConfig);
                if (chromeResult!=null) {
                    response = {
                        status:chromeResult.status,
                        statusText: chromeResult.statusText,
                        data:chromeResult.data,
                        headers:{},
                        config:config
                    }
                } else {
                    response={
                        status:500,
                        statusText:"Error ",
                        data:undefined,
                        headers:{},
                        config:config
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

        const responseStatus = (response as any).status??(response as any).statusCode;
        const responseBody= (response as any).body??(response as any).data;
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
                    let domainKey = null;
                    let sameSiteKey = null;
                    let secureKey= null;
                    const fields = cookieText.split(';');
                    let ignoreFirst=true;
                    for (let field of fields) {
                        if( ignoreFirst) {
                            ignoreFirst=false;
                            continue;
                        }
                        field = field.trim();
                        if( field.toLowerCase().startsWith('domain')) {
                            domainKey=field.substring(0, 'domain'.length);
                        } else if (field.toLowerCase().startsWith('samesite')) {
                            sameSiteKey=field.substring(0, 'samesite'.length);
                        } else if (field.toLowerCase().startsWith('secure')) {
                            secureKey=field.substring(0, 'secure'.length);
                        }
                    }

                    if (domainKey!=null) {
                        cookieText=modifyCookieField (cookieText, domainKey);
//                        const newDomain=extractDomain (redirectUrl);
                    }
                    cookieText= modifyCookieField(cookieText, sameSiteKey??'SameSite', 'None' );
                    cookieText= modifyCookieField(cookieText, secureKey??'Secure', '' );
                    if (debugMode)
                        console.log (logId+"Replaced cookie "+originalText+" to "+cookieText);
                    newCookies.push(cookieText);
                }
                res.header(headerKey, newCookies);
            } else
                res.header(headerKey,response.headers[headerKey]);
        }

        res.status(responseStatus);
        res.statusMessage=(response as any).statusText??(response as any).statusMessage;
            // Handle the locations of the redirect
        if (responseStatus>=300 && responseStatus< 400) {
            const rootLocation=response.headers['location'];
            if (rootLocation!=null) {
                if (rootLocation.startsWith('http')) {
                    res.header("location", redirectUrl+rootLocation);
                } else if( rootLocation.startsWith('/')){
                    res.header("location", redirectUrl+targetUrl.origin+rootLocation)
                } else {
                    res.header('location',redirectUrl+path+(path.endsWith('/'))?"":"/"+rootLocation);
                }
                if (debugMode)
                    console.log (logId+"Replaced Redirect location "+rootLocation+" to "+res.getHeader('location'));
            }
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
                    next(err);
                });
            } else {
                res.send(responseBody);
            }
        } else {
            res.send();
        }

    } catch (error) {
        if (axios.isAxiosError(error)) {
            handleAxiosError(res,error, logId);
        } else {
            handleUnexpectedError(res, error, logId);
        }
    }

});

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

function convertForLog (item:AxiosError<any,any> | AxiosResponse | Response | RequestResponse): any {
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
    } else if ((item as any).toJSON!=null) {
        // It's a RequestResponse
        const requestResponse = item as RequestResponse;
        ret.status=requestResponse.statusCode;
        ret.message=requestResponse.statusMessage;
        if (requestResponse.request!=null) {
            ret.url=requestResponse.request.uri;
            ret.method=requestResponse.request.method;
            ret.headers=requestResponse.request.headers;
        }
    }else {
        const axiosResponse = item as AxiosResponse;
        ret.status=axiosResponse.status;
        ret.message=axiosResponse.statusText;
        if (axiosResponse.config!=null) {
            ret.url=axiosResponse.config.url;
            ret.method=axiosResponse.config.method;
            ret.headers=axiosResponse.config.headers;
        }
    }
    return ret;
}


app.listen(PORT, () => {
    console.log('Application started on port '+PORT+ ' with redirection "'+(REDIRECT_HOST?REDIRECT_HOST+PROXY_PATH:'proxy')+'".');
});

