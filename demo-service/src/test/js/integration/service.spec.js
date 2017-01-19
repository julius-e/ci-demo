let expect = require('chai').expect
  , request = require('request')
  ;

// If URL is provided, assume we are testing a service that was started for us.
let url = process.env.URL || "http://localhost:8080";

if (!process.env.URL) {
  // Run service if not run externally.
  app = require('../../../main/js/index')
}

describe('The API', () => {
  describe('the get recommendation route', () => {
    it('should return a value', (done) => {
      request({
        uri: url + "/10",
        json: true
      }, (error, response, body) => {
        if (error)
          return done(error);

        expect(body).to.exist;
        expect(body.rec).to.exist;
        done();
      });
    });
  });
});