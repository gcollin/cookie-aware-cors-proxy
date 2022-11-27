"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importStar(require("axios"));
const chrome_engine_1 = __importDefault(require("chrome-engine"));
const PORT = process.env.CACP_PORT || 3000;
const PROXY_PATH = process.env.CACP_PROXY_PATH || '/proxy';
const REDIRECT_HOST = process.env.CACP_REDIRECT_HOST;
const DEBUG_MODE = process.env.CACP_DEBUG === 'TRUE';
const LOG_MODE = process.env.CACP_LOG === 'TRUE';
const app = (0, express_1.default)();
app.use(express_1.default.json()); // for parsing application/json
app.use(express_1.default.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
function extractDomain(url) {
    let domain = url.substring(url.indexOf('//') + 2, url.indexOf('/', url.indexOf('//') + 2));
    if (domain.indexOf(':') != -1)
        domain = domain.substring(0, domain.indexOf(':'));
    return domain;
}
function modifyCookieField(cookieText, fieldKey, fieldValue) {
    if (fieldValue == null) {
        // we remove the field
        const startDomainField = cookieText.indexOf(fieldKey);
        if (startDomainField != -1) {
            let tempCookie = cookieText.substring(0, startDomainField);
            const endField = cookieText.indexOf(';', startDomainField + fieldKey.length + 1);
            if (endField != -1) {
                tempCookie = tempCookie + cookieText.substring(endField + 1);
            }
            return tempCookie;
        }
        else {
            return cookieText;
        }
    }
    else {
        // We replace the value or add the field
        const startDomainField = cookieText.indexOf(fieldKey);
        if (startDomainField != -1) {
            // We replace the value
            let tempCookie = cookieText.substring(0, startDomainField + fieldKey.length);
            if (fieldValue != '')
                tempCookie = tempCookie + '=' + fieldValue;
            const endField = cookieText.indexOf(';', startDomainField + fieldKey.length);
            if (endField != -1) {
                tempCookie = tempCookie + cookieText.substring(endField);
            }
            return tempCookie;
        }
        else {
            // We add the field at the end of the cookie
            cookieText = cookieText + '; ' + fieldKey;
            if (fieldValue != '')
                cookieText = cookieText + '=' + fieldValue;
            return cookieText;
        }
    }
}
function toRequestConfig(config) {
    const ret = {};
    ret.method = config.method;
    ret.headers = config.headers;
    ret.body = config.data;
    return ret;
}
app.all(PROXY_PATH + '/**', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    let debugMode = false;
    let logMode = false;
    let redirectUrl = REDIRECT_HOST;
    if (redirectUrl == null) {
        redirectUrl = req.protocol + '://' + req.get('host');
    }
    redirectUrl = redirectUrl + PROXY_PATH;
    if (!redirectUrl.endsWith('/'))
        redirectUrl = redirectUrl + '/';
    // Makes log for the same request easy to find
    const logId = (new Date()).getTime().toString(36) + Math.random().toString(36).slice(2) + ': ';
    //console.log(req.path);
    try {
        // Set CORS headers: allow all origins, methods, and headers: you may want to lock this down in a production environment
        res.header("Access-Control-Allow-Origin", req.header('origin'));
        res.header("Access-Control-Allow-Methods", "GET, PUT, PATCH, POST, DELETE");
        res.header("Access-Control-Allow-Headers", req.header('access-control-request-headers'));
        res.header("Access-Control-Allow-Credentials", "true");
        let path = req.originalUrl;
        // Dynamically enable / disable log (=just url of calls are logged) or debug mode (full log)
        debugMode = DEBUG_MODE;
        if (path.startsWith(PROXY_PATH))
            path = path.substring(PROXY_PATH.length);
        // Support for debug mode just by appending /debug in the proxy url
        if (path.startsWith('/debug')) {
            path = path.substring('/debug'.length);
            redirectUrl = redirectUrl + 'debug/';
            debugMode = true;
        }
        else if (req.header('CACP_DEBUG') == 'TRUE') {
            debugMode = true;
        }
        // Support for log mode just by appending /debug in the proxy url
        logMode = LOG_MODE;
        if (path.startsWith('/log')) {
            path = path.substring('/log'.length);
            redirectUrl = redirectUrl + 'log/';
            logMode = true;
        }
        else if (req.header('CACP_LOG') == "TRUE") {
            logMode = true;
        }
        // Immediatly return yes on cors requests
        if (req.method.toLowerCase() == 'options') {
            // If it's a CORS request, just answer yes to anything
            if (logMode) {
                console.log(logId + "CORS request received and allowed for " + req.method + ':' + req.url);
            }
            if (debugMode) {
                console.log(logId + "Sending CORS request response  ", convertForLog(res));
            }
            res.status(200).send();
            return;
        }
        // Generate the Axios config to call the server
        const config = {};
        // Is the target path sent as a parameter ?
        if (req.query['url'] != null) {
            path = decodeURIComponent(req.query['url']);
            if (debugMode) {
                console.log('Using path from url parameter: ', path);
            }
        }
        // Find the url of the server to call
        if (path.startsWith('/'))
            path = path.substring(1);
        if (!path.startsWith('http')) {
            console.warn("Ignoring relative url path " + path);
            if (debugMode)
                console.debug('Ignoring relative url path ' + path + ' for request', req);
            res.sendStatus(404).send();
            return;
        }
        // Sometimes proxy mess up the url
        const protocolIndex = path.indexOf(':/');
        if (path.charAt(protocolIndex + 2) != '/') {
            path = path.substring(0, protocolIndex + 1) + '/' + path.substring(protocolIndex + 1);
        }
        const targetUrl = new URL(path);
        config.url = path;
        config.method = req.method;
        config.headers = {};
        // We send back the redirects to the client
        config.maxRedirects = 0;
        // Any http error from the server will be sent back to the client
        config.validateStatus = function (status) {
            return true;
        };
        config.responseType = 'stream';
        // We copy the headers from the client to the server
        // except for host that needs to be the server's host (and not the proxy's host)
        for (const headerKey in req.headers) {
            if (headerKey.toLowerCase() == 'host') {
                config.headers[headerKey] = targetUrl.host;
            }
            else if (headerKey.toLowerCase() == 'origin') {
                if (debugMode) {
                    console.log(logId + "Changing " + headerKey + ' from ' + req.headers[headerKey] + ' to ' + targetUrl.origin);
                }
                config.headers[headerKey] = targetUrl.origin;
                // Ignore them
            }
            else if (headerKey.toLowerCase() == 'referer') {
                if (debugMode) {
                    console.log(logId + "Changing " + headerKey + ' from ' + req.headers[headerKey] + ' to ' + targetUrl.origin + '/');
                }
                config.headers[headerKey] = targetUrl.origin + '/';
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
            }*/
            else if (headerKey.toLowerCase() == 'connection') {
                if (debugMode) {
                    console.log(logId + "Changing " + headerKey + ' from ' + req.headers[headerKey] + ' to keep-alive');
                }
                config.headers[headerKey] = 'keep-alive';
            }
            else {
                config.headers[headerKey] = req.headers[headerKey];
            }
            //            config.headers['Referrer-Policy']='strict-origin-when-cross-origin';
            //console.log("Header:"+headerKey);
        }
        if (req.method.toLowerCase() != 'get')
            config.data = req.body;
        if (debugMode)
            console.log(logId + "Sending request: ", config);
        if (logMode)
            console.log(logId + "Sending request: " + config.method + ':' + config.url);
        let response = null;
        if (req.query['engine'] != null) {
            if (req.query['engine'].toLowerCase() === 'chrome') {
                const reqConfig = toRequestConfig(config);
                response = yield (0, chrome_engine_1.default)(config.url, reqConfig);
            }
            else {
                res.status(400).statusMessage = 'Engine type ' + req.query['engine'] + ' is not supported';
                if (debugMode)
                    console.log(logId + "Unknown engine type received " + req.query['engine'], config);
                if (logMode)
                    console.log(logId + "Unknown engine type received " + req.query['engine']);
                res.send();
                return;
            }
        }
        else {
            response = yield axios_1.default.request(config);
        }
        if (response == null) {
            res.status(500).statusMessage = "No Response...";
            res.send();
            return;
        }
        const responseStatus = (_a = response.status) !== null && _a !== void 0 ? _a : response.statusCode;
        if (debugMode)
            console.log(logId + "Received response: ", convertForLog(response));
        if (logMode)
            console.log(logId + "Received response: ", responseStatus);
        for (const headerKey in response.headers) {
            if (headerKey.toLowerCase() == 'set-cookie') { // We have special handling for cookies
                const newCookies = new Array();
                // Change some values of the cookies to make it work with the browser across the proxy
                for (let cookieText of response.headers[headerKey]) {
                    const originalText = cookieText;
                    let domainKey = null;
                    let sameSiteKey = null;
                    let secureKey = null;
                    const fields = cookieText.split(';');
                    let ignoreFirst = true;
                    for (let field of fields) {
                        if (ignoreFirst) {
                            ignoreFirst = false;
                            continue;
                        }
                        field = field.trim();
                        if (field.toLowerCase().startsWith('domain')) {
                            domainKey = field.substring(0, 'domain'.length);
                        }
                        else if (field.toLowerCase().startsWith('samesite')) {
                            sameSiteKey = field.substring(0, 'samesite'.length);
                        }
                        else if (field.toLowerCase().startsWith('secure')) {
                            secureKey = field.substring(0, 'secure'.length);
                        }
                    }
                    if (domainKey != null) {
                        cookieText = modifyCookieField(cookieText, domainKey);
                        //                        const newDomain=extractDomain (redirectUrl);
                    }
                    cookieText = modifyCookieField(cookieText, sameSiteKey !== null && sameSiteKey !== void 0 ? sameSiteKey : 'SameSite', 'None');
                    cookieText = modifyCookieField(cookieText, secureKey !== null && secureKey !== void 0 ? secureKey : 'Secure', '');
                    if (debugMode)
                        console.log(logId + "Replaced cookie " + originalText + " to " + cookieText);
                    newCookies.push(cookieText);
                }
                res.header(headerKey, newCookies);
            }
            else
                res.header(headerKey, response.headers[headerKey]);
        }
        res.status(responseStatus);
        res.statusMessage = (_b = response.statusText) !== null && _b !== void 0 ? _b : response.statusMessage;
        // Handle the locations of the redirect
        if (responseStatus >= 300 && responseStatus < 400) {
            const rootLocation = response.headers['location'];
            if (rootLocation != null) {
                if (rootLocation.startsWith('http')) {
                    res.header("location", redirectUrl + rootLocation);
                }
                else if (rootLocation.startsWith('/')) {
                    res.header("location", redirectUrl + targetUrl.origin + rootLocation);
                }
                else {
                    res.header('location', redirectUrl + path + (path.endsWith('/')) ? "" : "/" + rootLocation);
                }
                if (debugMode)
                    console.log(logId + "Replaced Redirect location " + rootLocation + " to " + res.getHeader('location'));
            }
        }
        if (debugMode)
            console.log(logId + "Sending response: ", convertForLog(res));
        if (logMode)
            console.log(logId + "Sending response: ", res.statusCode);
        if (response.data != null) {
            response.data.pipe(res).on('finish', () => {
                next();
            }).on('error', (err) => {
                next(err);
            });
        }
        else {
            res.send(response.body);
        }
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            handleAxiosError(res, error, logId);
        }
        else {
            handleUnexpectedError(res, error, logId);
        }
    }
}));
function handleAxiosError(res, error, logId = '') {
    console.error(logId + "Received Error", convertForLog(error));
    if (error.response) {
        res.status(error.response.status).send(error);
    }
    else {
        res.status(500).send(error);
    }
}
function handleUnexpectedError(res, error, logId = '') {
    console.error(logId + "Received Unknown Error", error);
    res.status(500).send(error);
}
function convertForLog(item) {
    const ret = {};
    if (item instanceof axios_1.AxiosError) {
        const axiosError = item;
        if (axiosError.response != null) {
            return convertForLog(axiosError.response);
        }
        else {
            ret.status = 500;
            ret.message = 'No responses received.';
            if (axiosError.config != null) {
                ret.url = axiosError.config.url;
                ret.method = axiosError.config.method;
                ret.headers = axiosError.config.headers;
            }
        }
    }
    else if ((item.config == null) &&
        (item.toJSON == null)) {
        // It's an express response
        const expressResponse = item;
        ret.status = expressResponse.statusCode;
        ret.message = expressResponse.statusMessage;
        if (expressResponse.req != null) {
            ret.url = expressResponse.req.url;
            ret.method = expressResponse.req.method;
            ret.headers = expressResponse.req.headers;
        }
    }
    else if (item.toJSON != null) {
        // It's a RequestResponse
        const requestResponse = item;
        ret.status = requestResponse.statusCode;
        ret.message = requestResponse.statusMessage;
        if (requestResponse.request != null) {
            ret.url = requestResponse.request.uri;
            ret.method = requestResponse.request.method;
            ret.headers = requestResponse.request.headers;
        }
    }
    else {
        const axiosResponse = item;
        ret.status = axiosResponse.status;
        ret.message = axiosResponse.statusText;
        if (axiosResponse.config != null) {
            ret.url = axiosResponse.config.url;
            ret.method = axiosResponse.config.method;
            ret.headers = axiosResponse.config.headers;
        }
    }
    return ret;
}
app.listen(PORT, () => {
    console.log('Application started on port ' + PORT + ' under path "' + PROXY_PATH + '" with redirection host "' + (REDIRECT_HOST !== null && REDIRECT_HOST !== void 0 ? REDIRECT_HOST : 'not overriden.') + '"');
});
