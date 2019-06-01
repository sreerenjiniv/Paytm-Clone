var express = require('express');
var app = express();
var db = require('./db');
var passport = require('passport');

app.use(require('serve-static')(__dirname + '/../../public'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true
}));
var cors = require('cors');
app.use(cors());
app.use(passport.initialize());
app.use(passport.session());

var UserController = require('./user/UserController');
app.use('/users', UserController);

var TransactionController = require('./Transaction/TransactionController');
app.use('/transaction', TransactionController);

module.exports = app;
