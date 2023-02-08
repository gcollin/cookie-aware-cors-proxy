
import axios, {AxiosResponse} from 'axios';
import {chromeEngine} from "../src/chrome-engine/chromeEngine";

//jest.mock('axios');

describe('basic test', () => {

  //  const mockedAxios = jest.mocked(axios, true);

    it('should work', () => {
        expect(chromeEngine).toBeDefined();
    });

    it("support simple requests",  (done) => {
    //    mockedAxios.request.mockResolvedValue({status:200, data:"html"});

        chromeEngine.requestChrome({
            url:process.env.SERVER_ADDRESS+'/index.html',
            method:'get'
        }).then ((response)=> {
            expect (response.status).toEqual(200);
            expect(response.data).toContain("Test Title");
            done();
        }).catch ((error:Error)=> {
            done(error);
        });
    });

});
