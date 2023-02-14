# cookie-aware-cors-proxy

A Cors proxy letting the browser manages cookies and redirects.
Based on the work of several repositories like https://github.com/miguelduarte42/cloudflare-scraper

## Install

```bash
npm install cookie-aware-cors-proxy
```

## Extra Features

- Translates cookies and redirect locations from the target website to have the browser continue to call the proxy and not directly the website
- Extensive and dynamic support for log and debug information
- Two engines: a lightweight and one based on chrome to support websites running javascript

## Quick Example

```shell
node run start
```

## API

TODO (same api as request package)

## TODO list

- replace request usage with axios
