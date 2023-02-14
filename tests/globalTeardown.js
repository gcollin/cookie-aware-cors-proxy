module.exports = async () => {
    console.log("Teardown:", (global.testedServer==null));
    global.server.close();
    global.testedServer.close();
};
