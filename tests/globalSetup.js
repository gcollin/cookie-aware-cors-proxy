const express = require('express');

module.exports = async () => {
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
    process.env.SERVER_ADDRESS = `http://${address.address}:${address.port}`
    app.use(express.static('./tests/files'));
};
