const express = require('express');
    // Starts the proxy server
const testedServer = require('../src/server');
const {Request, Response} = require("express");
const {app, handleProxyRequest} = require("../src/server");


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
        if( req.path.indexOf('redirect') != -1) {
            res.redirect(process.env.SERVER_ADDRESS+'/index.html');
        }else {
            res.sendFile(process.cwd()+'/tests/files'+req.path);
        }
    });


};
