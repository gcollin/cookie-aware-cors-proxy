const express = require('express');
    // Starts the proxy server
const testedServer = require('../src/server');


module.exports = async () => {

        // Starts a dummy server to use for testing
    let server;
    const app = express();

    await new Promise(function(resolve) {
        server = app.listen(0, "localhost.localdomain", function() {
            let address = server.address();
            console.log(` Running express on '${JSON.stringify(address)}'...`);
            resolve();
        });
    });

    let address = 'localhost.localdomain';
    global.server = server;
    global.testedServer = testedServer.getProxyServer();
    //console.log("Setup:", (global.testedServer==null));
    process.env.SERVER_ADDRESS = 'http://'+address+':'+server.address().port;

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
            res.cookie("strict-cookie", "value-of-subdomain-cookie", {
                domain:req.hostname,
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
