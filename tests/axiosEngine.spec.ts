import { getMockReq, getMockRes } from '@jest-mock/express';
import axios from "axios";

describe('Overall Axios tests', () => {

  //  const mockedAxios = jest.mocked(axios, true);

    it("should support simple requests",  (done) => {

        axios.request({
            url:'http://localhost:3000/proxy/'+process.env.SERVER_ADDRESS + '/index.html',
            method:'get'
        }).then( response => {
            expect(response.status).toBe(200);
            done();
        }, error => {
            done (error);
        })
    });
});
