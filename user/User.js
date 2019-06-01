var mongoose = require('mongoose'),
  crypto = require('crypto');

var UserSchema = new mongoose.Schema({
  name: String,
  mobile: Number,
  encrypedPassword: { type: String, required: true },
  balance: Number,
  bankDetails: [{
    bankName: String,
    accountNumber: Number,
    branch: String,
    ifsc: String
  }],
  isActive: Boolean,
  isAdmin: Boolean,
  pendingTransactions: [String]
});


UserSchema.virtual('password').set(function (password) {
  this._password = password;
  this.encrypedPassword = this.encrypedUserPassword(password);
}).get(function () {
  return this._password;
});


UserSchema.pre('save', function (next) {
  if (this.isNew && this.provider === 'local' && this.password && !this.password.length)
    return next(new Error('Invalid password'));
  next();
});


UserSchema.methods = {
  encrypedUserPassword: function (password) {
    var salt = "qkgjkhkdsjuhdkshlkhllh";
    if (!password || !salt) return "";
    var salt = new Buffer(salt, "base64");
    return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha1").toString("base64");
  },
  authenticate: function (plainText) {
    return this.encrypedUserPassword(plainText) === this.encrypedPassword;
  },
};

module.exports = mongoose.model('User', UserSchema);