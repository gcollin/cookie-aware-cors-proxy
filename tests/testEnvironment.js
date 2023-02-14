//const TestEnvironment = require('jest-environment-jsdom'); // for browser js apps
const NodeEnvironment = require('jest-environment-node').TestEnvironment; // for server node apps

class ExpressEnvironment extends NodeEnvironment {
    constructor(config, context) {
        let cloneconfig = Object.assign({}, config)
        cloneconfig.testURL = process.env.SERVER_ADDRESS;
        super(cloneconfig, context);
    }

    async setup() {
        //this.global.jsdom = this.dom;

        await super.setup();
    }

    async teardown() {
        //this.global.jsdom = null;
        await super.teardown();
    }

    runScript(script) {
        return super.runScript(script);
    }
}

module.exports = ExpressEnvironment;
