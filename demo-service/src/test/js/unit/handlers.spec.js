let handlers = require('../../../main/js/handlers');

let expect = require('chai').expect;

describe('The get handler', () => {
  it('should return an object with the right schema', (done) => {
    handlers.get({}, {
      json: (val) => {
        expect(val).to.exist;
        expect(val.rec).to.exist;
        done();
      }
    }, () => {})
  })
});