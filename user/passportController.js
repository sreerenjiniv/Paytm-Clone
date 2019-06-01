var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy;
var User = require('./User');

passport.deserializeUser(function (user, done) {
    done(null, user);
});

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

const localAuth = new LocalStrategy({
    usernameField: "mobile", passwordField: "password", passReqToCallback: true, session: false
}, function (req, mobile, password, done) {
    User.findOne({ mobile: mobile }, function (err, returndata) {
        if (err) {
            return done(err);
        }
        if (!returndata) {
            return done(Error('Incorrect User'));
        }
        if (!returndata.authenticate(password)) {
            return done(Error('Incorrect Password. Please try again!!'));
        }
        return done(null, returndata);
    });
});

passport.use(localAuth);

module.exports = passport;
