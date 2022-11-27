const USER_AGENT_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
const USER_AGENT_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';
const USER_AGENT_LINUX =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36';

export function getUserAgent(): string{
  const { platform } = process;
  if (platform === 'darwin') {
    return USER_AGENT_MAC;
  }
  if (platform === 'win32') {
    return USER_AGENT_WINDOWS;
  }
  return USER_AGENT_LINUX;
}

export function extract(src:string, regexp:RegExp, errorMessage?:string) :string|undefined{
  const match = src.match(regexp);
  if (match) {
    return match[1];
  }
  if( errorMessage!=null)
    throw new Error(errorMessage);

}

export function isCloudflareJSChallenge(body:string):boolean {
  return body.includes('Checking your browser before accessing') ||  body.includes('managed_checking_msg') || body.includes('Just a moment...') || body.includes('Please stand by');
}

export function isCloudflareCaptchaChallenge(body:string):boolean {
  return body.includes('cf_captcha_kind');
}
