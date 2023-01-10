
import axios from 'axios';
import {chromeEngine} from "./chromeEngine";

jest.mock('axios');

describe('basic test', () => {
    it('should work', () => {
        expect(chromeEngine).toBeDefined();
    });

    it("support complex pages",  (done) => {
       chromeEngine.request ({
            url:'http://localhost/complex-page',
            method:'get'
        }).then ((response)=> {
            expect (response.status).toEqual(200);
            done();
        }).catch ((error:Error)=> {
            done(error);
        });
    });
});
