module.exports = {
  get: (req, res, next) => {
    res.json({rec: parseInt(Math.random()*10000)});
  }
};