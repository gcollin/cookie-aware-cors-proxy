import {transformCookie} from "../src/chrome-engine/fillCookiesJar";

describe('Cookies support', () => {

    it('should manage Fnac cookies', (done) => {
        try {
        const resp = transformCookie ("QueueITAccepted-SDFrts345E-V3_frprdfnaccom=EventId%3Dfrprdfnaccom%26QueueId%3Dd08de31f-13dc-49d7-bea8-43f18436816f%26RedirectType%3Dsafetynet%26IssueTime%3D1698848889%26Hash%3D44a985b8e85c334c8dd6b7dd5ef817de1f30d97d70af6254cbac9e7dcf7de031; expires=Thu, 02 Nov 2023 14:28:09 GMT; domain=fnac.com; path=/");
        expect(resp.indexOf('SameSite')).not.toEqual(-1);
        expect(resp.indexOf('Domain')).toEqual(-1);
        done();
        } catch (error) {
            done (error);
        }
    });
});
