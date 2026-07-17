const setUploadType = (type) => (req, _res, next) => {
  req.uploadType = type;
  next();
};

module.exports = { setUploadType };
