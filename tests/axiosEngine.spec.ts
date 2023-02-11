import { getMockReq, getMockRes } from '@jest-mock/express';
import axios from "axios";

describe('Overall Axios tests', () => {

  //  const mockedAxios = jest.mocked(axios, true);
    const TEST_SERVER_URL='http://localhost:3000/proxy';

    it("should support simple requests",  (done) => {

        axios.request({
            url:'http://localhost:3000/proxy/'+process.env.SERVER_ADDRESS + '/index.html',
            method:'get'
        }).then( response => {
            expect(response.status).toBe(200);
            expect(response.data).toContain("Test Title");
            done();
        }, error => {
            done (error);
        })
    });

    it("should recalculate redirection",  async () => {

            // Test with / notation for url
        let response = await axios.request({
            url:TEST_SERVER_URL+'/'+process.env.SERVER_ADDRESS + '/redirect',
            method:'get',
            maxRedirects:0,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // default
            }
        });
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(TEST_SERVER_URL+'/'+process.env.SERVER_ADDRESS+'/index.html');

        // Test with / notation for url
        response = await axios.request({
            url:TEST_SERVER_URL+'/',
            params: {
                url:process.env.SERVER_ADDRESS + '/redirect'
            },
            method:'get',
            maxRedirects:0,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // default
            }
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe(TEST_SERVER_URL+'/?url='+encodeURIComponent(process.env.SERVER_ADDRESS+'/index.html'));
            // Now test the new location is ok
        response = await axios.request({
            url:response.headers.location,
            method:'get',
            maxRedirects:0,
        });
        expect(response.status).toBe(200);
        expect(response.data).toContain("Test Title");


    });

});
