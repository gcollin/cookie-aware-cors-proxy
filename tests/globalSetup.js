const express = require('express');
    // Starts the proxy server
const testedServer = require('../src/server');
const {Request, Response} = require("express");
const {app, handleProxyRequest} = require("../src/server");
const {Cookie} = require("tough-cookie");


module.exports = async () => {

        // Starts a dummy server to use for testing
    let server;
    const app = express();

    await new Promise(function(resolve) {
        server = app.listen(0, "127.0.0.1", function() {
            let address = server.address();
            console.log(` Running express on '${JSON.stringify(address)}'...`);
            resolve();
        });
    });

    let address = server.address()
    global.server = server;
    global.testedServer = testedServer.app;
    process.env.SERVER_ADDRESS = `http://${address.address}:${address.port}`
    //app.use(express.static('./tests/files'));
    app.all('/**', async (req, res, next) => {
        let path=req.path;
        if( path.startsWith('/redirect')) {
            res.redirect(process.env.SERVER_ADDRESS+path.substring('/redirect'.length));
            return;
        }else if( path.startsWith('/cookie')) {
            res.cookie("domain-cookie", "value-of-domain-cookie",{
                domain:req.hostname,
                sameSite: 'Lax'
            });
            res.cookie("subdomain-cookie", "value-of-subdomain-cookie", {
                domain:'sub.'+req.hostname,
                sameSite: 'Strict'
            });
            res.cookie("path-cookie","value-of-path-cookie", {
                domain:req.hostname,
                sameSite: 'Lax',
                path: '/cookie/path'
            });
            path=path.substring('/cookie'.length);
        }

        res.sendFile(process.cwd()+'/tests/files'+path);

    });


};
